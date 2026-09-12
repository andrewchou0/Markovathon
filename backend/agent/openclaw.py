"""OpenClaw integration — local gateway, two jobs.

OpenClaw (https://openclaw.ai) is an open-source AI agent that runs on your own
machine and reaches people through the chat apps they already use. It fits this
project because it is local-first for the same reason we are: state, credentials
and models stay on the box.

We use it for two things:

1. MODEL HARNESS. Narration is routed through the gateway's OpenAI-compatible
   endpoint instead of calling Ollama directly, so the model is a swappable
   OpenClaw plugin (`agents.defaults.model.primary: "ollama/qwen3.6:35b"`) rather
   than a hardcoded HTTP call. narrate.py still falls back to direct Ollama and
   then to deterministic text, so adding a layer cannot make the demo fail.

2. APPROVAL CHANNEL. The premise of the product is that the agent drafts a
   report *for human approval*. OpenClaw delivers that draft to the compliance
   contact in Slack/Telegram/iMessage and carries their decision back, which is
   what closes the loop instead of leaving a draft sitting in a browser tab.

API, from the OpenClaw docs (see contracts/openclaw.md for the full write-up):
  gateway      http://127.0.0.1:18789            (HTTP + WS multiplexed)
  auth         Authorization: Bearer <token>      gateway.auth.mode = "token"
  harness      POST /v1/chat/completions          text at choices[0].message.content
  tools        POST /tools/invoke                 {"tool","args"} -> {"ok","result"}
  channel      x-openclaw-message-channel: slack
  config       ~/.openclaw/openclaw.json          (JSON5)

Everything here is best-effort and never raises: if the gateway is absent,
misconfigured or unauthorised, narration falls back and approval is reported as
undelivered. The demo does not depend on OpenClaw being up.

Run it standalone:  python backend/agent/openclaw.py
"""

from __future__ import annotations

import json
import os
import time
from typing import Any
from urllib.parse import urlparse

try:
    from backend.agent.transport import urlopen
except ImportError:  # supports running this module directly
    from transport import urlopen

# --- configuration ----------------------------------------------------------
# 18789 is the documented gateway default. HTTP and WebSocket share this port.
OPENCLAW_HOST = os.getenv("OPENCLAW_HOST", "http://127.0.0.1:18789")

# gateway.auth.mode="token" reads OPENCLAW_GATEWAY_TOKEN; "none" needs no header.
OPENCLAW_TOKEN = os.getenv("OPENCLAW_GATEWAY_TOKEN", os.getenv("OPENCLAW_TOKEN", ""))

# Which agent answers. "openclaw/default" uses the gateway's default agent, whose
# own model config is where ollama/qwen3.6:35b is selected.
OPENCLAW_AGENT = os.getenv("OPENCLAW_AGENT", "openclaw/default")

# Where an approval request is delivered. Any configured channel plugin works.
OPENCLAW_CHANNEL = os.getenv("OPENCLAW_CHANNEL", "slack")

CONNECT_TIMEOUT_S = float(os.getenv("OPENCLAW_CONNECT_TIMEOUT", "3"))

# Deliberately shorter than narrate.py's 90s Ollama read timeout. This leg is a
# preference with a fallback behind it, so a gateway that accepts the connection
# and then stalls must not burn the demo's patience before the direct Ollama call
# even starts. Worst case through the chain is this plus the Ollama timeout.
READ_TIMEOUT_S = float(os.getenv("OPENCLAW_READ_TIMEOUT", "30"))

# Off unless asked for, so no teammate's machine suddenly depends on a gateway
# they haven't installed. Person 4 turns this on for the demo.
ENABLED = os.getenv("OPENCLAW_ENABLE", "").strip().lower() in {"1", "true", "yes"}

# The docs specify POST /tools/invoke and its envelope, but do not name the tool
# that sends a channel message; `send` is the name used at the RPC layer. Rather
# than hardcode one guess, try the plausible names once and remember whichever
# the gateway actually accepts — a 404 means "tool not available", which is a
# clean discovery signal. Override with OPENCLAW_MESSAGE_TOOL to skip probing.
MESSAGE_TOOL_CANDIDATES = [
    t
    for t in (
        os.getenv("OPENCLAW_MESSAGE_TOOL", ""),
        "send",
        "message_send",
        "messages_send",
        "chat_send",
        "channel_send",
    )
    if t
]

