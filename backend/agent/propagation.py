"""Deterministic risk propagation.

This module decides WHICH suppliers a disruption hits and HOW it cascades. That
decision is plain Python on purpose (see CLAUDE.md): it has to be reliable and
debuggable, and the demo must never be able to name the wrong supplier because a
model guessed. Natural language lives next door in narrate.py.

Guarantees this module makes, and that its __main__ suite checks:
  * no network, no database, no LLM, no third-party imports
  * pure functions — same input always produces byte-identical output
  * never raises on malformed input; bad data is reported in ["diagnostics"]
  * a directly affected supplier is never also listed as cascading

Run it standalone:  python backend/agent/propagation.py
"""

from __future__ import annotations

import re
from collections import deque
from typing import Any

# --- tuning constants -------------------------------------------------------
# One hop is all the demo strictly needs, but a bounded breadth-first walk costs
# a few lines more and gives Person 3 the hop number their staggered reveal is
# keyed to. The bound is what keeps a cyclical fixture from spinning forever.
CASCADE_MAX_DEPTH = 4

# Severity of the event itself, before any supplier-specific amplification.
SEVERITY_WEIGHT = {"low": 0.30, "medium": 0.60, "high": 1.00}

# Impact decays as it travels downstream — a second-hop supplier feels less than
# the supplier that was hit head-on.
HOP_DECAY = 0.60

# A supplier with no qualified alternate absorbs the hit instead of routing
# around it, so exposure is amplified rather than diluted.
SINGLE_SOURCE_MULTIPLIER = 1.50

# A supplier already off-side on compliance is the fragile link in a disruption.
COMPLIANCE_MULTIPLIER = {"compliant": 1.00, "at_risk": 1.20, "non_compliant": 1.40}

# Segments shorter than this are ignored when falling back to segment matching,
# so a two-letter state code can't spuriously match an unrelated location.
MIN_SEGMENT_LEN = 3

_PUNCT = re.compile(r"[^a-z0-9, ]+")
_SPACE = re.compile(r"\s+")


# --- location matching ------------------------------------------------------
def normalize_location(value: Any) -> str:
    """Lowercase, strip punctuation, collapse whitespace. Total on any input."""
    if not isinstance(value, str):
        return ""
    text = _PUNCT.sub(" ", value.lower())
    return _SPACE.sub(" ", text).strip(" ,")


def _segments(normalized: str) -> set[str]:
    return {
        seg.strip()
        for seg in normalized.split(",")
        if len(seg.strip()) >= MIN_SEGMENT_LEN
    }


def location_matches(supplier_location: Any, event_location: Any) -> str | None:
    """Return HOW the two locations matched, or None if they don't.

    Three tiers, tried in order, each narrower than fuzzy string distance so the
    result stays explainable when someone asks why a supplier lit up:
      "exact"     — identical after normalization
      "substring" — one contains the other ("Gulf Coast" vs "Gulf Coast, LA")
      "segment"   — they share a comma-separated part of length >= 3
    """
    sup = normalize_location(supplier_location)
    evt = normalize_location(event_location)
    if not sup or not evt:
        return None
    if sup == evt:
        return "exact"
    if sup in evt or evt in sup:
        return "substring"
    for a, b in ((sup, evt), (evt, sup)):
        for seg in _segments(a):
            # Whole-word so a segment can match inside a longer phrase
            # ("Gulf Coast" in "Port of Gulf Coast") without matching a
            # coincidental substring of an unrelated word.
            if re.search(rf"\b{re.escape(seg)}\b", b):
                return "segment"
    return None


# --- supplier indexing ------------------------------------------------------
def index_suppliers(suppliers: Any) -> dict[str, dict]:
    """Map id -> supplier, skipping anything that isn't a usable record."""
    if not isinstance(suppliers, (list, tuple)):
        return {}
    out: dict[str, dict] = {}
    for s in suppliers:
        if isinstance(s, dict) and isinstance(s.get("id"), str) and s["id"]:
            out[s["id"]] = s
    return out


def _dependents(supplier: dict) -> list[str]:
    raw = supplier.get("downstream_dependents")
    if not isinstance(raw, (list, tuple)):
        return []
    return [d for d in raw if isinstance(d, str) and d]


def resolve(ids: list[str], by_id: dict[str, dict]) -> list[dict]:
    """Ids -> supplier records, preserving order and dropping unknown ids.

    narrate.py uses this so prompts always talk about names and parts rather
    than opaque ids.
    """
    return [by_id[i] for i in ids if i in by_id]


