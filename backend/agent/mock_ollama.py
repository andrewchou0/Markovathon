"""A stand-in for Ollama, on localhost, for testing without a 35B model.

Why this exists: narrate.py's live path — HTTP transport, retry, response
parsing, sanitizing, the quality gate — cannot be verified on a machine with no
Ollama installed, and "it'll probably work on the demo box" is not verification.
This serves the two endpoints narrate.py uses, so that path gets exercised over
real HTTP against a real socket.

It is a TEST FIXTURE, not part of the product. Nothing in backend/api/ or
backend/agent/ imports it, and it binds to 127.0.0.1 only.

Useful to the rest of the team too: run it, point OLLAMA_HOST at it, and the
whole stack behaves as if the model were up, with no GPU and no download.

    python backend/agent/mock_ollama.py --port 11434
    # then, in another shell, the API and frontend work end-to-end

Scenarios (--scenario):
    good     canned prose wrapped in the junk real models emit (fences,
             preamble, think block) — proves the sanitizer earns its place
    messy    same, plus stacked preambles and ragged whitespace
    no_headers  asked for an email, returns bare prose -> narrate.py must add
             the To:/Subject: lines itself
    empty    a 200 with an empty response field -> narrate.py must fall back
    garbage  fluent prose naming no real supplier -> quality gate must reject
    slow     delays past a short read timeout -> narrate.py must fall back
    error    HTTP 500 -> narrate.py must fall back
"""

from __future__ import annotations

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL_NAME = "qwen3.6:35b"

_GOOD = (
    "Gulf Precision Castings has been cut off by the Gulf Coast port closure, and as "
    "the single qualified source for the cast turbine housing it has no alternate to "
    "route around. Delta Assembly Works and Northline Coatings both draw on that "
    "housing and are exposed within one tier, with Cascade Final Assembly affected at "
    "the second tier. Delta Assembly is the most fragile link, already flagged at risk "
    "on compliance."
)

_GOOD_EMAIL = (
    "To: Compliance Contact\n"
    "Subject: Gulf Coast port closure — immediate exposure review\n\n"
    "A high-severity port closure on the Gulf Coast has stopped inbound alloy "
    "shipments to Gulf Precision Castings, the single qualified source for our cast "
    "turbine housing.\n\n"
    "Affected: Gulf Precision Castings, Delta Assembly Works, Northline Coatings, "
    "Cascade Final Assembly.\n\n"
    "Recommended next steps:\n"
    "1. Confirm on-hand housing inventory at Delta Assembly Works.\n"
    "2. Open qualification review for a second casting source.\n"
    "3. Re-check the compliance filing for Delta Assembly Works.\n\n"
    "This draft is for human review and has not been sent."
)

# A model that returns bare prose when asked for an email — the case that broke
# end-to-end testing and is now handled by narrate._ensure_email_header.
_NO_HEADERS = (
    "Gulf Precision Castings has been cut off by the Gulf Coast port closure and "
    "Delta Assembly Works is exposed downstream. Someone should look at inventory "
    "and start qualifying a second source this week."
)

_GARBAGE = (
    "The situation is developing and several parties may be impacted in the coming "
    "days. Stakeholders should monitor the position closely and escalate as needed, "
    "pending further assessment of the operational picture."
)

def _is_email_prompt(prompt: str) -> bool:
    """narrate.py sends two different prompts; a real model answers them
    differently, so the mock has to as well."""
    return "email" in prompt.lower()


SCENARIOS = {
    # Canned prose wrapped in the junk real models emit, answering whichever of
    # the two prompts it was actually given.
    "good": lambda p: (
        f"<think>Drafting.</think>```\nSure! Here is the draft:\n{_GOOD_EMAIL}\n```"
        if _is_email_prompt(p)
        else f"<think>Considering the cascade.</think>```\nSure! Here is the summary: {_GOOD}\n```"
    ),
    "messy": lambda p: f"Certainly.\n\nHere's the draft:\n\n```markdown\nSummary:   {_GOOD_EMAIL if _is_email_prompt(p) else _GOOD}\n\n\n\n```",
    # Asked for an email, returns bare prose with no To:/Subject: lines.
    "no_headers": lambda p: _NO_HEADERS,
    "empty": lambda p: "",
    "garbage": lambda p: _GARBAGE,
    "slow": lambda p: (time.sleep(5), _GOOD)[1],
    "error": lambda p: None,
}


class Handler(BaseHTTPRequestHandler):
    scenario = "good"

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        if self.path.startswith("/api/tags"):
            self._send(200, {"models": [{"name": MODEL_NAME, "size": 0}]})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 - stdlib naming
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length)
        if not self.path.startswith("/api/generate"):
            self._send(404, {"error": "not found"})
            return
        try:
            prompt = json.loads(raw or b"{}").get("prompt", "")
        except ValueError:
            prompt = ""
        text = SCENARIOS[self.scenario](prompt)
        if text is None:
            self._send(500, {"error": "simulated model failure"})
            return
        self._send(200, {"model": MODEL_NAME, "response": text, "done": True})

    def log_message(self, *args) -> None:  # keep test output readable
        pass


def serve(port: int = 11434, scenario: str = "good") -> ThreadingHTTPServer:
    Handler.scenario = scenario
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=11434)
    parser.add_argument("--scenario", choices=sorted(SCENARIOS), default="good")
    args = parser.parse_args()

    httpd = serve(args.port, args.scenario)
    print(f"mock ollama: http://127.0.0.1:{args.port}  model={MODEL_NAME}  scenario={args.scenario}")
    print("point OLLAMA_HOST at it, e.g.:")
    print(f"  OLLAMA_HOST=http://localhost:{args.port} python backend/agent/narrate.py")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
