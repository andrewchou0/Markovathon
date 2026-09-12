# Verified Markov demo evidence

Captured 2026-09-12 against checkout commit `b1241285e2731d86871e611c2fb928ebab7d899e`.
No tracked repo files were changed during that capture. No external services or real Slack delivery were used. These historical captures describe that commit, not the current backend or deployment state.

## Files

- `verified.json`: Seed records, real propagation result, generated fallback summary/email, measured fallback timing, actual monitor scan decisions, loopback service probes.
- `agent-self-test.txt`: Full `python3 -m backend.agent` output; 143 module checks pass (28 propagation,55 narration,29 OpenClaw,31 monitor), plus 26 handoff checks. First run was sandboxed; local socket attempts refused by sandbox. This still exercised fallback handling, not a running model.
- `autonomy.json` / `autonomy-log.txt`: Real daemon-thread monitor run with an 8-second interval and an in-memory loader of seed fixtures. Four events pre-assessed. Fifth event appended at +0.105 seconds; loop finished assessment at +8.514 seconds without another scan invocation. 5 assessed,3 selected for escalation,2 suppressed,0 delivered; second scan returned []. Permitted localhost networking confirmed model absent and exercised its fallback.
- `guard-proof.json`: Component guards reject nonlocal model and gateway hosts before transport. No external connection was attempted. This is NOT a global outbound firewall demonstration.
- The original capture scripts are not included in this portable video project; the JSON and text captures above are preserved.

## Verified story facts

10 suppliers,5 single-source suppliers (IDs001,004,005,007,009). Script's four is stale.

For evt_004:

- Direct: sup_007 Altiplano Rare Earth, Antofagasta CL; non_compliant and single_source.
- Hop1: sup_005 Shenzhen Micro Sensors and sup_008 Great Lakes Stamping.
- Hop2: sup_002 Delta Assembly Works and sup_006 Ardennes Wiring Systems.
- Hop3: sup_004 Cascade Final Assembly — Finished powertrain module.
- 6 affected,3 downstream hops,3 affected single-source suppliers.
- Risk0.961, computed in propagation.py. This is a heuristic exposure score, not a calibrated probability.
- Per-supplier scores:0.885,0.381,0.179,0.166,0.102,0.1 in traversal order.
- Network aggregate is round(1-product(1-score),3).

Seed scan selects evt_001 (risk0.715),evt_004(0.961),evt_005(0.726). Suppresses evt_002(0.397) andevt_003(0.447), both below0.5. Selection does not mean delivery: every selected outcome is alert_undelivered because OpenClaw is disabled.

Measured propagation + summary + email fallback:0.5334seconds, actual localhost connection refused. Direct Python only, no HTTP/API measurement. Use caption "0.53s local fallback test"; do not claim HTTP200 or kill a running model.

## Missing live pieces / required presentation qualifications

- No listeners at localhost:8000/API,11434/Ollama,18789/OpenClaw,27017/MongoDB, verified with allowed loopback socket calls.
- Python3.12 environment has no httpx,FastAPI,pymongo,uvicorn; agent's stdlib transport works.
- API lifespan currently does NOT call monitor.start; no /api/monitor/activity or approval route is present.
- demo/offline_guard.py absent. /api/offline-status currently returns a hardcoded0/fully-offline fallback. Do not animate it as proof.
- Mongo URI defaults local but no actual validation is present before MongoClient construction; globalHTTP hook absent.
- Model/gateway host guards exist, default local and permit only one explicit exact-host override; guard proof is valid for components only.
- No real Qwen or gateway call and no real Slack delivery demonstrated.
- Seed loader footage must be labeled fixture/local prototype replay, not live Mongo.
- Earlier 77integration checks are README claims from another machine, not rerun here. Use143 verified module checks only.

## Provenance

- `backend/data/seed/suppliers.json`, `events.json`: all displayed records.
- `backend/agent/propagation.py:175`: deterministic BFS and scoring result; `:160` aggregate.
- `backend/agent/monitor.py:99`: severity/risk thresholds; `:166` dedup scan; `:205` timer loop.
- `backend/agent/narrate.py:162`: local model guard; generated summary/email in verified.json.
- `backend/agent/openclaw.py:151`: gateway local-host guard.
- `backend/api/main.py:22`: startup wiring; `:146` offline status fallback.
- `backend/data/db.py:18`: MongoClient creation without URI assertion.
