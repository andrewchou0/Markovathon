"""A stand-in for the OpenClaw gateway, on localhost, for testing without it.

Serves the two endpoints backend/agent/openclaw.py uses:

    POST /v1/chat/completions    the model harness (OpenAI-compatible)
    POST /tools/invoke           tool invocation, used to deliver an approval

TEST FIXTURE, not part of the product. Binds 127.0.0.1 only, and nothing in
backend/api/ or backend/agent/ imports it.

    python backend/agent/mock_openclaw.py --port 18789
    OPENCLAW_ENABLE=1 python backend/agent/openclaw.py

Scenarios (--scenario):
    good           harness answers; `send` delivers
    wrong_tool     only `channel_send` exists, so the tool probe has to find it
    no_tool        no message tool at all -> approval reports undelivered
    chat_disabled  /v1/chat/completions returns 404 (the documented default)
    unauthorized   401 unless --token is presented
    wrong_suppliers  fluent prose naming suppliers that were never identified,
                   so narrate.py's quality gate must reject it
    server_error   500 from both endpoints

Pass --token to require `Authorization: Bearer <token>`.
"""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_SUMMARY = (
    "Gulf Precision Castings has lost outbound capacity, and as the single "
    "qualified source for the cast turbine housing it has no alternate. Delta "
    "Assembly Works and Northline Coatings are exposed one tier downstream, with "
    "Cascade Final Assembly at the end of that chain."
)

_EMAIL = (
    "To: Compliance Contact\n"
    "Subject: Gulf Coast disruption — immediate exposure review\n\n"
    "A port closure has halted inbound alloy to Gulf Precision Castings, our "
    "single qualified source for the cast turbine housing.\n\n"
    "Recommended next steps:\n"
    "1. Confirm housing inventory at Delta Assembly Works.\n"
    "2. Open qualification for a second casting source.\n"
    "3. Re-check the compliance filing for Delta Assembly Works.\n\n"
    "This draft is for human review and has not been sent."
)

# Fluent prose about suppliers that propagation.py never identified. narrate.py's
# quality gate must reject this and narrate deterministically instead — the
# gateway leg gets the same hallucination guard as the direct Ollama leg.
_WRONG_SUPPLIERS = (
    "Altiplano Rare Earth has lost its export licence and Kanto Precision "
    "Bearings is exposed downstream. Inventory should be confirmed this week and "
    "a second concentrate source qualified without delay."
)


class Handler(BaseHTTPRequestHandler):
    scenario = "good"
    token = ""

    # Which tool name this gateway claims to have, per scenario.
    TOOL_FOR_SCENARIO = {"good": "send", "wrong_tool": "channel_send", "no_tool": None}

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorised(self) -> bool:
        if not self.token:
            return True
        return self.headers.get("Authorization", "") == f"Bearer {self.token}"

    def do_POST(self) -> None:  # noqa: N802 - stdlib naming
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length)
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            body = {}

        if self.scenario == "unauthorized" or not self._authorised():
            self._send(401, {"ok": False, "error": {"type": "unauthorized", "message": "bad token"}})
            return
        if self.scenario == "server_error":
            self._send(500, {"ok": False, "error": {"type": "internal", "message": "boom"}})
            return

        if self.path.startswith("/v1/chat/completions"):
            self._chat(body)
        elif self.path.startswith("/tools/invoke"):
            self._tools(body)
        else:
            self._send(404, {"ok": False, "error": {"type": "not_found", "message": self.path}})

    def _chat(self, body: dict) -> None:
        if self.scenario == "chat_disabled":
            # The documented default: the endpoint exists only once enabled in
            # gateway.http.endpoints.chatCompletions.
            self._send(404, {"ok": False, "error": {"type": "not_found", "message": "endpoint disabled"}})
            return

        prompt = ""
        for message in body.get("messages") or []:
            if isinstance(message, dict) and message.get("role") == "user":
                prompt = str(message.get("content", ""))

        if self.scenario == "wrong_suppliers":
            text = _WRONG_SUPPLIERS
        else:
            text = _EMAIL if "email" in prompt.lower() else _SUMMARY

        self._send(200, {
            "id": "chatcmpl-mock",
            "object": "chat.completion",
            "model": body.get("model", "openclaw/default"),
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
        })

    def _tools(self, body: dict) -> None:
        expected = self.TOOL_FOR_SCENARIO.get(self.scenario, "send")
        requested = body.get("tool")

        if expected is None or requested != expected:
            self._send(404, {"ok": False, "error": {"type": "not_found", "message": f"no tool {requested!r}"}})
            return

        args = body.get("args") or {}
        channel = self.headers.get("x-openclaw-message-channel") or args.get("channel")
        self._send(200, {
            "ok": True,
            "result": {
                "delivered": True,
                "channel": channel,
                "chars": len(str(args.get("text", ""))),
            },
        })

    def log_message(self, *args) -> None:  # keep test output readable
        pass


def serve(port: int = 18789, scenario: str = "good", token: str = "") -> ThreadingHTTPServer:
    Handler.scenario = scenario
    Handler.token = token
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=18789)
    parser.add_argument("--scenario", default="good",
                        choices=["good", "wrong_tool", "no_tool", "chat_disabled",
                                 "wrong_suppliers", "unauthorized", "server_error"])
    parser.add_argument("--token", default="")
    args = parser.parse_args()

    httpd = serve(args.port, args.scenario, args.token)
    print(f"mock openclaw gateway: http://127.0.0.1:{args.port}  scenario={args.scenario}"
          + (f"  token={args.token}" if args.token else "  (no auth)"))
    print("use it with:")
    print(f"  OPENCLAW_ENABLE=1 OPENCLAW_HOST=http://127.0.0.1:{args.port} python -m backend.agent")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
