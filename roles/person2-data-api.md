YOUR ROLE: Build /backend/data/ and /backend/api/

Read CLAUDE.md (shared context), /contracts/ and especially contracts/storage.md
first. Do not touch any folder other than /backend/data/ and /backend/api/.

Storage is MongoDB, running locally: mongodb://localhost:27017, database
markovathon, collections `suppliers` and `events`, driver pymongo (sync).
Local mongod only — never Atlas, never mongodb+srv://. contracts/storage.md
explains why that isn't negotiable.

Files to create:

- /backend/data/seed/suppliers.json: 8-12 fictional suppliers matching
  contracts/supplier.schema.json exactly. Include at least 2-3 with
  single_source: true and downstream_dependents pointing to other suppliers in
  the list, so cascading effects actually have something to show. Spread
  compliance_status across all three values so the frontend board has green,
  yellow and red dots on screen.

- /backend/data/seed/events.json: 4-5 fictional events matching
  contracts/event.schema.json, at least one of which is designed to hit a
  single-source supplier with downstream dependents (this becomes the main demo
  event — get the exact ids from Person 4's /demo/script.md and match them).

- /backend/data/db.py: the ONLY place a MongoClient is constructed and the only
  place MONGO_URI / MONGO_DB are named. Copy the snippet in contracts/storage.md,
  including serverSelectionTimeoutMS=2000 — the default is 30s, which is a dead
  demo if mongod isn't up.

- /backend/data/seed.py: reads the two seed JSON files, validates them against the
  schemas in /contracts/, and upserts them into Mongo with
  replace_one({"_id": doc["id"]}, {...doc, "_id": doc["id"]}, upsert=True) so
  re-running is idempotent. Runnable as `python -m backend.data.seed`. This is the
  reset button between demo takes — Person 4 will call it from run.sh, so make it
  print what it wrote and exit non-zero on failure.

- /backend/data/repository.py: every query lives here, so the _id projection can't
  be forgotten in one place. ALWAYS project {"_id": 0} on reads (see the _id rule
  in contracts/storage.md — this is the one way Mongo breaks our JSON contracts).
    get_all_suppliers() -> list[dict]
    get_all_events() -> list[dict]
    get_supplier_by_id(supplier_id: str) -> dict | None
    get_event_by_id(event_id: str) -> dict | None
  Documents returned from here are plain dicts identical to the old JSON shape,
  which is what lets /backend/agent/ stay completely unaware that Mongo exists.

- /backend/api/main.py: FastAPI app with the endpoints in the shared contract:
    GET  /api/suppliers          -> full supplier list
    GET  /api/events             -> full event list
    POST /api/analyze            -> body {event_id} -> AnalysisResult
    POST /api/actions/draft      -> body {analysis_result} -> the draft_report
    GET  /api/offline-status     -> Person 4 owns the body of this one
  These must be THIN — call into backend/data/repository.py for data and
  backend/agent/propagation.py + narrate.py for logic. Don't query a collection
  directly from a route, and don't reimplement propagation. Return 404 for an
  unknown event_id rather than crashing.

  pymongo is sync: declare handlers that touch it as plain `def`, not `async def`,
  and FastAPI runs them in a threadpool. Don't mix the two.

- At API startup, ping Mongo once and fail loudly with a readable message
  ("MongoDB unreachable at mongodb://localhost:27017 — is mongod running?") instead
  of letting the first request hang.

- Enable CORS for localhost (the frontend runs on a different port, Vite's 5173).

- Coordinate with Person 4 on the startup hook in main.py that installs the
  offline-mode enforcement and the local-MONGO_URI assertion. They write both; you
  give them a place to be called.

Build the seed JSON FIRST, before Mongo and before the API — Person 3 needs to see
the exact shape of a real supplier/event to build the frontend against, and
Person 1 needs real data to test propagation. Validate against the schemas (see
contracts/README.md) and paste suppliers.json into chat once it exists.

Get `mongod` running and seeded early. It's the one genuinely new moving part in
the stack, and it's better to find out it needs a --dbpath or a brew service in
hour one than an hour before the demo.

Tell Person 3 explicitly when the API is live on localhost:8000 — they're building
against hardcoded fake data until you do.
