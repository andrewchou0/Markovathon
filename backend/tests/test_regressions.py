import asyncio
import copy
import importlib
import json
import os
from pathlib import Path
import threading
import tempfile
import unittest
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

import jsonschema
from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

from backend.agent import monitor, narrate, openclaw, propagation
from backend.api import main
from backend.data import db, seed

ROOT = Path(__file__).resolve().parents[2]
SUPPLIERS = json.loads((ROOT / "backend/data/seed/suppliers.json").read_text())
EVENTS = json.loads((ROOT / "backend/data/seed/events.json").read_text())
RESULT = json.loads((ROOT / "contracts/examples/analysis_result.example.json").read_text())


class StorageGuardTests(unittest.TestCase):
    def test_loopback_addresses_and_credentials_are_sanitized(self):
        for uri, address in [
            ("mongodb://localhost:27017", "mongodb://localhost:27017"),
            ("mongodb://127.0.0.1:27018", "mongodb://127.0.0.1:27018"),
            ("mongodb://[::1]:27017", "mongodb://[::1]:27017"),
            ("mongodb://alice:secret@localhost:27017/markovathon", "mongodb://localhost:27017"),
        ]:
            with self.subTest(uri=uri):
                self.assertEqual(db.validate_mongo_uri(uri), address)

    def test_remote_and_multiple_hosts_are_rejected(self):
        for uri in ["mongodb://example.com", "mongodb://localhost.example.com", "mongodb://127.0.0.1,example.com", "mongodb://localhost,127.0.0.1", "mongodb://%2Ftmp%2Fmongodb.sock"]:
            with self.subTest(uri=uri), self.assertRaises(ValueError):
                db.validate_mongo_uri(uri)

    def test_srv_rejected_before_dns_capable_parser(self):
        with patch.object(db, "parse_uri") as parser:
            with self.assertRaises(ValueError):
                db.validate_mongo_uri("mongodb+srv://example.com")
            parser.assert_not_called()

    def test_import_refuses_remote_uri_before_constructing_client(self):
        try:
            with patch.dict(os.environ, {"MONGO_URI": "mongodb://example.com"}), patch("pymongo.MongoClient") as client:
                with self.assertRaises(ValueError):
                    importlib.reload(db)
                client.assert_not_called()
        finally:
            importlib.reload(db)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)  # no lifespan and no Mongo connection
        self.addCleanup(self.client.close)
        for target, value in [("get_all_suppliers", SUPPLIERS), ("get_all_events", EVENTS)]:
            patcher = patch.object(main.repository, target, return_value=copy.deepcopy(value))
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = patch.object(main.repository, "get_event_by_id", side_effect=lambda event_id: next((copy.deepcopy(event) for event in EVENTS if event["id"] == event_id), None))
        patcher.start()
        self.addCleanup(patcher.stop)
        for target, attr, value in [(narrate, "DISABLED", True), (openclaw, "ENABLED", False)]:
            patcher = patch.object(target, attr, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_seeded_scenarios_preserve_analysis_contract(self):
        schema = json.loads((ROOT / "contracts/analysis_result.schema.json").read_text())
        schema["properties"]["event"] = json.loads((ROOT / "contracts/event.schema.json").read_text())
        for event in EVENTS:
            with self.subTest(event=event["id"]):
                response = self.client.post("/api/analyze", json={"event_id": event["id"]})
                self.assertEqual(response.status_code, 200)
                result = response.json()
                jsonschema.validate(result, schema)
                expected = propagation.get_affected_suppliers(event, SUPPLIERS)
                self.assertEqual(result["directly_affected"], expected["directly_affected"])
                self.assertEqual(result["cascading_affected"], expected["cascading_affected"])
                self.assertTrue(result["risk_summary"] and result["draft_report"])

    def test_valid_draft_uses_existing_affected_ids_without_propagation(self):
        with patch.object(propagation, "get_affected_suppliers", side_effect=AssertionError("should not recompute")):
            response = self.client.post("/api/actions/draft", json={"analysis_result": RESULT})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {"draft_report"})

    def test_bad_nested_draft_types_return_422(self):
        for key, value in [("event", []), ("event", "event"), ("directly_affected", {}), ("directly_affected", [None]), ("cascading_affected", "sup_001"), ("draft_report", {})]:
            result = {**RESULT, key: value}
            with self.subTest(key=key, value=value):
                self.assertEqual(self.client.post("/api/actions/draft", json={"analysis_result": result}).status_code, 422)

    def test_draft_rejects_unknown_or_overlapping_supplier_ids(self):
        for ids in [("sup_999", []), ("sup_001", ["sup_001"])]:
            result = {**RESULT, "directly_affected": [ids[0]], "cascading_affected": ids[1]}
            self.assertEqual(self.client.post("/api/actions/draft", json={"analysis_result": result}).status_code, 422)

    def test_draft_rejects_invalid_event_timestamp(self):
        for timestamp in ["nonsense", "2026-09-12", "2026-09-12T14:00:00"]:
            result = {**RESULT, "event": {**RESULT["event"], "timestamp": timestamp}}
            self.assertEqual(self.client.post("/api/actions/draft", json={"analysis_result": result}).status_code, 422)

    def test_bad_event_ids_return_422(self):
        for value in [None, {}, 123, "", "not-an-event"]:
            self.assertEqual(self.client.post("/api/analyze", json={"event_id": value}).status_code, 422)

    def test_unknown_event_is_404_even_without_agent(self):
        with patch.object(main, "propagation", None):
            self.assertEqual(self.client.post("/api/analyze", json={"event_id": "evt_999"}).status_code, 404)

    def test_database_outage_is_503(self):
        with patch.object(main.repository, "get_all_suppliers", side_effect=ServerSelectionTimeoutError("private connection details")):
            response = self.client.get("/api/suppliers")
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("private", response.text)

    def test_status_does_not_claim_global_enforcement(self):
        with patch.object(main, "offline_guard", None):
            response = self.client.get("/api/offline-status").json()
        self.assertFalse(response["enforced"])
        self.assertEqual(response["mode"], "not enforced")
        self.assertTrue(response["db"]["host_is_loopback"])

    def test_lifespan_stops_monitor_even_when_context_raises(self):
        async def exercise():
            async with main.lifespan(main.app):
                raise RuntimeError("context failed")
        with patch.object(main, "ping"), patch.object(main.monitor, "start") as start, patch.object(main.monitor, "stop") as stop:
            with self.assertRaisesRegex(RuntimeError, "context failed"):
                asyncio.run(exercise())
        start.assert_called_once()
        stop.assert_called_once()


