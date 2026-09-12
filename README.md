# Markovathon — Supply Chain Disruption & Compliance Agent

A local-first agent that monitors a supplier network for disruptions (weather, port
closures, financial distress, compliance lapses), works out which suppliers and parts
are affected and how the risk cascades downstream, and drafts a response report for
human approval.

**Designed for local deployment.** Supplier records stay in a local MongoDB and
Ollama can generate the response on the same machine. Model and gateway requests
refuse non-local hosts by default, ignore environment proxies, and do not follow
redirects. MongoDB validates its loopback URI before a connection can open.

There is currently **no global outbound HTTP hook** in this repository. The status
endpoint reports `enforced: false` and `mode: "not enforced"`; a blocked-call count
of zero is not proof that every outbound call has been observed. Optional exact-host
allowlists for a model/gateway on another machine are configuration exceptions,
not loopback deployment. OpenClaw messaging, if enabled, can deliver to an external
chat platform and must be distinguished from local inference.

## Stack

| Piece | Choice |
| --- | --- |
| Backend | Python 3.11, FastAPI, uvicorn |
| LLM | Ollama on `localhost:11434`, model **`qwen3.6:35b`** (Qwen 3.6 35B) |
| Data | **MongoDB** on `localhost:27017`, db `markovathon`, driver `pymongo` |
| Seed | JSON in `backend/data/seed/`, loaded by `python -m backend.data.seed` (idempotent) |
| Frontend | React (Vite), plain CSS or Tailwind |
| Comms | REST over HTTP, JSON bodies, no websockets |

## The one design decision worth knowing

Risk propagation — which suppliers are hit, what cascades to what — is **deterministic
Python**, in `backend/agent/propagation.py`. The model is used **only** to write the
`risk_summary` and the `draft_report` email.

The affected supplier IDs are always calculated in Python. Narration tries the
optional OpenClaw harness, then Ollama, then deterministic templates when the model
is unavailable or its output fails validation. A generated draft still needs review.

## Layout

```
contracts/     source of truth: JSON Schemas, examples, LLM contract, storage contract
backend/
  agent/       propagation, model/template narration, monitoring, optional OpenClaw
  data/        Person 2 — seed JSON, db.py, seed.py, repository.py
  api/         FastAPI routes and request validation
  tests/       isolated API, locality, transport and monitor regressions
frontend/      Person 3 — supplier board, event trigger, staggered cascade reveal
demo/          pitch slides, HTML presentation, video, and editable Remotion project
roles/         paste-in task briefs, one per person
CLAUDE.md      shared context, read automatically by Claude Code in this repo
```

Role assignments are in `roles/`; coordinate changes that cross those boundaries.

## Demo and pitch

- **Interactive frontend:** start the frontend and open `http://localhost:5173/?demo=1`.
  The walkthrough gathers operational context, compares feasible responses, and
  presents inventory allocation and production changes for review.
- **Browser presentation:** open [demo/pitch/deck.html](demo/pitch/deck.html).
  The 13-slide deck includes the continuously increasing downtime cost counter.
- **PowerPoint:** download [demo/pitch/Markov.pptx](demo/pitch/Markov.pptx).
  See [pitch instructions](demo/pitch/README.md) for playback and rebuilding.
- **Video:** download [the two-minute MP4](demo/video/markov-demo.mp4).
  The [editable video project](demo/video/README.md) includes the Remotion source,
  captions, narration, and background music.

## Getting started

```bash
# 1. database — local mongod, never Atlas (see contracts/storage.md)
brew services start mongodb-community    # or: mongod --dbpath ./.mongo-data

# 2. model
ollama pull qwen3.6:35b
ollama list                     # confirm the exact tag; see contracts/llm.md

# 3. backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m backend.data.seed     # upsert seed rows; does not delete extra records
uvicorn backend.api.main:app --host 127.0.0.1 --port 8000

# 4. frontend, in a second terminal (Node.js and pnpm required)
cd frontend
pnpm install
pnpm dev
```

The frontend's `?demo=1` walkthrough runs from local sample fixtures without backend
services. Turn demo mode off for live API data; see `frontend/README.md` for API URL
configuration. Live mode needs the API and local MongoDB. Set `OLLAMA_DISABLE=1`
before starting the backend to exercise template fallback without a model.

The API lifespan starts the unattended monitor automatically. It checks for new
events every 30 seconds by default (`MONITOR_INTERVAL`), records assessments, and
flags events that meet both severity and risk floors. `OPENCLAW_ENABLE` is off by
default: those flags are **undelivered**, not Slack messages. Approval replies and
automatic sending to suppliers are not implemented. Monitor history/deduplication
are process-local and reset on server restart; undelivered approvals remain logged
for review rather than being resent on every tick.

There is no `demo/run.sh` launcher yet. Start the services explicitly as above.

## Working agreements

- Keep inference and supplier storage local. The existing per-service guards are
  not a global offline hook; do not represent them as one.
- **Never point Mongo at Atlas.** A `mongodb+srv://` URI is an external call wearing a
  different hat, it defeats the on-premises premise the project is built on, and
  because `pymongo` uses raw sockets it bypasses HTTP middleware. `backend/data/db.py`
  validates the URI before constructing a client and uses a direct connection.
- **Never let Mongo's `_id` reach the API response.** Project `{"_id": 0}` on every
  read; it isn't in the schemas and isn't JSON-serializable.
- **Never** change a contract in `contracts/` silently. Three other people's code
  depends on those shapes. Flag it in chat, update the schema and the example together.
- Keep functions small and independently runnable. Each person must be able to verify
  their own piece without the other three services up.
- Deterministic code for anything that affects correctness. LLM calls strictly for
  natural language.

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/suppliers` | — | supplier list |
| GET | `/api/events` | — | event list (demo triggering) |
| POST | `/api/analyze` | `{event_id}` | `AnalysisResult` |
| POST | `/api/actions/draft` | `{analysis_result}` | `{draft_report}` (regenerate text only) |
| GET | `/api/monitor/status` | — | running state, interval, assessment and delivery counts |
| GET | `/api/monitor/activity?limit=25` | — | latest recorded decisions, newest first |
| GET | `/api/offline-status` | — | enforcement status and configured model/database hosts; does not probe service reachability |

Exact response shapes: `contracts/analysis_result.schema.json`.

## Verification without real services

```bash
OLLAMA_DISABLE=1 OPENCLAW_ENABLE=0 python -m backend.agent
OLLAMA_DISABLE=1 OPENCLAW_ENABLE=0 python -m unittest backend.tests.test_regressions -v
```

The regression suite uses in-memory repository substitutes and an ephemeral
loopback HTTP server. It does not reseed MongoDB, generate with a real model, or send
messages. Passing it establishes those component paths; verify the real MongoDB,
Qwen tag, and optional gateway separately on the deployment hardware.
