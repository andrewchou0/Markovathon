# Shared context — Supply Chain Disruption & Compliance Agent

> This file is read automatically by Claude Code in this repo. Everyone works from it.
> Then open `roles/person<N>-*.md` for your own scope and paste that in as your task.

## WHAT WE'RE BUILDING

An agent that monitors a company's supplier network for disruptions (weather, port
closures, financial distress, compliance lapses), identifies which suppliers/parts are
affected and how the risk cascades, and drafts a response report for human approval.

Runs 100% locally — zero external API calls at inference time — because the
supplier/compliance data involved is contractually or legally required to stay
on-premises for many real-world use cases (regulated industries, government-adjacent
work, sensitive supplier relationships).

## TECH STACK (fixed — do not substitute)

- **Backend:** Python 3.11, FastAPI, uvicorn
- **LLM serving:** Ollama running locally on `localhost:11434`
  - **Model: `qwen3.6:35b`** (Qwen 3.6 35B — good reasoning/speed balance on our
    hardware). Confirm the exact local tag with `ollama list` before writing code
    against it; if it differs, change it in ONE place (see `contracts/llm.md`) and tell
    the team. Swap to a larger variant only if demo latency stays fine — test this
    early, not at the last minute.
  - Only ever called via `http://localhost:11434/api/generate` — never any other host,
    ever, from any file.
- **Data:** **MongoDB**, running locally on `localhost:27017`, database
  `markovathon`, collections `suppliers` and `events`. Driver: `pymongo` (sync).
  - The JSON files in `/backend/data/seed/` are **seed data**, not the runtime store —
    `python -m backend.data.seed` loads them into Mongo and is idempotent, so it doubles
    as the reset button between demo takes.
  - **Local `mongod` only. Never Atlas, never a `mongodb+srv://` URI, never any host
    but `localhost`/`127.0.0.1`** — hosted data would break the entire on-premises
    premise of the project, and `pymongo` uses raw sockets so it slips past our
    `requests`/`httpx` offline hook. See `contracts/storage.md`.
  - Mongo injects an `_id` that is not in our schemas and is not JSON-serializable.
    Set `_id` to the document's own id string on write, and project `{"_id": 0}` on
    every read. Full rule in `contracts/storage.md` — this is the one way Mongo can
    break the data contracts below.
- **Frontend:** React (Vite), plain CSS or Tailwind — no heavy UI library, keep it
  lightweight and fast to iterate on.
- **Inter-service comms:** REST over HTTP, JSON bodies. No websockets (poll or single
  request/response is fine — this is not truly real-time, it's "trigger an event, show
  a result").

## KEY DESIGN DECISION — read this carefully

Risk propagation logic (which suppliers are affected, how severe, what cascades to what)
is **DETERMINISTIC PYTHON CODE, not an LLM call**. The LLM is used **ONLY** to generate
natural-language text: the `risk_summary` paragraph and the `draft_report` email.

This is intentional: it makes the core logic reliable and debuggable under time
pressure, and it means the demo can't fail because a model hallucinated the wrong
supplier. Do not move the propagation logic into a prompt. Do not skip the LLM for the
text generation either — that's the part that needs to look intelligent in the demo.

## DATA CONTRACTS — exact shape, do not change without telling the team

Source of truth lives in `/contracts/` (JSON Schemas + copy-pasteable examples).

`supplier` (one document in the `suppliers` collection; seeded from
`/backend/data/seed/suppliers.json`):

```json
{
  "id": "sup_001",
  "name": "string",
  "part_supplied": "string",
  "single_source": true,
  "compliance_status": "compliant | at_risk | non_compliant",
  "location": "string, e.g. 'Gulf Coast, LA'",
  "financial_risk_score": 0.0,
  "downstream_dependents": ["sup_002"]
}
```

`downstream_dependents` = suppliers/parts that depend on this one. This is what makes
cascading effects work.

`event` (one document in the `events` collection; seeded from
`/backend/data/seed/events.json`):

```json
{
  "id": "evt_001",
  "type": "weather | financial | compliance | geopolitical",
  "description": "string, e.g. 'Port closure, Gulf Coast, 48hrs'",
  "affected_location": "string",
  "severity": "low | medium | high",
  "timestamp": "ISO 8601 string"
}
```

`affected_location` is matched against `supplier.location` by simple substring/exact
match. Keep it simple, no geocoding needed.

`AnalysisResult` (the shape returned by `POST /api/analyze`):

```json
{
  "event": { "...the event object...": null },
  "directly_affected": ["sup_001"],
  "cascading_affected": ["sup_002"],
  "risk_summary": "string — LLM-generated, 2-3 sentences",
  "draft_report": "string — LLM-generated, formatted as an email"
}
```

`directly_affected` is matched by location; `cascading_affected` comes from
`downstream_dependents`, computed in Python, not by the LLM.

## API ENDPOINTS (`backend/api/`, thin routing only — no logic here)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/suppliers` | — | full supplier list |
| GET | `/api/events` | — | full event list (for demo triggering) |
| POST | `/api/analyze` | `{event_id}` | `AnalysisResult` |
| POST | `/api/actions/draft` | `{analysis_result}` | the same `draft_report` |
| GET | `/api/offline-status` | — | `{"external_calls_blocked": 0, "mode": "fully offline"}` |

`/api/actions/draft` exists as a separate endpoint so the frontend can "regenerate
draft" without recomputing propagation.

## FOLDER OWNERSHIP — only touch your own folder + read `/contracts/`

| Path | Owner |
| --- | --- |
| `/contracts/` | shared, source of truth — changes get flagged to everyone |
| `/backend/agent/` | **Person 1** (`propagation.py`, `narrate.py`) |
| `/backend/data/` | **Person 2** (seed JSON, `db.py`, `seed.py`, `repository.py`) |
| `/backend/api/` | **Person 2** (FastAPI routes, calls into `agent/`) |
| `/frontend/` | **Person 3** |
| `/demo/` | **Person 4** (script, offline-mode indicator, local-URI assertion, `run.sh`) |

## OFFLINE-MODE INDICATOR (Person 4 builds this, everyone else supports it)

A simple counter/middleware that intercepts all outbound HTTP calls in the backend
process (monkeypatch `requests`/`httpx` at startup) and raises an error if any request
targets a host other than `localhost`/`127.0.0.1`. Expose a running count of
"external calls blocked: 0" that the frontend displays as a badge. This is the literal,
demonstrable proof of "fully offline" — not just a claim.

Two things the HTTP hook must get right now that Mongo is in the stack:

- The allowlist has to cover **`localhost:11434`** (Ollama) and **`localhost:27017`**
  (MongoDB). An over-strict patch takes down the agent and the database together.
- `pymongo` talks raw TCP, so it does **not** pass through the patch. The hook alone
  cannot prove the database is local. Person 4 also asserts at startup that `MONGO_URI`
  points at `localhost`/`127.0.0.1` and raises if it doesn't — without that, the badge
  could read "blocked: 0" while every supplier record streams to a cloud cluster.

## GENERAL RULES FOR CLAUDE CODE

- Never call out to any external network host, in any file, for any reason — local
  Mongo and local Ollama only. That includes connection strings: a `mongodb+srv://`
  URI is an external call wearing a different hat.
- Never change the JSON contracts above without flagging it loudly — three other
  people's code depends on these shapes staying stable.
- Keep functions small and testable independently — each person needs to be able to run
  and verify their own piece without the other three services running.
- Prefer explicit, deterministic code over LLM calls for anything that affects
  correctness (which suppliers are affected). Reserve LLM calls strictly for
  natural-language generation.