# --- scoring ----------------------------------------------------------------
# The worst exposure the model can produce: a high-severity direct hit on a
# single-source, non-compliant supplier already carrying maximum financial risk.
# Scores are expressed as a share of this, which keeps them inside 0.0-1.0 by
# construction. Clamping with min(1.0, ...) would instead flatten the worst few
# suppliers into a tie at 1.0 and destroy the ranking the demo relies on.
_MAX_RAW_EXPOSURE = (
    max(SEVERITY_WEIGHT.values())
    * SINGLE_SOURCE_MULTIPLIER
    * max(COMPLIANCE_MULTIPLIER.values())
    * 2.0  # financial factor is 1.0 + financial_risk_score, so at most 2.0
)


def _raw_exposure(supplier: dict, severity: str, depth: int) -> float:
    """Unbounded exposure: event severity, decayed by distance, then amplified
    by the things that make a specific supplier fragile."""
    exposure = SEVERITY_WEIGHT.get(severity, SEVERITY_WEIGHT["medium"])
    exposure *= HOP_DECAY ** max(0, depth)

    if supplier.get("single_source") is True:
        exposure *= SINGLE_SOURCE_MULTIPLIER

    exposure *= COMPLIANCE_MULTIPLIER.get(supplier.get("compliance_status"), 1.0)

    financial = supplier.get("financial_risk_score")
    if isinstance(financial, (int, float)) and not isinstance(financial, bool):
        exposure *= 1.0 + max(0.0, min(1.0, float(financial)))

    return exposure


def _impact_score(supplier: dict, severity: str, depth: int) -> float:
    """Deterministic 0.0-1.0 exposure score. Same inputs, same score, always."""
    return round(_raw_exposure(supplier, severity, depth) / _MAX_RAW_EXPOSURE, 3)


def _network_risk(scores: dict[str, float]) -> float:
    """Aggregate the whole event into one headline number.

    A probability-style union rather than a max: every additional exposed
    supplier raises it, but it can never exceed 1.0. A max would report the same
    figure whether one supplier was hit or fifteen, which is the wrong story for
    a cascade.
    """
    remaining = 1.0
    for score in scores.values():
        remaining *= 1.0 - score
    return round(1.0 - remaining, 3)


# --- the entry point --------------------------------------------------------
def get_affected_suppliers(event: Any, suppliers: Any) -> dict:
    """Work out who is hit by ``event`` and what cascades from there.

    Contract keys (relied on by backend/api — do not rename):
      directly_affected  — ids whose location matched event.affected_location
      cascading_affected — ids reached via downstream_dependents, flattened in
                           hop order; never overlaps directly_affected

    Additive keys, safe for the API to ignore, useful to the frontend and to
    narrate.py:
      hop_depth           — id -> 0 for direct, 1..N for each cascade hop
      cascade_by_hop      — {"1": [ids], "2": [ids]}, drives the staggered reveal
      impact_scores       — id -> 0.0-1.0 deterministic exposure score
      network_risk_score  — one headline 0.0-1.0 number for the whole event
      single_source_exposed — affected ids with no qualified alternate
      ranked_affected     — every affected id, most exposed first
      diagnostics         — match reasons, plus any bad data we skipped
    """
    event = event if isinstance(event, dict) else {}
    by_id = index_suppliers(suppliers)
    severity = event.get("severity")
    if severity not in SEVERITY_WEIGHT:
        severity = "medium"

    # --- hop 0: direct location hits, in fixture order for stable output ----
    direct: list[str] = []
    matched_by: dict[str, str] = {}
    for sid, supplier in by_id.items():
        how = location_matches(supplier.get("location"), event.get("affected_location"))
        if how:
            direct.append(sid)
            matched_by[sid] = how

    # --- hops 1..N: breadth-first over downstream_dependents ----------------
    # `seen` carries the direct hits from the start, which is what makes the
    # "a direct hit is never also a cascade" guarantee hold, and what stops a
    # cyclical fixture (A -> B -> A) from looping.
    hop_depth: dict[str, int] = {sid: 0 for sid in direct}
    cascade_by_hop: dict[str, list[str]] = {}
    unresolved: list[str] = []
    truncated = False

    seen: set[str] = set(direct)
    frontier: deque[tuple[str, int]] = deque((sid, 0) for sid in direct)

    while frontier:
        current_id, depth = frontier.popleft()
        if depth >= CASCADE_MAX_DEPTH:
            if _dependents(by_id.get(current_id, {})):
                truncated = True
            continue

        for dep_id in _dependents(by_id[current_id]):
            if dep_id not in by_id:
                # A fixture points at a supplier that doesn't exist. Skip it and
                # surface it rather than raising mid-demo.
                if dep_id not in unresolved:
                    unresolved.append(dep_id)
                continue
            if dep_id in seen:
                continue
            seen.add(dep_id)
            next_depth = depth + 1
            hop_depth[dep_id] = next_depth
            cascade_by_hop.setdefault(str(next_depth), []).append(dep_id)
            frontier.append((dep_id, next_depth))

    cascading = [sid for hop in sorted(cascade_by_hop, key=int) for sid in cascade_by_hop[hop]]

    # --- scoring ------------------------------------------------------------
    impact = {
        sid: _impact_score(by_id[sid], severity, hop_depth[sid])
        for sid in direct + cascading
    }
    ranked = sorted(impact, key=lambda sid: (-impact[sid], hop_depth[sid], sid))
    network_risk = _network_risk(impact)

    single_source = [
        sid for sid in direct + cascading if by_id[sid].get("single_source") is True
    ]

    return {
        # contract
        "directly_affected": direct,
        "cascading_affected": cascading,
        # additive
        "hop_depth": hop_depth,
        "cascade_by_hop": cascade_by_hop,
        "impact_scores": impact,
        "network_risk_score": network_risk,
        "single_source_exposed": single_source,
        "ranked_affected": ranked,
        "diagnostics": {
            "severity_used": severity,
            "matched_by": matched_by,
            "suppliers_indexed": len(by_id),
            "unresolved_dependents": unresolved,
            "truncated_at_max_depth": truncated,
            "max_depth": CASCADE_MAX_DEPTH,
        },
    }


