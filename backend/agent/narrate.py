"""Natural-language generation for the two text fields in AnalysisResult.

The LLM writes prose here and nothing else. It is never asked which suppliers
are affected, never asked to do arithmetic, and never asked for JSON we then
depend on — propagation.py already decided all of that, deterministically, and
this module only describes the answer it was handed.

THE CONTRACT THIS MODULE KEEPS: generate_risk_summary() and
generate_draft_report() always return a useful non-empty string. They do not
raise, and they do not return an apology, no matter what the model, the network
or the input does. If Ollama is unreachable, slow, or produces something that
fails the quality gate, a deterministic template narrator built from the same
structured facts takes over. The demo cannot go blank.

Run it standalone:  python backend/agent/narrate.py
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any

# --- configuration ----------------------------------------------------------
# Per contracts/llm.md this is the ONE place the host and model are named.
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.6:35b")
OLLAMA_ENDPOINT = f"{OLLAMA_HOST.rstrip('/')}/api/generate"

# Reading the host from the environment is what contracts/llm.md asks for, but it
# means a stray `export OLLAMA_HOST=http://some-box:11434` in someone's shell
# silently turns our on-premises agent into a remote API client. That is not
# hypothetical — it was already set that way on a dev machine here. So the host is
# verified, not trusted: a non-local host is refused and we narrate deterministically
# instead, the same way Person 4 refuses a non-local MONGO_URI.
LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "::1", "[::1]"}


def _host_of(url: str) -> str:
    from urllib.parse import urlparse

    try:
        return (urlparse(url).hostname or "").lower()
    except BaseException:  # noqa: BLE001
        return ""


OLLAMA_HOSTNAME = _host_of(OLLAMA_HOST)
HOST_IS_LOCAL = OLLAMA_HOSTNAME in LOCAL_HOSTNAMES

# A 35B model on local hardware is not instant. Connect fast, read patiently.
CONNECT_TIMEOUT_S = float(os.getenv("OLLAMA_CONNECT_TIMEOUT", "3"))
READ_TIMEOUT_S = float(os.getenv("OLLAMA_READ_TIMEOUT", "90"))

# Low temperature plus a fixed seed: the same demo event reads the same way on
# every take, which matters when you are rehearsing a script against it.
TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.3"))
SEED = int(os.getenv("OLLAMA_SEED", "7"))

# Set OLLAMA_DISABLE=1 to force the deterministic narrator. Person 4 can use
# this to rehearse the fallback, and it makes this module testable offline.
DISABLED = os.getenv("OLLAMA_DISABLE", "").strip().lower() in {"1", "true", "yes"}

SUMMARY_SENTENCES = 3
MIN_ACCEPTABLE_CHARS = 40

# Observability for Person 2's API and Person 4's status badge.
STATS: dict[str, Any] = {
    "llm_calls": 0,
    "llm_failures": 0,
    "fallbacks_used": 0,
    "last_mode": None,        # "llm" | "deterministic"
    "last_latency_s": None,
    "last_error": None,
}


class LLMUnavailable(RuntimeError):
    """Raised internally when the model cannot be used. Never escapes this module."""


# --- transport --------------------------------------------------------------
# httpx is preferred because it is in requirements.txt AND because Person 4's
# offline hook monkeypatches it — routing our only network call through the
# patched library is what lets the "external calls blocked" badge actually speak
# to the LLM path. urllib is a stdlib fallback so this file still runs on a
# machine where nothing has been pip-installed yet.
try:  # pragma: no cover - import-time branch
    import httpx

    _TRANSPORT = "httpx"
except ImportError:  # pragma: no cover
    httpx = None
    _TRANSPORT = "urllib"


def _post_json(url: str, payload: dict, read_timeout: float) -> dict:
    body = json.dumps(payload).encode("utf-8")
    if _TRANSPORT == "httpx":
        timeout = httpx.Timeout(read_timeout, connect=CONNECT_TIMEOUT_S)
        response = httpx.post(url, content=body, headers={"Content-Type": "application/json"}, timeout=timeout)
        response.raise_for_status()
        return response.json()

    import urllib.error
    import urllib.request

    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=read_timeout) as response:  # noqa: S310 - localhost only
        return json.loads(response.read().decode("utf-8"))


def _get_json(url: str, read_timeout: float) -> dict:
    """GET, for Ollama's /api/tags. It is GET-only — POSTing to it returns 404,
    which would make a perfectly healthy Ollama look unreachable."""
    if _TRANSPORT == "httpx":
        timeout = httpx.Timeout(read_timeout, connect=CONNECT_TIMEOUT_S)
        response = httpx.get(url, timeout=timeout)
        response.raise_for_status()
        return response.json()

    import urllib.request

    with urllib.request.urlopen(url, timeout=read_timeout) as response:  # noqa: S310 - localhost only
        return json.loads(response.read().decode("utf-8"))


def _is_timeout(exc: BaseException) -> bool:
    name = type(exc).__name__.lower()
    return "timeout" in name or "timeout" in str(exc).lower()


def _call_ollama(prompt: str, num_predict: int) -> str:
    """One prompt in, cleaned prose out. Raises LLMUnavailable on any problem."""
    # These two refusals happen before any socket is opened, so they set
    # last_error themselves — the per-attempt handler below never sees them.
    if DISABLED:
        STATS["last_error"] = "disabled via OLLAMA_DISABLE"
        raise LLMUnavailable(STATS["last_error"])
    if not HOST_IS_LOCAL:
        STATS["last_error"] = (
            f"refusing non-local OLLAMA_HOST {OLLAMA_HOST!r} — this project runs "
            "entirely on localhost; unset OLLAMA_HOST or point it at localhost:11434"
        )
        raise LLMUnavailable(STATS["last_error"])

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": TEMPERATURE,
            "seed": SEED,
            "num_predict": num_predict,
        },
    }

    last_exc: BaseException | None = None
    # Two attempts, but only for connection-level failures. Retrying a timeout
    # would double an already-too-long wait in front of an audience.
    for attempt in (1, 2):
        started = time.monotonic()
        try:
            STATS["llm_calls"] += 1
            data = _post_json(OLLAMA_ENDPOINT, payload, READ_TIMEOUT_S)
            STATS["last_latency_s"] = round(time.monotonic() - started, 2)
            text = data.get("response")
            if not isinstance(text, str) or not text.strip():
                raise LLMUnavailable("model returned an empty response")
            return text
        except BaseException as exc:  # noqa: BLE001 - deliberate: nothing may escape
            last_exc = exc
            STATS["llm_failures"] += 1
            STATS["last_error"] = f"{type(exc).__name__}: {exc}"[:200]
            if attempt == 2 or _is_timeout(exc):
                break
            time.sleep(0.25)

    raise LLMUnavailable(str(last_exc) or "unknown failure")


# --- output sanitizing ------------------------------------------------------
_FENCE = re.compile(r"^\s*```[a-zA-Z]*\s*|\s*```\s*$")
_PREAMBLE = re.compile(
    r"^\s*(sure[,!.]?|certainly[,!.]?|of course[,!.]?|here(?:'s| is| are)[^:\n]*:|"
    r"below is[^:\n]*:|risk summary:|summary:|draft(?: report)?:)\s*",
    re.IGNORECASE,
)
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")


def _clean(text: str) -> str:
    """Strip the wrappers models like to add, without touching the prose.

    Fences and preambles have to be stripped alternately rather than in one pass:
    real output nests them ("Certainly. Here's the draft: ```markdown Summary: ..."),
    so removing fences first leaves the fence buried behind two preambles, and
    removing preambles first leaves them buried behind a fence. Looping until the
    text stops changing handles any order and any depth.
    """
    text = _THINK.sub("", text).strip()  # reasoning models may emit a think block
    previous = None
    while previous != text:
        previous = text
        text = _FENCE.sub("", text).strip()
        text = _PREAMBLE.sub("", text).strip()
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _clamp_sentences(text: str, limit: int) -> str:
    parts = _SENTENCE_END.split(text)
    if len(parts) <= limit:
        return text
    return " ".join(parts[:limit]).strip()


def _quality_gate(text: str, expected_names: list[str]) -> str:
    """Reject output that isn't usable, so the fallback can take over.

    The name check is a cheap hallucination guard: propagation.py already knows
    exactly which suppliers are involved, so prose that manages to mention none
    of them is describing something that didn't happen.
    """
    if len(text) < MIN_ACCEPTABLE_CHARS:
        raise LLMUnavailable(f"output too short ({len(text)} chars)")
    if expected_names:
        lowered = text.lower()
        if not any(name.lower() in lowered for name in expected_names):
            raise LLMUnavailable("output mentions none of the affected suppliers")
    return text


# --- fact assembly ----------------------------------------------------------
def _plural(count: int, singular: str, plural: str | None = None) -> str:
    return f"{count} {singular if count == 1 else (plural or singular + 's')}"


def _headline(text: str) -> str:
    """First clause of an event description, for use in a subject line.

    Fixture descriptions carry their own em dash ("Port closure, Gulf Coast,
    48hrs — inbound alloy shipments held"), so embedding one whole inside another
    dashed phrase produces an unreadable triple-dash sentence.
    """
    for separator in (" — ", " – ", " -- ", " - "):
        if separator in text:
            return text.split(separator)[0].strip()
    return text.strip()


def _describe(supplier: dict) -> str:
    name = supplier.get("name") or supplier.get("id") or "an unnamed supplier"
    part = supplier.get("part_supplied")
    return f"{name} ({part})" if part else str(name)


def _lookup(suppliers: Any) -> dict[str, dict]:
    if not isinstance(suppliers, (list, tuple)):
        return {}
    return {
        s["id"]: s
        for s in suppliers
        if isinstance(s, dict) and isinstance(s.get("id"), str) and s["id"]
    }


def _records(ids: Any, by_id: dict[str, dict]) -> list[dict]:
    if not isinstance(ids, (list, tuple)):
        return []
    return [by_id[i] for i in ids if isinstance(i, str) and i in by_id]


def _facts(event: Any, direct_ids: Any, cascade_ids: Any, suppliers: Any) -> dict:
    """Everything both prompts and both fallbacks are built from.

    Resolving ids to names happens HERE, in Python. The model only ever sees
    resolved facts, which is why it cannot invent a supplier.
    """
    event = event if isinstance(event, dict) else {}
    by_id = _lookup(suppliers)
    direct = _records(direct_ids, by_id)
    cascade = _records(cascade_ids, by_id)
    affected = direct + cascade

    single_source = [s for s in affected if s.get("single_source") is True]
    non_compliant = [s for s in affected if s.get("compliance_status") in {"at_risk", "non_compliant"}]

    def financial(supplier: dict) -> float:
        value = supplier.get("financial_risk_score")
        return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.0

    return {
        "event_type": event.get("type") or "disruption",
        "event_description": event.get("description") or "an unspecified disruption",
        "event_location": event.get("affected_location") or "an unspecified location",
        "severity": event.get("severity") or "medium",
        "timestamp": event.get("timestamp") or "",
        "direct": direct,
        "cascade": cascade,
        "affected": affected,
        "single_source": single_source,
        "non_compliant": non_compliant,
        "most_fragile": max(affected, key=financial) if affected else None,
        "names": [str(s.get("name")) for s in affected if s.get("name")],
    }


def _fact_block(facts: dict) -> str:
    """The structured brief handed to the model, as plain text."""
    lines = [
        f"EVENT: {facts['event_description']}",
        f"EVENT TYPE: {facts['event_type']}",
        f"SEVERITY: {facts['severity']}",
        f"LOCATION: {facts['event_location']}",
        "",
        "DIRECTLY AFFECTED (hit at the point of disruption):",
    ]
    lines += [
        f"  - {_describe(s)} | location: {s.get('location')} | "
        f"single source: {'yes' if s.get('single_source') else 'no'} | "
        f"compliance: {s.get('compliance_status')} | "
        f"financial risk: {s.get('financial_risk_score')}"
        for s in facts["direct"]
    ] or ["  - none"]
    lines += ["", "DOWNSTREAM SUPPLIERS AFFECTED BY CASCADE:"]
    lines += [
        f"  - {_describe(s)} | single source: {'yes' if s.get('single_source') else 'no'} | "
        f"compliance: {s.get('compliance_status')}"
        for s in facts["cascade"]
    ] or ["  - none"]
    return "\n".join(lines)


_RULES = (
    "Rules you must follow:\n"
    "- Use ONLY the suppliers named above. Never invent a supplier, part, "
    "number, date or location.\n"
    "- Do not add a preamble, a heading, a sign-off from yourself, or "
    "markdown formatting.\n"
    "- Write in a calm, factual tone for a supply chain compliance team."
)


# --- deterministic fallback narrators ---------------------------------------
# These are not filler. They are what appears on screen if the model is down at
# demo time, so they are written to be presentable on their own.
def _fallback_summary(facts: dict) -> str:
    if not facts["affected"]:
        return (
            f"A {facts['severity']}-severity {facts['event_type']} event was assessed: "
            f"{facts['event_description']}. No suppliers in the monitored network are "
            f"located in {facts['event_location']}, and no downstream dependencies were "
            "triggered, so no exposure is recorded for this event."
        )

    direct = facts["direct"]
    lead = _describe(direct[0]) if direct else _describe(facts["affected"][0])
    sentences = [
        f"A {facts['severity']}-severity {facts['event_type']} event "
        f"(\u201c{facts['event_description']}\u201d) has disrupted {lead}"
        + (
            ", a single-source supplier with no qualified alternate."
            if direct and direct[0].get("single_source")
            else "."
        )
    ]

    if facts["cascade"]:
        cascade_names = ", ".join(_describe(s) for s in facts["cascade"][:3])
        more = len(facts["cascade"]) - 3
        sentences.append(
            f"The disruption propagates to {_plural(len(facts['cascade']), 'downstream supplier')}: "
            f"{cascade_names}{f', and {more} more' if more > 0 else ''}."
        )
    else:
        sentences.append("No downstream dependents draw on the affected supply, so the impact is contained at the point of disruption.")

    risk_note = []
    if facts["single_source"]:
        risk_note.append(f"{_plural(len(facts['single_source']), 'single-source dependency', 'single-source dependencies')} in the affected path")
    if facts["non_compliant"]:
        risk_note.append(f"{_plural(len(facts['non_compliant']), 'supplier')} already flagged on compliance")
    if risk_note:
        sentences.append("Principal concerns are " + " and ".join(risk_note) + ".")

    return " ".join(sentences[:SUMMARY_SENTENCES])


def _fallback_report(facts: dict) -> str:
    direct_lines = [f"  - {_describe(s)}" for s in facts["direct"]] or ["  - none identified"]
    cascade_lines = [f"  - {_describe(s)}" for s in facts["cascade"]] or ["  - none identified"]

    actions = [
        "  1. Confirm on-hand inventory and committed orders for each part listed above.",
        "  2. Begin qualification review for an alternate source where the affected supplier is single-source.",
    ]
    if facts["non_compliant"]:
        actions.append("  3. Review the compliance status of the flagged suppliers before the next filing window.")
    actions.append(f"  {len(actions) + 1}. Re-assess once the disruption window closes.")

    return "\n".join(
        [
            "To: Compliance Contact",
            f"Subject: Supply disruption — {_headline(facts['event_description'])} — action required",
            "",
            f"A {facts['severity']}-severity {facts['event_type']} event has been detected affecting "
            f"{facts['event_location']}.",
            "",
            "Directly affected:",
            *direct_lines,
            "",
            "Downstream exposure:",
            *cascade_lines,
            "",
            "Recommended next steps:",
            *actions,
            "",
            "This draft was prepared automatically for human review and has not been sent.",
        ]
    )


def _ensure_email_header(text: str, facts: dict) -> str:
    """Guarantee the two header lines an email needs.

    A model asked for an email will sometimes return bare prose, or a body with
    no Subject. Person 3 renders this field verbatim as an email, so a missing
    header reads as a broken feature on screen. Found by end-to-end testing:
    the model path was returning a To: line and no Subject at all.
    """
    lines = text.splitlines() or [""]

    if not lines[0].strip().lower().startswith("to:"):
        lines.insert(0, "To: Compliance Contact")

    if not any(line.strip().lower().startswith("subject:") for line in lines[:4]):
        subject = f"Subject: Supply disruption — {_headline(facts['event_description'])} — action required"
        lines.insert(1, subject)

    # A blank line between headers and body, so it renders as an email.
    if len(lines) > 2 and lines[2].strip():
        lines.insert(2, "")

    return "\n".join(lines)


def _finish(text: str, mode: str) -> str:
    STATS["last_mode"] = mode
    if mode == "deterministic":
        STATS["fallbacks_used"] += 1
    return text


# --- public API -------------------------------------------------------------
def generate_risk_summary(event, directly_affected, cascading_affected, suppliers) -> str:
    """2-3 sentences describing the disruption. Always returns prose."""
    facts = _facts(event, directly_affected, cascading_affected, suppliers)
    prompt = (
        "You are a supply chain risk analyst. Using only the facts below, write "
        f"{SUMMARY_SENTENCES - 1} to {SUMMARY_SENTENCES} sentences of prose summarising "
        "the disruption, which suppliers it affects, and why it matters. Name the "
        "suppliers explicitly.\n\n"
        f"{_fact_block(facts)}\n\n{_RULES}"
    )
    try:
        text = _quality_gate(_clean(_call_ollama(prompt, num_predict=220)), facts["names"])
        return _finish(_clamp_sentences(text, SUMMARY_SENTENCES), "llm")
    except BaseException:  # noqa: BLE001 - the whole point: never fail
        return _finish(_fallback_summary(facts), "deterministic")


def generate_draft_report(event, directly_affected, cascading_affected, suppliers) -> str:
    """An email draft for a compliance contact. Always returns prose."""
    facts = _facts(event, directly_affected, cascading_affected, suppliers)
    prompt = (
        "You are a supply chain risk analyst drafting an internal email for a "
        "colleague to review before sending. Using only the facts below, write the "
        "email. Start with a 'To: Compliance Contact' line, then a 'Subject:' line, "
        "then the body. The body must state what happened, list the affected "
        "suppliers by name, and give 3 to 4 numbered recommended next steps. End "
        "with a line noting the draft is for human review and has not been sent.\n\n"
        f"{_fact_block(facts)}\n\n{_RULES}"
    )
    try:
        text = _quality_gate(_clean(_call_ollama(prompt, num_predict=520)), facts["names"])
        return _finish(_ensure_email_header(text, facts), "llm")
    except BaseException:  # noqa: BLE001
        return _finish(_fallback_report(facts), "deterministic")


def narration_health(probe: bool = True) -> dict:
    """Is the model actually usable right now? For /api/offline-status.

    Never raises, and never blocks for longer than the connect timeout.
    """
    health = {
        "model": OLLAMA_MODEL,
        "host": OLLAMA_HOST,
        "host_is_local": HOST_IS_LOCAL,
        "transport": _TRANSPORT,
        "disabled": DISABLED,
        "reachable": False,
        "model_present": False,
        "mode": "deterministic",
        "stats": dict(STATS),
    }
    if not HOST_IS_LOCAL:
        health["error"] = (
            f"OLLAMA_HOST {OLLAMA_HOST!r} is not local — refused without contacting it"
        )
        return health
    if DISABLED or not probe:
        return health
    try:
        data = _get_json(f"{OLLAMA_HOST.rstrip('/')}/api/tags", CONNECT_TIMEOUT_S)
    except BaseException as exc:  # noqa: BLE001
        health["error"] = f"{type(exc).__name__}: {exc}"[:200]
        return health

    health["reachable"] = True
    names = [m.get("name", "") for m in data.get("models", []) if isinstance(m, dict)]
    base = OLLAMA_MODEL.split(":")[0]
    health["model_present"] = any(n == OLLAMA_MODEL or n.startswith(base) for n in names)
    health["available_models"] = names
    health["mode"] = "llm" if health["model_present"] else "deterministic"
    return health


# --- self-test --------------------------------------------------------------
if __name__ == "__main__":
    import sys

    HERE = os.path.dirname(os.path.abspath(__file__))
    EXAMPLES = os.path.join(HERE, "..", "..", "contracts", "examples")

    def load(name: str) -> Any:
        with open(os.path.join(EXAMPLES, name), encoding="utf-8") as fh:
            return json.load(fh)

    suppliers = load("suppliers.example.json")
    event = load("events.example.json")[0]
    direct, cascade = ["sup_001"], ["sup_002", "sup_003", "sup_004"]

    checks: list[tuple[str, bool, str]] = []

    def check(label: str, condition: bool, detail: str = "") -> None:
        checks.append((label, bool(condition), detail))

    # --- the sanitizer, unit by unit ---------------------------------------
    check("strips code fences", _clean("```\nhello there friend\n```") == "hello there friend")
    check("strips a preamble", _clean("Sure! Here is the summary: Gulf went down.") == "Gulf went down.")
    check("strips stacked preambles", "here is" not in _clean("Certainly. Here's the draft: Body text.").lower())
    check("strips a think block", _clean("<think>musing</think>Real output.") == "Real output.")
    check(
        "strips a fence nested behind preambles",
        _clean("Certainly.\n\nHere's the draft:\n\n```markdown\nSummary:   Real body text here.\n```")
        == "Real body text here.",
        _clean("Certainly.\n\nHere's the draft:\n\n```markdown\nSummary:   Real body text here.\n```"),
    )
    check(
        "strips a preamble nested inside a fence",
        _clean("```\nSure! Here is the summary: Real body text here.\n```") == "Real body text here.",
    )
    check("collapses whitespace", _clean("a   b\n\n\n\nc") == "a b\n\nc")
    check("clamps to 3 sentences", len(_SENTENCE_END.split(_clamp_sentences("One. Two. Three. Four. Five.", 3))) == 3)
    check("keeps short text intact", _clamp_sentences("Only one.", 3) == "Only one.")
    check("headline trims at an em dash", _headline("Port closure, Gulf Coast — details") == "Port closure, Gulf Coast")
    check("headline leaves clean text alone", _headline("Port closure") == "Port closure")

    # --- the localhost guard ------------------------------------------------
    check("localhost is accepted", _host_of("http://localhost:11434") == "localhost")
    check("loopback ip is accepted", _host_of("http://127.0.0.1:11434") in LOCAL_HOSTNAMES)
    check("a remote hostname is not local", _host_of("http://chimmychonga:11434") not in LOCAL_HOSTNAMES)
    check("a malformed url yields no host", _host_of("not a url") == "")

    # --- the quality gate --------------------------------------------------
    try:
        _quality_gate("too short", ["Gulf Precision Castings"])
        check("gate rejects short output", False)
    except LLMUnavailable:
        check("gate rejects short output", True)
    try:
        _quality_gate("A long and plausible paragraph that never names any supplier at all.", ["Gulf Precision Castings"])
        check("gate catches hallucinated prose", False)
    except LLMUnavailable:
        check("gate catches hallucinated prose", True)
    check(
        "gate passes good output",
        _quality_gate("Gulf Precision Castings has been disrupted by the port closure event.", ["Gulf Precision Castings"]).startswith("Gulf"),
    )

    # --- the fallback path, forced ------------------------------------------
    # This is the path that runs if Ollama is down at demo time, so it gets the
    # same scrutiny as the real one.
    DISABLED = True
    summary = generate_risk_summary(event, direct, cascade, suppliers)
    report = generate_draft_report(event, direct, cascade, suppliers)

    check("fallback summary is non-empty prose", len(summary) > 120, f"{len(summary)} chars")
    check("fallback summary names the direct supplier", "Gulf Precision Castings" in summary)
    check("fallback summary names a cascading supplier", "Delta Assembly Works" in summary)
    check("fallback summary respects the sentence budget", len(_SENTENCE_END.split(summary)) <= SUMMARY_SENTENCES, summary)
    check("fallback summary has no placeholder text", not any(w in summary.lower() for w in ("todo", "lorem", "none)", "n/a")))
    check("fallback summary avoids nested dashes", summary.count(" — ") <= 1, summary)
    check("fallback subject avoids nested dashes", [l for l in report.splitlines() if l.startswith("Subject:")][0].count("—") == 2)
    check("fallback report looks like an email", report.startswith("To: ") and "Subject:" in report)
    check("fallback report lists direct and cascade", "Gulf Precision Castings" in report and "Cascade Final Assembly" in report)
    check("fallback report has numbered actions", all(f"  {n}." in report for n in (1, 2, 3)))
    check("fallback report flags itself as a draft", "has not been sent" in report)
    check("fallback is deterministic", generate_risk_summary(event, direct, cascade, suppliers) == summary)
    check("mode is reported as deterministic", STATS["last_mode"] == "deterministic")

    # --- the email header guarantee -----------------------------------------
    _f = _facts(event, direct, cascade, suppliers)
    bare = _ensure_email_header("Gulf Precision Castings is down.", _f)
    check("header: To: line added to bare prose", bare.splitlines()[0].startswith("To: "))
    check("header: Subject line added to bare prose", bare.splitlines()[1].startswith("Subject: "))
    check("header: blank line separates headers from body", bare.splitlines()[2] == "")
    check("header: body survives intact", "Gulf Precision Castings is down." in bare)
    already = _ensure_email_header("To: Someone\nSubject: Existing\n\nBody.", _f)
    check("header: existing headers are not duplicated", already.count("To:") == 1 and already.count("Subject:") == 1)
    check("header: existing subject is preserved", "Subject: Existing" in already)
    partial = _ensure_email_header("To: Someone\n\nBody text.", _f)
    check("header: missing subject is filled in alongside an existing To:", partial.count("To:") == 1 and "Subject: Supply disruption" in partial)
    check("header: subject avoids nested dashes", partial.splitlines()[1].count("—") == 2, partial.splitlines()[1])
    check("header: survives empty input", _ensure_email_header("", _f).splitlines()[0].startswith("To: "))

    # --- degenerate inputs must still produce prose -------------------------
    hard_cases = [
        ("no suppliers affected", event, [], [], suppliers),
        ("empty supplier list", event, ["sup_001"], [], []),
        ("unknown ids", event, ["sup_ghost"], ["sup_phantom"], suppliers),
        ("event is None", None, direct, cascade, suppliers),
        ("everything None", None, None, None, None),
        ("ids are not lists", event, "sup_001", 42, suppliers),
        ("suppliers malformed", event, direct, cascade, [None, {}, {"id": "sup_001"}]),
        ("event missing fields", {}, direct, cascade, suppliers),
    ]
    for label, evt_in, d_in, c_in, s_in in hard_cases:
        try:
            s_out = generate_risk_summary(evt_in, d_in, c_in, s_in)
            r_out = generate_draft_report(evt_in, d_in, c_in, s_in)
            ok = isinstance(s_out, str) and isinstance(r_out, str) and len(s_out) > 60 and len(r_out) > 60
            check(f"survives: {label}", ok, f"summary {len(s_out)} chars")
        except BaseException as exc:  # noqa: BLE001
            check(f"survives: {label}", False, repr(exc))

    DISABLED = False

    # --- live model, if it happens to be there ------------------------------
    health = narration_health()
    print()
    print("  --- live model probe ---")
    print(f"  host      : {health['host']}  (transport: {health['transport']})")
    print(f"  host local: {health['host_is_local']}")
    print(f"  model     : {health['model']}")
    print(f"  reachable : {health['reachable']}")
    print(f"  present   : {health['model_present']}")
    print(f"  mode      : {health['mode']}")
    if health.get("error"):
        print(f"  error     : {health['error']}")

    if not health["host_is_local"]:
        print()
        print("  !! OLLAMA_HOST in this environment is NOT localhost. The call was")
        print("     refused rather than sent, and narration fell back to the")
        print("     deterministic path. Unset OLLAMA_HOST or set it to")
        print("     http://localhost:11434 to use the model.")

    if health["mode"] == "llm":
        started = time.monotonic()
        live = generate_risk_summary(event, direct, cascade, suppliers)
        elapsed = time.monotonic() - started
        print(f"\n  live summary ({elapsed:.1f}s, mode={STATS['last_mode']}):\n  {live}\n")
        check("live call used the model", STATS["last_mode"] == "llm", str(STATS["last_error"]))
        check("live output names a real supplier", any(n in live for n in ("Gulf", "Delta", "Northline", "Cascade")))
    else:
        print("\n  Ollama unavailable here — the deterministic narrator covers this case,")
        print("  which is exactly the scenario the fallback exists for. Re-run this file")
        print("  on a machine with `ollama serve` + `ollama pull qwen3.6:35b` to time the")
        print("  live path.\n")

    # --- report -------------------------------------------------------------
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
    print("  --- deterministic narrator output (what shows if the model is down) ---")
    print()
    print("  RISK SUMMARY:")
    print("  " + summary)
    print()
    print("  DRAFT REPORT:")
    print("\n".join("  " + line for line in report.splitlines()))

    sys.exit(1 if failed else 0)
