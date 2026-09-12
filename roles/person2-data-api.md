YOUR ROLE: Build /backend/data/ and /backend/api/

Read CLAUDE.md (shared context) and /contracts/ first. Do not touch any folder
other than /backend/data/ and /backend/api/.

Files to create:

- /backend/data/fixtures/suppliers.json: 8-12 fictional suppliers matching
  contracts/supplier.schema.json exactly. Include at least 2-3 with
  single_source: true and downstream_dependents pointing to other suppliers in
  the list, so cascading effects actually have something to show. Spread
  compliance_status across all three values so the frontend board has green,
  yellow and red dots on screen.

- /backend/data/fixtures/events.json: 4-5 fictional events matching
  contracts/event.schema.json, at least one of which is designed to hit a
  single-source supplier with downstream dependents (this becomes the main demo
  event — get the exact ids from Person 4's /demo/script.md and match them).

- /backend/data/loader.py: simple functions to load the JSON files into Python
  dicts/lists. Plus a get_event_by_id / get_supplier_by_id helper, since the API
  needs them.

- /backend/api/main.py: FastAPI app with the endpoints in the shared contract:
    GET  /api/suppliers          -> full supplier list
    GET  /api/events             -> full event list
    POST /api/analyze            -> body {event_id} -> AnalysisResult
    POST /api/actions/draft      -> body {analysis_result} -> the draft_report
    GET  /api/offline-status     -> Person 4 owns the body of this one
  These must be THIN — call into backend/agent/propagation.py and
  backend/agent/narrate.py, don't reimplement logic. Return 404 for an unknown
  event_id rather than crashing.

- Enable CORS for localhost (the frontend runs on a different port, Vite's 5173).

- Coordinate with Person 4 on the startup hook in main.py that installs the
  offline-mode enforcement. They write the hook; you give it a place to be called.

Build the fixtures FIRST, even before the API — Person 3 needs to see the exact
shape of a real supplier/event to build the frontend against, and Person 1 needs
real data to test propagation. Validate them against the schemas (see
contracts/README.md) and paste suppliers.json into chat once it exists.

Tell Person 3 explicitly when the API is live on localhost:8000 — they're building
against hardcoded fake data until you do.