_discovered_tool: str | None = None

STATS: dict[str, Any] = {
    "harness_calls": 0,
    "harness_failures": 0,
    "approvals_sent": 0,
    "approvals_failed": 0,
    "message_tool": None,
    "last_latency_s": None,
    "last_error": None,
}


class OpenClawUnavailable(RuntimeError):
    """The gateway can't be used. Callers fall back; this never reaches a route."""


# --- localhost guard --------------------------------------------------------
# Same rule as the Ollama host and the Mongo URI: the whole pitch is that this
# data never leaves the machine, and a gateway URL is just as capable of pointing
# somewhere else as a connection string is.
LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "::1", "[::1]"}

# Same narrow escape hatch as narrate.py: the gateway may run on another box you
# own (a GB10 serving both the model and the gateway, for instance). Name that
# one host explicitly with OPENCLAW_ALLOW_HOST; never a wildcard, never a hosted
# endpoint. health() reports it separately from loopback.
ALLOW_HOST = os.getenv("OPENCLAW_ALLOW_HOST", "").strip().lower()


def _hostname(url: str) -> str:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return ""
        return (parsed.hostname or "").lower()
    except BaseException:  # noqa: BLE001
        return ""


OPENCLAW_HOSTNAME = _hostname(OPENCLAW_HOST)
HOST_IS_LOOPBACK = OPENCLAW_HOSTNAME in LOCAL_HOSTNAMES
HOST_ALLOWLISTED = bool(ALLOW_HOST) and OPENCLAW_HOSTNAME == ALLOW_HOST
HOST_IS_LOCAL = HOST_IS_LOOPBACK or HOST_ALLOWLISTED


# --- transport --------------------------------------------------------------
# httpx when available so Person 4's offline hook sees these calls too.
try:  # pragma: no cover - import-time branch
    import httpx

    _TRANSPORT = "httpx"
except ImportError:  # pragma: no cover
    httpx = None
    _TRANSPORT = "urllib"


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if OPENCLAW_TOKEN:
        headers["Authorization"] = f"Bearer {OPENCLAW_TOKEN}"
    if extra:
        headers.update(extra)
    return headers


def _post(path: str, payload: dict, extra_headers: dict[str, str] | None = None) -> tuple[int, dict]:
    """POST JSON, returning (status, body). Raises only on transport failure."""
    if not HOST_IS_LOCAL:
        raise OpenClawUnavailable(
            f"refusing non-local OPENCLAW_HOST {OPENCLAW_HOST!r} — this project runs "
            "entirely on localhost"
        )

    url = f"{OPENCLAW_HOST.rstrip('/')}{path}"
    body = json.dumps(payload).encode("utf-8")
    headers = _headers(extra_headers)

    if _TRANSPORT == "httpx":
        timeout = httpx.Timeout(READ_TIMEOUT_S, connect=CONNECT_TIMEOUT_S)
        response = httpx.post(url, content=body, headers=headers, timeout=timeout, trust_env=False, follow_redirects=False)
        try:
            return response.status_code, response.json()
        except ValueError:
            return response.status_code, {}

    import urllib.error
    import urllib.request

    request = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urlopen(request, timeout=READ_TIMEOUT_S) as response:
            return response.status, json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        # A 4xx is a real answer from the gateway, not a transport failure — the
        # tool-name probe depends on being able to read a 404.
        try:
            return exc.code, json.loads(exc.read().decode("utf-8") or "{}")
        except BaseException:  # noqa: BLE001
            return exc.code, {}