class SeedValidationTests(unittest.TestCase):
    def test_invalid_timestamp_is_rejected_before_database_access(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "events.json").write_text(json.dumps([{**EVENTS[0], "timestamp": "invalid"}]))
            with patch.object(seed, "SEED_DIR", Path(directory)), self.assertRaises(ValueError):
                seed._load_and_validate("events.json", "event.schema.json")

    def test_duplicate_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "suppliers.json").write_text(json.dumps([SUPPLIERS[0], SUPPLIERS[0]]))
            with patch.object(seed, "SEED_DIR", Path(directory)), self.assertRaisesRegex(ValueError, "duplicate"):
                seed._load_and_validate("suppliers.json", "supplier.schema.json")

    def test_all_seed_files_validate_before_first_connection_or_write(self):
        with patch.object(seed, "_load_and_validate", side_effect=[SUPPLIERS, ValueError("bad events")]), patch.object(seed, "ping") as ping, patch.object(seed, "get_db") as get_db:
            with self.assertRaisesRegex(ValueError, "bad events"):
                seed.seed()
        ping.assert_not_called()
        get_db.assert_not_called()


class PropagationTests(unittest.TestCase):
    def test_nested_invalid_status_and_severity_do_not_crash(self):
        event = {**EVENTS[0], "severity": []}
        suppliers = copy.deepcopy(SUPPLIERS)
        suppliers[0]["compliance_status"] = {}
        risk = propagation.get_affected_suppliers(event, suppliers)
        self.assertEqual(risk["diagnostics"]["severity_used"], "medium")
        self.assertGreater(risk["network_risk_score"], 0)

    def test_state_abbreviation_does_not_match_inside_unrelated_word(self):
        self.assertIsNone(propagation.location_matches("Glasgow, UK", "LA"))
        self.assertIsNotNone(propagation.location_matches("Gulf Coast, LA", "LA"))

    def test_video_cascade_still_matches_seed(self):
        event = next(event for event in EVENTS if event["id"] == "evt_004")
        risk = propagation.get_affected_suppliers(event, SUPPLIERS)
        self.assertEqual(risk["network_risk_score"], .961)
        self.assertEqual(risk["cascade_by_hop"], {"1": ["sup_005", "sup_008"], "2": ["sup_002", "sup_006"], "3": ["sup_004"]})


class ApprovalTests(unittest.TestCase):
    def test_bad_nested_payload_is_still_reviewable(self):
        result = openclaw.build_approval_request({"event": [], "directly_affected": [None, {}], "cascading_affected": 12}, {"single_source_exposed": 12, "cascade_by_hop": {"1": None}})
        self.assertTrue(result["text"])
        self.assertIn("Reply handling and automatic sending are not connected", result["text"])

    def test_malformed_gateway_responses_never_claim_delivery(self):
        for body in [[], None, {"ok": "false"}, {"error": "denied"}]:
            with self.subTest(body=body), patch.object(openclaw, "ENABLED", True), patch.object(openclaw, "HOST_IS_LOCAL", True), patch.object(openclaw, "_post", return_value=(200, body)):
                result = openclaw.request_approval(RESULT)
                self.assertFalse(result["delivered"])
                self.assertTrue(result["detail"])


