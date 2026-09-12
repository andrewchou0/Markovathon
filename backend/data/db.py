"""The ONLY place a MongoClient is constructed and the only place MONGO_URI /
MONGO_DB are named. See contracts/storage.md.

Local mongod only — never Atlas, never mongodb+srv://. This module validates the
URI before constructing a client and defers connection until the first operation.
"""

import os

from pymongo import MongoClient
from pymongo.uri_parser import parse_uri

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "markovathon")

def validate_mongo_uri(uri: str) -> str:
    """Refuse remote/SRV hosts before MongoClient can open sockets or do DNS.

    Return a credential-free address suitable for logs and the status endpoint.
    A direct connection also prevents local replica-set discovery from opening
    connections to additional hosts advertised by the server.
    """
    if not isinstance(uri, str) or not uri.startswith("mongodb://"):
        raise ValueError("MONGO_URI must use mongodb:// with a loopback host; SRV is not permitted")
    try:
        parsed = parse_uri(uri)
    except Exception as exc:
        raise ValueError("MONGO_URI is not a valid local MongoDB URI") from exc
    nodes = parsed["nodelist"]
    if len(nodes) != 1 or nodes[0][0].lower() not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("MONGO_URI must name exactly one loopback host")
    host, port = nodes[0]
    return f"mongodb://{'[' + host + ']' if ':' in host else host}:{port}"


MONGO_ADDRESS = validate_mongo_uri(MONGO_URI)
# No connection during import: the API installs its optional guard before ping.
# Two seconds bounds failure when local mongod is absent.
_client = MongoClient(
    MONGO_URI, serverSelectionTimeoutMS=2000, connectTimeoutMS=2000,
    socketTimeoutMS=5000, connect=False, directConnection=True,
)


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
            f"MongoDB unreachable at {MONGO_ADDRESS} — is mongod running?"
        ) from exc