# --- job 1: model harness ---------------------------------------------------
def chat_completion(prompt: str, temperature: float = 0.3) -> str:
    """Run a prompt through OpenClaw's agent. Returns text or raises.

    POST /v1/chat/completions is OpenAI-compatible and disabled by default —
    enable it with gateway.http.endpoints.chatCompletions.enabled = true.
    """
    if not ENABLED:
        raise OpenClawUnavailable("disabled (set OPENCLAW_ENABLE=1)")

    started = time.monotonic()
    STATS["harness_calls"] += 1
    try:
        status, body = _post(
            "/v1/chat/completions",
            {
                "model": OPENCLAW_AGENT,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "temperature": temperature,
            },
        )
    except BaseException as exc:  # noqa: BLE001
        STATS["harness_failures"] += 1
        STATS["last_error"] = f"{type(exc).__name__}: {exc}"[:200]
        raise OpenClawUnavailable(str(exc)) from exc

    STATS["last_latency_s"] = round(time.monotonic() - started, 2)

    if status == 404:
        STATS["harness_failures"] += 1
        STATS["last_error"] = "chatCompletions endpoint disabled on the gateway"
        raise OpenClawUnavailable(STATS["last_error"])
    if status in (401, 403):
        STATS["harness_failures"] += 1
        STATS["last_error"] = f"gateway rejected auth (HTTP {status}) — check OPENCLAW_GATEWAY_TOKEN"
        raise OpenClawUnavailable(STATS["last_error"])
    if status != 200:
        STATS["harness_failures"] += 1
        STATS["last_error"] = f"gateway returned HTTP {status}"
        raise OpenClawUnavailable(STATS["last_error"])

    try:
        text = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        STATS["harness_failures"] += 1
        STATS["last_error"] = "unexpected response shape from /v1/chat/completions"
        raise OpenClawUnavailable(STATS["last_error"]) from exc

    if not isinstance(text, str) or not text.strip():
        STATS["harness_failures"] += 1
        STATS["last_error"] = "gateway returned empty content"
        raise OpenClawUnavailable(STATS["last_error"])

    return text


# --- job 2: approval channel ------------------------------------------------
def build_approval_request(analysis_result: dict, risk: dict | None = None) -> dict:
    """Turn an AnalysisResult into the human-readable approval message.

    Pure function — no network, no side effects — so it is testable on its own
    and so the exact text can be reviewed before anything is delivered.
    """
    analysis_result = analysis_result if isinstance(analysis_result, dict) else {}
    risk = risk if isinstance(risk, dict) else {}

    event = analysis_result.get("event")
    event = event if isinstance(event, dict) else {}
    def ids(value):
        return [item for item in value if isinstance(item, str)] if isinstance(value, (list, tuple)) else []
    direct = ids(analysis_result.get("directly_affected"))
    cascade = ids(analysis_result.get("cascading_affected"))
    severity = str(event.get("severity", "unknown")).upper()

    headline = f"Supply disruption — {severity} — approval required"
    lines = [
        headline,
        "",
        f"Event: {event.get('description', 'unspecified')}",
        f"Location: {event.get('affected_location', 'unspecified')}",
        f"Directly affected: {len(direct)} supplier(s) — {', '.join(direct) or 'none'}",
        f"Downstream exposure: {len(cascade)} supplier(s) — {', '.join(cascade) or 'none'}",
    ]

    if risk.get("network_risk_score") is not None:
        lines.append(f"Network risk score: {risk['network_risk_score']}")
    if risk.get("single_source_exposed"):
        lines.append(f"Single-source exposure: {', '.join(ids(risk['single_source_exposed']))}")
    if isinstance(risk.get("cascade_by_hop"), dict):
        hops = ", ".join(f"hop {h}: {len(ids(values))}" for h, values in risk["cascade_by_hop"].items())
        lines.append(f"Cascade depth: {hops}")

    lines += [
        "",
        "--- assessment ---",
        str(analysis_result.get("risk_summary", "")).strip(),
        "",
        "--- draft report, for your approval ---",
        str(analysis_result.get("draft_report", "")).strip(),
        "",
        "Please review and record APPROVE or REJECT through your team's approval process. "
        "Reply handling and automatic sending are not connected. Nothing has been sent to suppliers.",
    ]

    return {
        "event_id": event.get("id"),
        "headline": headline,
        "severity": event.get("severity"),
        "text": "\n".join(lines),
        "channel": OPENCLAW_CHANNEL,
        "requires_approval": True,
    }