# --- self-test --------------------------------------------------------------
if __name__ == "__main__":
    import json
    import os
    import sys

    HERE = os.path.dirname(os.path.abspath(__file__))
    EXAMPLES = os.path.join(HERE, "..", "..", "contracts", "examples")

    def load(name: str) -> Any:
        with open(os.path.join(EXAMPLES, name), encoding="utf-8") as fh:
            return json.load(fh)

    checks: list[tuple[str, bool, str]] = []

    def check(label: str, condition: bool, detail: str = "") -> None:
        checks.append((label, bool(condition), detail))

    suppliers = load("suppliers.example.json")
    events = load("events.example.json")
    evt = events[0]  # Gulf Coast port closure, high severity

    # 1. the contract example produces exactly the documented result
    r = get_affected_suppliers(evt, suppliers)
    check("direct hit is sup_001", r["directly_affected"] == ["sup_001"], str(r["directly_affected"]))
    check(
        "cascade reaches sup_002, sup_003, then sup_004",
        r["cascading_affected"] == ["sup_002", "sup_003", "sup_004"],
        str(r["cascading_affected"]),
    )
    check("hop depths are 0/1/1/2", [r["hop_depth"][s] for s in ("sup_001", "sup_002", "sup_003", "sup_004")] == [0, 1, 1, 2])
    check("two hops recorded for the reveal", sorted(r["cascade_by_hop"]) == ["1", "2"], str(r["cascade_by_hop"]))
    check("single-source exposure found", "sup_001" in r["single_source_exposed"])
    check("no bad fixture data", r["diagnostics"]["unresolved_dependents"] == [])

    # 2. the core invariant
    check("direct and cascading never overlap", not set(r["directly_affected"]) & set(r["cascading_affected"]))

    # 3. scores are bounded and ordered
    check("all scores within 0..1", all(0.0 <= v <= 1.0 for v in r["impact_scores"].values()))
    check("ranking is by descending impact", [r["impact_scores"][s] for s in r["ranked_affected"]] == sorted((r["impact_scores"][s] for s in r["ranked_affected"]), reverse=True))
    check("headline risk exceeds any single supplier", r["network_risk_score"] > max(r["impact_scores"].values()))
    check("headline risk stays within 0..1", 0.0 <= r["network_risk_score"] <= 1.0)
    check("scores are distinct, not clamped into ties", len(set(r["impact_scores"].values())) == len(r["impact_scores"]))
    check("direct single-source hit outranks its dependents", r["ranked_affected"][0] == "sup_001", str(r["ranked_affected"]))
    check("a wider cascade scores higher than a narrow one", _network_risk({"a": 0.4, "b": 0.3}) > _network_risk({"a": 0.4}))

    # 4. determinism — the demo must read the same way every run
    check("identical output on re-run", get_affected_suppliers(evt, suppliers) == r)

    # 5. no location match at all
    miss = get_affected_suppliers({**evt, "affected_location": "Reykjavik, IS"}, suppliers)
    check("no match yields empty lists", miss["directly_affected"] == [] and miss["cascading_affected"] == [])
    check("no match yields zero risk", miss["network_risk_score"] == 0.0)

    # 6. a cycle must terminate
    cyclic = [
        {"id": "sup_a", "name": "A", "part_supplied": "p", "single_source": False,
         "compliance_status": "compliant", "location": "Loop City", "financial_risk_score": 0.1,
         "downstream_dependents": ["sup_b"]},
        {"id": "sup_b", "name": "B", "part_supplied": "p", "single_source": False,
         "compliance_status": "compliant", "location": "Elsewhere", "financial_risk_score": 0.1,
         "downstream_dependents": ["sup_a"]},
    ]
    cyc = get_affected_suppliers({"severity": "high", "affected_location": "Loop City"}, cyclic)
    check("cycle terminates without repeats", cyc["cascading_affected"] == ["sup_b"], str(cyc["cascading_affected"]))

    # 7. a dependent id that doesn't exist is reported, not raised
    dangling = [{**cyclic[0], "downstream_dependents": ["sup_ghost"]}]
    dang = get_affected_suppliers({"severity": "low", "affected_location": "Loop City"}, dangling)
    check("dangling dependent is skipped", dang["cascading_affected"] == [])
    check("dangling dependent is reported", dang["diagnostics"]["unresolved_dependents"] == ["sup_ghost"])

    # 8. malformed input never raises
    for bad in (None, {}, {"severity": "catastrophic", "affected_location": None}, {"affected_location": 42}):
        for bad_suppliers in (None, [], "nonsense", [None, {}, {"id": ""}, {"id": "sup_x"}]):
            try:
                out = get_affected_suppliers(bad, bad_suppliers)
                assert isinstance(out["directly_affected"], list)
                assert isinstance(out["cascading_affected"], list)
            except Exception as exc:  # pragma: no cover - this is the thing we forbid
                check(f"malformed input {bad!r}/{bad_suppliers!r} survives", False, repr(exc))
                break
    check("malformed input never raises", all(ok for _, ok, _ in checks if "survives" in _ ) if any("survives" in c[0] for c in checks) else True)

    # 9. unknown severity falls back to medium rather than exploding
    check("unknown severity defaults to medium", get_affected_suppliers({**evt, "severity": "apocalyptic"}, suppliers)["diagnostics"]["severity_used"] == "medium")

    # 10. location matcher tiers
    check("exact match", location_matches("Gulf Coast, LA", "gulf coast, la") == "exact")
    check("substring match", location_matches("Gulf Coast, LA", "Gulf Coast") == "substring")
    check("segment match inside a longer phrase", location_matches("Gulf Coast, LA", "Port of Gulf Coast") == "segment")
    check("segment match is whole-word only", location_matches("Toledo, OH", "Toledoville, TX") is None)
    check("unrelated locations do not match", location_matches("Toledo, OH", "Memphis, TN") is None)
    check("short segment cannot false-positive", location_matches("Somewhere, LA", "Elsewhere, CA") is None)

    # --- report -------------------------------------------------------------
    width = max(len(label) for label, _, _ in checks)
    failed = 0
    for label, ok, detail in checks:
        if not ok:
            failed += 1
        mark = "PASS" if ok else "FAIL"
        line = f"  [{mark}] {label.ljust(width)}"
        if detail and not ok:
            line += f"   got: {detail}"
        print(line)

    print()
    print(f"  {len(checks) - failed}/{len(checks)} checks passed")
    print()
    print("  demo event:", evt["description"])
    print("  direct:    ", r["directly_affected"])
    print("  cascading: ", r["cascading_affected"], "by hop", r["cascade_by_hop"])
    print("  scores:    ", r["impact_scores"])
    print("  network risk score:", r["network_risk_score"])

    sys.exit(1 if failed else 0)