class MonitorTests(unittest.TestCase):
    def setUp(self):
        monitor.stop()
        monitor.reset()
        self.addCleanup(monitor.stop)

    def test_failed_assessment_is_retried(self):
        outcome = {"event_id": "evt_001", "action": "assessed_no_alert", "reason": "test"}
        with patch.object(monitor, "assess", side_effect=[RuntimeError("temporary"), outcome]):
            self.assertEqual(monitor.scan_once([EVENTS[0]], SUPPLIERS)[0]["action"], "error")
            self.assertEqual(monitor.status()["events_seen"], 0)
            self.assertEqual(monitor.scan_once([EVENTS[0]], SUPPLIERS)[0]["action"], "assessed_no_alert")
        self.assertEqual(monitor.status()["events_seen"], 1)

    def test_concurrent_scans_do_not_assess_same_event_twice(self):
        entered, release = threading.Event(), threading.Event()
        self.addCleanup(release.set)
        def assess(event, _suppliers):
            entered.set()
            release.wait(2)
            return {"event_id": event["id"], "action": "assessed_no_alert"}
        with patch.object(monitor, "assess", side_effect=assess) as assess_mock:
            worker = threading.Thread(target=monitor.scan_once, args=([EVENTS[0]], SUPPLIERS))
            worker.start()
            self.assertTrue(entered.wait(1))
            self.assertEqual(monitor.scan_once([EVENTS[0]], SUPPLIERS), [])
            release.set()
            worker.join(1)
            self.assertEqual(assess_mock.call_count, 1)

    def test_reset_discards_an_inflight_result(self):
        entered, release = threading.Event(), threading.Event()
        self.addCleanup(release.set)
        def assess(event, _suppliers):
            entered.set()
            release.wait(2)
            return {"event_id": event["id"], "action": "assessed_no_alert"}
        with patch.object(monitor, "assess", side_effect=assess):
            worker = threading.Thread(target=monitor.scan_once, args=([EVENTS[0]], SUPPLIERS))
            worker.start()
            self.assertTrue(entered.wait(1))
            monitor.reset()
            release.set()
            worker.join(1)
        self.assertEqual(monitor.activity(), [])
        self.assertEqual(monitor.status()["events_assessed"], 0)

    def test_stop_reports_busy_worker_until_it_really_exits(self):
        entered, release = threading.Event(), threading.Event()
        self.addCleanup(release.set)
        def loader():
            entered.set()
            release.wait(2)
            return [], []
        monitor.start(loader)
        self.assertTrue(entered.wait(1))
        monitor.stop(timeout=.001)
        self.assertTrue(monitor.status()["running"])
        self.assertFalse(monitor.start(loader))
        self.assertEqual(monitor.activity()[0]["action"], "monitor_stop_requested")
        release.set()
        monitor.stop(timeout=1)
        self.assertFalse(monitor.status()["running"])

    def test_loader_failure_recovers_on_next_tick(self):
        recovered = threading.Event()
        calls = []
        def loader():
            calls.append(1)
            if len(calls) == 1:
                raise RuntimeError("temporary database outage")
            recovered.set()
            return [], []
        with patch.object(monitor, "INTERVAL_S", .01):
            monitor.start(loader)
            self.assertTrue(recovered.wait(1))
            monitor.stop()
        self.assertTrue(any(row["action"] == "tick_error" for row in monitor.activity()))
        self.assertIsNone(monitor.status()["last_error"])

    def test_stop_prevents_starting_the_next_assessment(self):
        cancellation = threading.Event()
        def assess(event, _suppliers):
            cancellation.set()
            return {"event_id": event["id"], "action": "assessed_no_alert"}
        with patch.object(monitor, "assess", side_effect=assess) as mock:
            monitor.scan_once(EVENTS, SUPPLIERS, stop_event=cancellation)
        self.assertEqual(mock.call_count, 1)

    def test_invalid_interval_cannot_start_a_busy_loop(self):
        for interval in [0, -1, float("nan"), float("inf")]:
            with self.subTest(interval=interval), patch.object(monitor, "INTERVAL_S", interval), self.assertRaises(ValueError):
                monitor.start(lambda: ([], []))


