"""The ONLY place a MongoClient is constructed and the only place MONGO_URI /
MONGO_DB are named. See contracts/storage.md.

Local mongod only — never Atlas, never mongodb+srv://. Person 4's startup hook
asserts that separately; this module just refuses to invent a second spelling of
the URI.
"""

import os

from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "markovathon")

# serverSelectionTimeoutMS=2000: the pymongo default is 30s, which is a dead demo
# if mongod isn't up. Fail in two seconds with a readable message instead.
_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)


def get_db():
    return _client[MONGO_DB]


def ping() -> None:
    """Raise a readable error if mongod isn't reachable.

    Called at API startup and by the seeder so the failure surfaces there rather
    than as a hang on the first request.
    """
    try:
        _client.admin.command("ping")
    except Exception as exc:
        raise RuntimeError(
            f"MongoDB unreachable at {MONGO_URI} — is mongod running?"
        ) from exc
