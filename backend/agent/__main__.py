"""Full self-test for the agent core:  python -m backend.agent

Runs both module suites, then checks the handoff between them — propagation's
output feeding narrate's input, assembled into a complete AnalysisResult exactly
the way backend/api/ will do it. If this command is green, backend/agent/ is
ready for the API layer.

Requires nothing to be running: no API, no frontend, no MongoDB, no Ollama.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
EXAMPLES = os.path.join(ROOT, "contracts", "examples")

# The five keys backend/api must return. Source: contracts/analysis_result.schema.json
CONTRACT_KEYS = {"event", "directly_affected", "cascading_affected", "risk_summary", "draft_report"}


def run_module_suite(module: str) -> tuple[bool, str]:
    # Invoked as `-m backend.agent.<module>` rather than as a bare file path:
    # monitor.py imports its siblings, which only resolves when the package is
    # the entry point. Works for the dependency-free modules either way.
    proc = subprocess.run(
        [sys.executable, "-m", f"backend.agent.{module}"],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    tail = [line for line in proc.stdout.splitlines() if "checks passed" in line]
    return proc.returncode == 0, (tail[-1].strip() if tail else "no summary line")


def main() -> int:
    from backend.agent import monitor, narrate, openclaw, propagation

    print("=" * 72)
    print("  backend/agent self-test")
    print("=" * 72)

    failures = 0

    # --- 1. the two module suites -------------------------------------------
    print("\n  module suites")
    for module in ("propagation", "narrate", "openclaw", "monitor"):
        ok, summary = run_module_suite(module)
        print(f"    [{'PASS' if ok else 'FAIL'}] {module + '.py':<16} {summary}")
        failures += 0 if ok else 1

    # --- 2. the handoff, wired the way the API will wire it -----------------
    print("\n  integration: propagation -> narrate -> AnalysisResult")

    with open(os.path.join(EXAMPLES, "suppliers.example.json"), encoding="utf-8") as fh:
        suppliers = json.load(fh)
    with open(os.path.join(EXAMPLES, "events.example.json"), encoding="utf-8") as fh:
        events = json.load(fh)

    checks: list[tuple[str, bool, str]] = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        checks.append((label, bool(ok), detail))

    for event in events:
        # This is the whole of what backend/api/main.py has to do:
        risk = propagation.get_affected_suppliers(event, suppliers)
        direct, cascade = risk["directly_affected"], risk["cascading_affected"]
        result = {
            "event": event,
            "directly_affected": direct,
            "cascading_affected": cascade,
            "risk_summary": narrate.generate_risk_summary(event, direct, cascade, suppliers),
            "draft_report": narrate.generate_draft_report(event, direct, cascade, suppliers),
        }

        tag = event["id"]
        check(f"{tag}: result has exactly the contract keys", set(result) == CONTRACT_KEYS, str(set(result) ^ CONTRACT_KEYS))
        check(f"{tag}: summary is non-empty prose", isinstance(result["risk_summary"], str) and len(result["risk_summary"]) > 80)
        check(f"{tag}: report is non-empty prose", isinstance(result["draft_report"], str) and len(result["draft_report"]) > 80)
        check(f"{tag}: id lists never overlap", not set(direct) & set(cascade))
        check(f"{tag}: every id is a real supplier", set(direct + cascade) <= {s["id"] for s in suppliers})
        check(f"{tag}: result is JSON-serializable", json.dumps(result) is not None)
        check(f"{tag}: no Mongo _id leaked through", "_id" not in json.dumps(result))
        if direct or cascade:
            names = [s["name"] for s in suppliers if s["id"] in set(direct + cascade)]
            check(f"{tag}: narration names an affected supplier", any(n in result["risk_summary"] for n in names))

    width = max(len(label) for label, _, _ in checks)
    for label, ok, detail in checks:
        if not ok:
            failures += 1
        line = f"    [{'PASS' if ok else 'FAIL'}] {label.ljust(width)}"
        if detail and not ok:
            line += f"   got: {detail}"
        print(line)

    # --- 3. the approval hand-off (OpenClaw) --------------------------------
    print("\n  integration: AnalysisResult -> OpenClaw approval request")
    approval_checks: list[tuple[str, bool, str]] = []
    demo_event = events[0]
    risk = propagation.get_affected_suppliers(demo_event, suppliers)
    result = {
        "event": demo_event,
        "directly_affected": risk["directly_affected"],
        "cascading_affected": risk["cascading_affected"],
        "risk_summary": narrate.generate_risk_summary(demo_event, risk["directly_affected"], risk["cascading_affected"], suppliers),
        "draft_report": narrate.generate_draft_report(demo_event, risk["directly_affected"], risk["cascading_affected"], suppliers),
    }
    delivery = openclaw.request_approval(result, risk)

    for label, ok, detail in [
        ("approval request is built regardless of gateway state", bool(delivery["request"]["text"]), ""),
        ("approval carries the draft report", "Recommended next steps" in delivery["request"]["text"] or "recommend" in delivery["request"]["text"].lower(), ""),
        ("approval carries the affected ids", all(i in delivery["request"]["text"] for i in risk["directly_affected"]), ""),
        ("approval states nothing was sent", "Nothing has been sent" in delivery["request"]["text"], ""),
        ("delivery outcome is reported honestly", isinstance(delivery["delivered"], bool) and bool(delivery["detail"]), delivery["detail"]),
    ]:
        approval_checks.append((label, ok, detail))
        print(f"    [{'PASS' if ok else 'FAIL'}] {label}")
        if not ok:
            failures += 1
    print(f"    -> delivered={delivery['delivered']} ({delivery['detail']})")

    # --- 3b. the unattended loop --------------------------------------------
    print("\n  integration: unattended scan over the seeded events")
    monitor.reset()
    actions = monitor.scan_once(events, suppliers)
    alerted = [a for a in actions if a["action"].startswith("alert")]
    suppressed = [a for a in actions if a["action"] == "assessed_no_alert"]
    for label, ok in [
        ("every event assessed without being asked", len(actions) == len(events)),
        ("high-risk events selected for a human", len(alerted) >= 1),
        ("low-risk events suppressed with a reason", len(suppressed) >= 1 and all(a["reason"] for a in suppressed)),
        ("re-scanning alerts nobody twice", monitor.scan_once(events, suppliers) == []),
        ("every decision is on the audit trail", len(monitor.activity(100)) == len(events)),
    ]:
        print(f"    [{'PASS' if ok else 'FAIL'}] {label}")
        if not ok:
            failures += 1
    print(f"    -> {len(actions)} assessed, {len(alerted)} escalated, {len(suppressed)} suppressed")

    # --- 4. what the narration is actually doing right now ------------------
    health = narrate.narration_health()
    print("\n  narration mode")
    print(f"    model      : {health['model']}")
    print(f"    host       : {health['host']}  (local: {health['host_is_local']})")
    print(f"    reachable  : {health['reachable']}")
    print(f"    active mode: {health['mode']}")
    if health.get("error"):
        print(f"    note       : {health['error']}")
    oc = health.get("openclaw") or {}
    print(f"    openclaw   : enabled={oc.get('enabled')} harness={oc.get('harness_available')} "
          f"{('- ' + oc['detail']) if oc.get('detail') else ''}")

    print()
    print("=" * 72)
    if failures:
        print(f"  FAILED — {failures} problem(s)")
    else:
        print("  ALL GREEN — backend/agent is ready for the API layer")
    print("=" * 72)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
