"""FastAPI app — thin routing only.

Data comes from backend/data/repository.py; logic lives in backend/agent/
(propagation.py + narrate.py, Person 1). No collection is queried from a route
and no propagation is reimplemented here.

pymongo is sync, so every handler that touches it is a plain `def` — FastAPI runs
those in a threadpool. Do not convert them to `async def`.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.data import repository
from backend.data.db import MONGO_URI, ping


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Person 4: installs the requests/httpx monkeypatch and asserts MONGO_URI is
    # local. Runs before the Mongo ping on purpose, so a non-local URI is caught
    # before we ever connect to it.
    if offline_guard is not None:
        offline_guard.install()

    # Fail loudly here rather than hanging on the first request.
    ping()
    print(f"MongoDB OK at {MONGO_URI}")
    if propagation is None:
        print("WARNING: backend/agent/ not importable — /api/analyze will 503")
    yield


app = FastAPI(title="Supply Chain Disruption & Compliance Agent", lifespan=lifespan)

# The frontend dev server runs on a different port (Vite's 5173).
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Person 1's agent module -------------------------------------------------
# Guarded import so this layer runs and is testable before backend/agent/ lands.
# Once Person 1 commits those files this picks them up with no change here.
try:
    from backend.agent import narrate, propagation
except ImportError:  # pragma: no cover - transitional
    narrate = propagation = None


def _require_agent():
    if propagation is None or narrate is None:
        raise HTTPException(
            status_code=503,
            detail="backend/agent/ is not available yet (propagation.py + narrate.py).",
        )


# --- Person 4's offline-mode enforcement -------------------------------------
# Person 4 owns both of these; this is the call site they asked for. Expected
# shape: demo/offline_guard.py exposing install() and offline_status() -> dict.
try:
    from demo import offline_guard
except ImportError:  # pragma: no cover - transitional
    offline_guard = None


class AnalyzeRequest(BaseModel):
    event_id: str


class DraftRequest(BaseModel):
    analysis_result: dict


@app.get("/api/suppliers")
def get_suppliers() -> list[dict]:
    return repository.get_all_suppliers()


@app.get("/api/events")
def get_events() -> list[dict]:
    return repository.get_all_events()


@app.post("/api/analyze")
def analyze(body: AnalyzeRequest) -> dict:
    # Event lookup first, so an unknown id is a 404 regardless of agent state.
    event = repository.get_event_by_id(body.event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Unknown event_id: {body.event_id}")

    _require_agent()

    suppliers = repository.get_all_suppliers()

    affected = propagation.get_affected_suppliers(event, suppliers)
    directly_affected = affected["directly_affected"]
    cascading_affected = affected["cascading_affected"]

    return {
        "event": event,
        "directly_affected": directly_affected,
        "cascading_affected": cascading_affected,
        "risk_summary": narrate.generate_risk_summary(
            event, directly_affected, cascading_affected, suppliers
        ),
        "draft_report": narrate.generate_draft_report(
            event, directly_affected, cascading_affected, suppliers
        ),
    }


@app.post("/api/actions/draft")
def draft(body: DraftRequest) -> dict:
    """Regenerate just the draft, without recomputing propagation."""
    _require_agent()

    result = body.analysis_result
    missing = [
        k for k in ("event", "directly_affected", "cascading_affected") if k not in result
    ]
    if missing:
        raise HTTPException(
            status_code=422, detail=f"analysis_result missing keys: {missing}"
        )

    return {
        "draft_report": narrate.generate_draft_report(
            result["event"],
            result["directly_affected"],
            result["cascading_affected"],
            repository.get_all_suppliers(),
        )
    }


@app.get("/api/offline-status")
def offline_status() -> dict:
    # Person 4 owns this body. Documented default until offline_guard lands.
    if offline_guard is not None:
        return offline_guard.offline_status()
    return {"external_calls_blocked": 0, "mode": "fully offline"}