class HttpTransportTests(unittest.TestCase):
    """Only an ephemeral loopback fixture server; no real service or recipient."""
    @classmethod
    def setUpClass(cls):
        cls.requests = []
        cls.payload = {"models": [], "response": "local test"}
        cls.response_status = 200
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                cls.requests.append(self.path)
                if self.path == "/redirect":
                    self.send_response(302)
                    self.send_header("Location", "/destination")
                    self.end_headers()
                else:
                    body = json.dumps(cls.payload).encode()
                    self.send_response(cls.response_status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
            def do_POST(self):
                self.rfile.read(int(self.headers.get("Content-Length", "0")))
                self.do_GET()
            def log_message(self, *_args):
                pass
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    def setUp(self):
        self.__class__.payload = {"models": [], "response": "local test"}
        self.__class__.response_status = 200

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.worker.join(1)

    def test_httpx_ignores_environment_proxy_for_local_requests(self):
        with patch.dict(os.environ, {"HTTP_PROXY": "http://127.0.0.1:1", "HTTPS_PROXY": "http://127.0.0.1:1", "ALL_PROXY": "http://127.0.0.1:1", "NO_PROXY": ""}):
            self.assertEqual(narrate._get_json(self.url, 1)["models"], [])
            self.assertEqual(narrate._post_json(self.url, {}, 1)["response"], "local test")
            with patch.object(openclaw, "OPENCLAW_HOST", self.url), patch.object(openclaw, "HOST_IS_LOCAL", True):
                self.assertEqual(openclaw._post("/", {})[0], 200)

    def test_stdlib_ignores_environment_proxy(self):
        with patch.dict(os.environ, {"http_proxy": "http://127.0.0.1:1", "no_proxy": ""}), patch.object(narrate, "_TRANSPORT", "urllib"):
            self.assertEqual(narrate._get_json(self.url, 1)["models"], [])

    def test_stdlib_does_not_follow_redirects(self):
        self.requests.clear()
        with patch.object(narrate, "_TRANSPORT", "urllib"), self.assertRaises(urllib.error.HTTPError):
            narrate._get_json(self.url + "/redirect", 1)
        self.assertNotIn("/destination", self.requests)

    def test_non_http_scheme_is_not_accepted_as_loopback(self):
        self.assertEqual(narrate._host_of("file://localhost/etc/passwd"), "")
        self.assertEqual(openclaw._hostname("file://localhost/etc/passwd"), "")

    def test_real_http_mock_model_generates_validated_prose(self):
        text = "Gulf Precision Castings is exposed to the port closure. Delta Assembly Works needs an alternate supply plan."
        self.__class__.payload = {"response": text}
        with patch.object(narrate, "DISABLED", False), patch.object(narrate, "HOST_IS_LOCAL", True), patch.object(narrate, "OLLAMA_ENDPOINT", self.url), patch.object(openclaw, "ENABLED", False):
            result = narrate.generate_risk_summary(EVENTS[0], ["sup_001"], ["sup_002"], SUPPLIERS)
        self.assertEqual(result, text)
        self.assertEqual(narrate.STATS["last_mode"], "llm")

    def test_real_http_mock_gateway_generates_validated_prose(self):
        text = "Gulf Precision Castings is exposed to the port closure. Delta Assembly Works needs an alternate supply plan."
        self.__class__.payload = {"choices": [{"message": {"content": text}}]}
        with patch.object(openclaw, "ENABLED", True), patch.object(openclaw, "HOST_IS_LOCAL", True), patch.object(openclaw, "OPENCLAW_HOST", self.url):
            result = narrate.generate_risk_summary(EVENTS[0], ["sup_001"], ["sup_002"], SUPPLIERS)
        self.assertEqual(result, text)
        self.assertEqual(narrate.STATS["last_mode"], "openclaw")

    def test_gateway_http_failure_uses_deterministic_fallback(self):
        self.__class__.response_status = 503
        self.__class__.payload = {"error": "unavailable"}
        with patch.object(openclaw, "ENABLED", True), patch.object(openclaw, "HOST_IS_LOCAL", True), patch.object(openclaw, "OPENCLAW_HOST", self.url), patch.object(narrate, "DISABLED", True):
            result = narrate.generate_risk_summary(EVENTS[0], ["sup_001"], ["sup_002"], SUPPLIERS)
        self.assertIn("Gulf Precision Castings", result)
        self.assertEqual(narrate.STATS["last_mode"], "deterministic")

    def test_model_timeout_is_not_retried_and_returns_a_template(self):
        import httpx
        with patch.object(narrate, "DISABLED", False), patch.object(narrate, "HOST_IS_LOCAL", True), patch.object(openclaw, "ENABLED", False), patch.object(narrate, "_post_json", side_effect=httpx.ReadTimeout("mock timeout")) as post:
            result = narrate.generate_draft_report(EVENTS[0], ["sup_001"], ["sup_002"], SUPPLIERS)
        post.assert_called_once()
        self.assertIn("Gulf Precision Castings", result)
        self.assertEqual(narrate.STATS["last_mode"], "deterministic")


if __name__ == "__main__":
    unittest.main()
