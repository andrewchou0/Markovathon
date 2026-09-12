"""Snapshot actual backend seeds and deterministic results for the offline UI.

Run from any directory: python3 frontend/src/fixtures/generate-fixtures.py
Use --check in tests to detect drift without writing files. No services are used.
"""

import argparse
import json
import os
from pathlib import Path
import sys

FIXTURES = Path(__file__).resolve().parent
ROOT = FIXTURES.parents[2]
sys.path.insert(0, str(ROOT))
sys.dont_write_bytecode = True
os.environ["OLLAMA_DISABLE"] = "1"
os.environ["OPENCLAW_ENABLE"] = "0"

from backend.agent.propagation import get_affected_suppliers
from backend.agent.narrate import generate_risk_summary, generate_draft_report


def snapshots():
    suppliers = json.loads((ROOT / "backend/data/seed/suppliers.json").read_text())
    events = json.loads((ROOT / "backend/data/seed/events.json").read_text())
    by_id = {supplier["id"]: supplier for supplier in suppliers}
    analyses, propagation, impacts = {}, {}, {}
    for event in events:
        result = get_affected_suppliers(event, suppliers)
        direct, cascade = result["directly_affected"], result["cascading_affected"]
        analyses[event["id"]] = {
            "event": event,
            "directly_affected": direct,
            "cascading_affected": cascade,
            "risk_summary": generate_risk_summary(event, direct, cascade, suppliers),
            "draft_report": generate_draft_report(event, direct, cascade, suppliers),
        }
        propagation[event["id"]] = result
        impacts[event["id"]] = {
            "eventId": event["id"],
            "networkRiskScore": result["network_risk_score"],
            "directCount": len(direct),
            "cascadingCount": len(cascade),
            "affectedCount": len(direct) + len(cascade),
            "tierCount": max(result["hop_depth"].values(), default=0),
            "singleSourceCount": len(result["single_source_exposed"]),
            "flaggedComplianceCount": sum(by_id[sid]["compliance_status"] != "compliant" for sid in direct + cascade),
            "scope": "Recorded deterministic exposure; not a probability, downtime estimate, or financial loss.",
        }
    return {
        "suppliers.json": suppliers,
        "events.json": events,
        "analysis-results.json": analyses,
        "analysis-result.json": analyses["evt_004"],
        "propagation-results.json": propagation,
        "impact-results.json": impacts,
        "provenance.json": {
            "default_event_id": "evt_004",
            "suppliers_source": "backend/data/seed/suppliers.json",
            "events_source": "backend/data/seed/events.json",
            "propagation_source": "backend.agent.propagation.get_affected_suppliers",
            "narration_source": "backend.agent.narrate deterministic template fallback",
            "narration_mode": "deterministic",
            "delivery_connected": False,
            "rebuild": "python3 frontend/src/fixtures/generate-fixtures.py",
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    changed = []
    for name, content in snapshots().items():
        path = FIXTURES / name
        text = json.dumps(content, indent=2, ensure_ascii=False) + "\n"
        if args.check:
            if not path.exists() or json.loads(path.read_text()) != content:
                changed.append(name)
        else:
            path.write_text(text)
    if changed:
        sys.exit("Demo fixtures differ from the backend: " + ", ".join(changed) + ". Run python3 frontend/src/fixtures/generate-fixtures.py")
    print("Backend seed, propagation, and template fixtures match." if args.check else "Generated all five backend demo scenarios.")


if __name__ == "__main__":
    main()
