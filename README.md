# Markovathon — Supply Chain Disruption & Compliance Agent

A local-first agent that monitors a supplier network for disruptions (weather, port
closures, financial distress, compliance lapses), works out which suppliers and parts
are affected and how the risk cascades downstream, and drafts a response report for
human approval.

**Runs 100% locally. Zero external API calls at inference time.** The supplier and
compliance data this kind of agent touches is often contractually or legally required
to stay on-premises — regulated industries, government-adjacent work, sensitive
supplier relationships — so the whole thing runs against a local model and we prove it
with an enforced offline mode, not a claim in a slide.

## Stack

| Piece | Choice |
| --- | --- |
| Backend | Python 3.11, FastAPI, uvicorn |
| LLM | Ollama on `localhost:11434`, model **`qwen3.6:35b`** (Qwen 3.6 35B) |
| Data | plain JSON fixtures in `backend/data/fixtures/` — no database |
| Frontend | React (Vite), plain CSS or Tailwind |
| Comms | REST over HTTP, JSON bodies, no websockets |

## The one design decision worth knowing

Risk propagation — which suppliers are hit, what cascades to what — is **deterministic
Python**, in `backend/agent/propagation.py`. The model is used **only** to write the
`risk_summary` and the `draft_report` email.

That split is deliberate: the core logic stays debuggable under time pressure, and the
demo can't fail because a model named the wrong supplier. It also keeps the part that
needs to *look* intelligent — the prose — firmly in the model's hands.

## Layout

```
contracts/     source of truth: JSON Schemas + copy-pasteable examples + the LLM contract
backend/
  agent/       Person 1 — propagation.py (deterministic), narrate.py (LLM)
  data/        Person 2 — fixtures + loader
  api/         Person 2 — FastAPI routes, thin
frontend/      Person 3 — supplier board, event trigger, staggered cascade reveal
demo/          Person 4 — scenario script, offline-mode proof, run.sh
roles/         paste-in task briefs, one per person
CLAUDE.md      shared context, read automatically by Claude Code in this repo
```

Only touch your own folder, plus read `contracts/`.

## Getting started

```bash
# 1. model
ollama pull qwen3.6:35b
ollama list                     # confirm the exact tag; see contracts/llm.md

# 2. backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.api.main:app --reload --port 8000

# 3. frontend
cd frontend && npm install && npm run dev
```

Once Person 4's script exists, `./demo/run.sh` brings up all three at once.

## Working agreements

- **Never** call an external network host, in any file, for any reason. Local fixtures
  and local Ollama only — and `demo/` installs a hook that raises if anything tries.
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
| POST | `/api/actions/draft` | `{analysis_result}` | `draft_report` (regenerate text only) |
| GET | `/api/offline-status` | — | `{"external_calls_blocked": 0, "mode": "fully offline"}` |

Exact response shapes: `contracts/analysis_result.schema.json`.