def request_approval(analysis_result: dict, risk: dict | None = None, channel: str | None = None) -> dict:
    """Deliver the draft for human approval. Never raises.

    Returns {"delivered": bool, "channel": str, "tool": str|None, "detail": str,
             "request": {...}} so the API can report honestly whether a human was
    actually reached, rather than assuming.
    """
    global _discovered_tool

    request = build_approval_request(analysis_result, risk)
    target = channel or OPENCLAW_CHANNEL
    request["channel"] = target

    result = {"delivered": False, "channel": target, "tool": None, "detail": "", "request": request}

    if not ENABLED:
        result["detail"] = "OpenClaw disabled (set OPENCLAW_ENABLE=1)"
        return result
    if not HOST_IS_LOCAL:
        result["detail"] = f"refusing non-local OPENCLAW_HOST {OPENCLAW_HOST!r}"
        STATS["last_error"] = result["detail"]
        return result

    # Try the known tool first; only probe alternatives the first time.
    candidates = [_discovered_tool] if _discovered_tool else MESSAGE_TOOL_CANDIDATES
    last_detail = "no tool candidates configured"

    for tool in candidates:
        try:
            status, body = _post(
                "/tools/invoke",
                {"tool": tool, "args": {"channel": target, "text": request["text"]}},
                {"x-openclaw-message-channel": target},
            )
        except BaseException as exc:  # noqa: BLE001
            last_detail = f"{type(exc).__name__}: {exc}"[:160]
            break  # transport is down; trying more names won't help

        body = body if isinstance(body, dict) else {}
        if status == 200 and body.get("ok") is True:
            _discovered_tool = tool
            STATS["message_tool"] = tool
            STATS["approvals_sent"] += 1
            result.update(delivered=True, tool=tool, detail="delivered for approval")
            return result

        if status == 404:
            last_detail = f"tool {tool!r} not available on this gateway"
            continue  # genuinely the wrong name — try the next candidate

        error = body.get("error")
        error = error if isinstance(error, dict) else {}
        last_detail = f"HTTP {status}: {error.get('message') or error.get('type') or 'rejected'}"[:160]
        if status in (401, 403):
            break  # auth or policy, not a naming problem

    STATS["approvals_failed"] += 1
    STATS["last_error"] = last_detail
    result["detail"] = last_detail
    return result


# --- health -----------------------------------------------------------------
def health() -> dict:
    """Is the gateway usable? Never raises, never blocks past the connect timeout."""
    info = {
        "enabled": ENABLED,
        "host": OPENCLAW_HOST,
        "host_is_local": HOST_IS_LOCAL,
        "host_is_loopback": HOST_IS_LOOPBACK,
        "host_allowlisted": HOST_ALLOWLISTED,
        "agent": OPENCLAW_AGENT,
        "channel": OPENCLAW_CHANNEL,
        "transport": _TRANSPORT,
        "authenticated": bool(OPENCLAW_TOKEN),
        "reachable": False,
        "harness_available": False,
        "message_tool": _discovered_tool,
        "stats": dict(STATS),
    }
    if not ENABLED:
        info["detail"] = "disabled (set OPENCLAW_ENABLE=1)"
        return info
    if not HOST_IS_LOCAL:
        info["detail"] = f"non-local host {OPENCLAW_HOST!r} refused without contacting it"
        return info

    try:
        status, _ = _post(
            "/v1/chat/completions",
            {"model": OPENCLAW_AGENT, "messages": [{"role": "user", "content": "ping"}], "stream": False},
        )
    except BaseException as exc:  # noqa: BLE001
        info["detail"] = f"{type(exc).__name__}: {exc}"[:160]
        return info

    info["reachable"] = status not in (0,)
    info["harness_available"] = status == 200
    if status == 404:
        info["detail"] = "gateway up, but chatCompletions is disabled in its config"
    elif status in (401, 403):
        info["detail"] = f"gateway up, auth rejected (HTTP {status})"
    elif status == 200:
        info["detail"] = "gateway up, harness available"
    else:
        info["detail"] = f"gateway returned HTTP {status}"
    return info


