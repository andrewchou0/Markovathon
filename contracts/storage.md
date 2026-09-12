# Storage contract — local MongoDB

Suppliers and events live in MongoDB. The JSON files in `backend/data/seed/` are no
longer the runtime store — they are **seed data**, loaded into Mongo once at startup.

## Fixed values

```
MONGO_URI   = mongodb://localhost:27017    # never any other host
MONGO_DB    = markovathon
COLLECTIONS = suppliers, events
DRIVER      = pymongo (sync)
```

Define these **once**, in `backend/data/db.py`, from the environment with those
defaults:

```python
import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "markovathon")

_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)

def get_db():
    return _client[MONGO_DB]
```

Nothing else in the codebase constructs a `MongoClient` or names the database.

## MongoDB Atlas is not allowed — read this

A `mongodb+srv://` connection string, or any host that isn't `localhost`/`127.0.0.1`,
**breaks the entire premise of the project.** The pitch is that regulated supplier and
compliance data never leaves the machine; shipping it to a hosted cluster is exactly
the thing we're claiming not to do, and it's the first question a judge will ask.

It also evades our own offline proof: `pymongo` talks raw TCP sockets, so it does
**not** go through the `requests`/`httpx` monkeypatch in `demo/`. An Atlas URI would
sail straight past the "external calls blocked: 0" badge while making the badge a lie.
Person 4 therefore asserts at startup that `MONGO_URI` resolves to a local host, and
raises if it doesn't. See `roles/person4-demo.md`.

Run `mongod` locally. That's the whole requirement.

## The `_id` rule — the one way Mongo breaks our JSON contracts

Mongo injects an `_id` (an `ObjectId`) into every document. `ObjectId` is not
JSON-serializable and is not in `contracts/*.schema.json`, so it will 500 the API or
fail schema validation the moment it leaks.

Two rules, applied everywhere, no exceptions:

1. **On write:** set `_id` to the document's own domain id string, so re-seeding is
   idempotent rather than duplicating rows.

   ```python
   db.suppliers.replace_one({"_id": s["id"]}, {**s, "_id": s["id"]}, upsert=True)
   ```

2. **On read:** always project `_id` away, so what comes back is exactly the contract
   shape.

   ```python
   list(db.suppliers.find({}, {"_id": 0}))
   ```

A document read this way is a plain dict identical to the old JSON-file shape — which
means `backend/agent/` needs no knowledge that Mongo exists at all.

## Seeding

`backend/data/seed.py`, runnable directly:

```bash
python -m backend.data.seed          # idempotent: safe to re-run before every demo
```

It reads `backend/data/seed/suppliers.json` and `backend/data/seed/events.json`,
validates them against the schemas in `contracts/`, and upserts them with the `_id`
rule above. Re-running it is the reset button between demo takes — that's a genuine
advantage over the old read-only JSON approach, so lean on it.

## Why sync pymongo, not motor

`pymongo` is sync. Declare the FastAPI route handlers that touch it as plain `def`
(not `async def`) and FastAPI runs them in a threadpool, so nothing blocks the event
loop. `motor` would work too, but async plumbing is not where our remaining hours
should go.

Do not mix: if a handler is `async def`, it must not call a sync repository function.

## Reads go through the repository, not the routes

`backend/data/repository.py` holds every query. `backend/api/` calls it and never
touches a collection directly, so the `{"_id": 0}` projection can't be forgotten in
one place. Required functions:

```python
get_all_suppliers() -> list[dict]
get_all_events() -> list[dict]
get_supplier_by_id(supplier_id: str) -> dict | None
get_event_by_id(event_id: str) -> dict | None
```

## Failure mode to handle

If `mongod` isn't running, `pymongo` blocks for 30 seconds by default before raising.
That's a dead demo. Hence `serverSelectionTimeoutMS=2000` above, plus a clear error at
API startup ("MongoDB unreachable at mongodb://localhost:27017 — is mongod running?")
rather than a hang on the first request.
