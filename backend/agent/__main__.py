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


def run_module_suite(filename: str) -> tuple[bool, str]:
    proc = subprocess.run(
        [sys.executable, os.path.join(HERE, filename)],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    tail = [line for line in proc.stdout.splitlines() if "checks passed" in line]
    return proc.returncode == 0, (tail[-1].strip() if tail else "no summary line")


def main() -> int:
    from backend.agent import narrate, propagation

    print("=" * 72)
    print("  backend/agent self-test")
    print("=" * 72)

    failures = 0

    # --- 1. the two module suites -------------------------------------------
    print("\n  module suites")
    for filename in ("propagation.py", "narrate.py"):
        ok, summary = run_module_suite(filename)
        print(f"    [{'PASS' if ok else 'FAIL'}] {filename:<16} {summary}")
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

    # --- 3. what the narration is actually doing right now ------------------
    health = narrate.narration_health()
    print("\n  narration mode")
    print(f"    model      : {health['model']}")
    print(f"    host       : {health['host']}  (local: {health['host_is_local']})")
    print(f"    reachable  : {health['reachable']}")
    print(f"    active mode: {health['mode']}")
    if health.get("error"):
        print(f"    note       : {health['error']}")

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
