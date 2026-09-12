"""Every query lives here, so the {"_id": 0} projection can't be forgotten in one
place.

Documents returned from this module are plain dicts identical to the seed JSON
shape, which is what lets backend/agent/ stay completely unaware Mongo exists.
See the _id rule in contracts/storage.md.
"""

from backend.data.db import get_db

# Project _id away on every read: ObjectId isn't JSON-serializable and _id isn't
# in contracts/*.schema.json (they set additionalProperties: false), so a leaked
# _id 500s the API or fails validation.
_NO_ID = {"_id": 0}


def get_all_suppliers() -> list[dict]:
    return list(get_db().suppliers.find({}, _NO_ID))


def get_all_events() -> list[dict]:
    return list(get_db().events.find({}, _NO_ID))


def get_supplier_by_id(supplier_id: str) -> dict | None:
    return get_db().suppliers.find_one({"id": supplier_id}, _NO_ID)


def get_event_by_id(event_id: str) -> dict | None:
    return get_db().events.find_one({"id": event_id}, _NO_ID)


if __name__ == "__main__":
    from backend.data.db import ping

    ping()
    suppliers = get_all_suppliers()
    events = get_all_events()
    print(f"suppliers: {len(suppliers)}  events: {len(events)}")
    for doc in suppliers + events:
        assert "_id" not in doc, f"_id leaked from repository: {doc}"
    print("no _id leaked")
    print("get_supplier_by_id('sup_001'):", get_supplier_by_id("sup_001"))
    print("get_event_by_id('evt_001'):", get_event_by_id("evt_001"))
    print("get_event_by_id('evt_999'):", get_event_by_id("evt_999"))
