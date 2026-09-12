"""Load backend/data/seed/*.json into local MongoDB. Idempotent.

    python -m backend.data.seed

Person 4 calls this from demo/run.sh on every launch, so it doubles as the reset
button between demo takes: re-running replaces documents rather than duplicating
them (see the _id rule in contracts/storage.md).

Prints what it wrote and exits non-zero on failure.
"""

import json
import sys
from pathlib import Path

from backend.data.db import MONGO_DB, MONGO_URI, get_db, ping

SEED_DIR = Path(__file__).parent / "seed"
CONTRACTS_DIR = Path(__file__).resolve().parents[2] / "contracts"

# collection name -> (seed file, schema file)
COLLECTIONS = {
    "suppliers": ("suppliers.json", "supplier.schema.json"),
    "events": ("events.json", "event.schema.json"),
}


def _load_and_validate(seed_file: str, schema_file: str) -> list[dict]:
    docs = json.loads((SEED_DIR / seed_file).read_text())
    if not isinstance(docs, list):
        raise ValueError(f"{seed_file} must contain a JSON array")

    try:
        import jsonschema
    except ImportError:
        print(f"  ! jsonschema not installed — skipping validation of {seed_file}")
        return docs

    schema = json.loads((CONTRACTS_DIR / schema_file).read_text())
    for doc in docs:
        try:
            jsonschema.validate(doc, schema)
        except jsonschema.ValidationError as exc:
            raise ValueError(
                f"{seed_file}: {doc.get('id', '<no id>')} fails {schema_file}: {exc.message}"
            ) from exc
    return docs


def seed() -> None:
    ping()
    db = get_db()
    print(f"seeding {MONGO_URI} db={MONGO_DB}")

    for collection, (seed_file, schema_file) in COLLECTIONS.items():
        docs = _load_and_validate(seed_file, schema_file)
        for doc in docs:
            # _id = the document's own domain id string, so re-running upserts
            # in place instead of duplicating rows.
            db[collection].replace_one(
                {"_id": doc["id"]}, {**doc, "_id": doc["id"]}, upsert=True
            )
        ids = ", ".join(doc["id"] for doc in docs)
        print(f"  {collection}: {len(docs)} documents upserted [{ids}]")
        print(f"  {collection}: {db[collection].count_documents({})} total in collection")

    print("seed complete")


if __name__ == "__main__":
    try:
        seed()
    except Exception as exc:
        print(f"SEED FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
