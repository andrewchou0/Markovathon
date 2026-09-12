# Roles

`CLAUDE.md` at the repo root is the shared context — Claude Code picks it up
automatically in this repo, so you don't need to paste it.

Open your own file below and paste its contents as your first message to Claude Code:

| File | Owns |
| --- | --- |
| `person1-agent.md` | `/backend/agent/` — propagation + narration |
| `person2-data-api.md` | `/backend/data/` and `/backend/api/` — fixtures, loader, FastAPI |
| `person3-frontend.md` | `/frontend/` — React board, event trigger, staggered reveal |
| `person4-demo.md` | `/demo/` — scenario, offline proof, `run.sh`, integration |

Only touch your own folder plus read `/contracts/`.

## Build order that keeps everyone unblocked

1. **Person 4** locks the demo scenario (which event, which suppliers) and hands the
   exact ids to Person 2.
2. **Person 2** writes the fixtures first, before the API.
3. **Person 1** writes `propagation.py` first — zero dependencies, and Person 2 needs it
   working to finish the API layer.
4. **Person 3** never waits: build the entire UI against
   `contracts/examples/analysis_result.example.json` and swap in `fetch()` only once
   Person 2 confirms the API is live.
