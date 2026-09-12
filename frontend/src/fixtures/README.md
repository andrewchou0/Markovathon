# Local demo fixtures

These files snapshot the repository's ten seeded suppliers, five events, Python
risk propagation, and deterministic template narration. The default scenario is
`evt_004`: Altiplano Rare Earth, five downstream suppliers across three tiers,
and a recorded network risk score of **0.961**.

Regenerate from the repository root after changing backend seeds or calculations:

```sh
python3 frontend/src/fixtures/generate-fixtures.py
```

Check parity without rewriting files:

```sh
python3 frontend/src/fixtures/generate-fixtures.py --check
```

Generation explicitly disables Ollama and OpenClaw. No database, model service,
message platform, or network request is needed. The frontend's Node tests invoke
the check, so running the full repository test suite requires Python 3 as well
as Node.

- `analysis-results.json` holds every event's exact shared `AnalysisResult` shape.
- `analysis-result.json` is the default event's result, retained for consumers of
  the original singular fixture.
- `propagation-results.json` stores the backend's extra score and hop evidence
  separately, keeping the shared API contract unchanged.
- `impact-results.json` stores the presentation metrics generated from those
  Python results. The frontend does not implement risk scoring.
- `provenance.json` records the source functions and demo limitations.

The saved supplier risk score expresses modeled exposure; it is not a calibrated
probability of failure. Those snapshots contain no warehouse, production, or
customer-order data.

`operations-scenario.json` is a separate, explicitly **simulated** operational
dataset for evt_004. It is authored for the frontend example, excluded from the
Python fixture generator, and evaluated by `src/operations-demo.js`. It supplies
finite stock (including quality holds), a shared line and strict job queue, an
approved independent kit BOM, customer quantities/deadlines/illustrative fees,
and alternate qualification constraints. E5–E8 cite these records by their
`SIM-*` record IDs. The evaluator tests conservation, deadlines, capacity,
feasibility, and changes in the recommended option when inputs differ.

The walkthrough does not claim connections to these systems, a live model
reasoning trace, or execution of any proposed action. The operational cost
comparison remains separate from the saved Python supplier risk calculation.