# --- self-test --------------------------------------------------------------
if __name__ == "__main__":
    import sys

    HERE = os.path.dirname(os.path.abspath(__file__))
    EXAMPLES = os.path.join(HERE, "..", "..", "contracts", "examples")

    with open(os.path.join(EXAMPLES, "analysis_result.example.json"), encoding="utf-8") as fh:
        ANALYSIS = json.load(fh)

    checks: list[tuple[str, bool, str]] = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        checks.append((label, bool(ok), detail))

    # --- the approval message is a pure function ----------------------------
    risk = {
        "network_risk_score": 0.715,
        "single_source_exposed": ["sup_001", "sup_004"],
        "cascade_by_hop": {"1": ["sup_002", "sup_003"], "2": ["sup_004"]},
    }
    req = build_approval_request(ANALYSIS, risk)
    check("approval: headline states severity", "HIGH" in req["headline"], req["headline"])
    check("approval: names the event", "Port closure" in req["text"])
    check("approval: lists directly affected ids", "sup_001" in req["text"])
    check("approval: lists cascading ids", "sup_002" in req["text"] and "sup_004" in req["text"])
    check("approval: carries the risk score", "0.715" in req["text"])
    check("approval: carries single-source exposure", "Single-source exposure" in req["text"])
    check("approval: carries cascade depth", "hop 1: 2" in req["text"] and "hop 2: 1" in req["text"])
    check("approval: includes the risk summary", "port closure" in req["text"].lower())
    check("approval: includes the full draft report", "Recommended next steps" in req["text"])
    check("approval: asks for a decision", "APPROVE" in req["text"] and "REJECT" in req["text"])
    check("approval: states nothing was sent", "Nothing has been sent" in req["text"])
    check("approval: flagged as requiring approval", req["requires_approval"] is True)
    check("approval: is deterministic", build_approval_request(ANALYSIS, risk) == req)

    # --- degenerate input must not raise ------------------------------------
    for label, bad in (("None", None), ("empty dict", {}), ("event is None", {"event": None}),
                       ("lists are None", {"event": {}, "directly_affected": None, "cascading_affected": None}),
                       ("not a dict", "nonsense")):
        try:
            out = build_approval_request(bad, None)
            check(f"approval survives: {label}", isinstance(out["text"], str) and len(out["text"]) > 20)
        except BaseException as exc:  # noqa: BLE001
            check(f"approval survives: {label}", False, repr(exc))

    # --- the localhost guard ------------------------------------------------
    check("guard: localhost is local", _hostname("http://127.0.0.1:18789") in LOCAL_HOSTNAMES)
    check("guard: a remote host is not", _hostname("http://gateway.example.com:18789") not in LOCAL_HOSTNAMES)
    check("guard: malformed url yields no host", _hostname("nonsense") == "")
    check("guard: loopback reported as loopback", HOST_IS_LOOPBACK == (OPENCLAW_HOSTNAME in LOCAL_HOSTNAMES))
    check("guard: allowlist is exact-match only", not ALLOW_HOST or HOST_ALLOWLISTED == (OPENCLAW_HOSTNAME == ALLOW_HOST))
    check("health distinguishes loopback from allowlisted", {"host_is_loopback", "host_allowlisted"} <= set(health()))

    # --- disabled by default, and it says so --------------------------------
    check("disabled by default unless OPENCLAW_ENABLE is set", ENABLED is False or os.getenv("OPENCLAW_ENABLE"))
    if not ENABLED:
        res = request_approval(ANALYSIS, risk)
        check("disabled: approval reports undelivered", res["delivered"] is False)
        check("disabled: approval explains why", "disabled" in res["detail"].lower(), res["detail"])
        check("disabled: the message is still built", "sup_001" in res["request"]["text"])
        try:
            chat_completion("hello")
            check("disabled: harness raises OpenClawUnavailable", False)
        except OpenClawUnavailable:
            check("disabled: harness raises OpenClawUnavailable", True)

    # --- report -------------------------------------------------------------
    info = health()
    print()
    print("  --- gateway probe ---")
    for key in ("enabled", "host", "host_is_local", "agent", "channel", "authenticated", "reachable", "harness_available"):
        print(f"  {key:18}: {info[key]}")
    print(f"  {'detail':18}: {info.get('detail', '')}")
    print()

    width = max(len(label) for label, _, _ in checks)
    failed = sum(1 for _, ok, _ in checks if not ok)
    for label, ok, detail in checks:
        line = f"  [{'PASS' if ok else 'FAIL'}] {label.ljust(width)}"
        if detail and not ok:
            line += f"   got: {detail}"
        print(line)

    print()
    print(f"  {len(checks) - failed}/{len(checks)} checks passed")
    print()
    print("  --- approval request as delivered to the channel ---")
    print("\n".join("  " + line for line in req["text"].splitlines()))
    sys.exit(1 if failed else 0)
