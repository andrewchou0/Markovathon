# Markov frontend

React + Vite and plain CSS. The workspace has two modes: an interactive demo of disruption assessment and operational mitigation, and a live connection to the local API. Both use the supplier network and clean white/slate interface shown in the demo video.

## Run and check

Vite 7 requires Node 20.19+ or 22.12+. Python 3 is also required for the fixture-parity test; use the repository's Python 3.11 environment when available. The demo itself requires no Python, database, or model service in the browser.

```sh
cd frontend
npm install
npm run dev
```

Open [the local demo](http://127.0.0.1:5173/?demo=1). Vite uses port 5173 with `strictPort`, so an occupied port produces an error rather than silently moving the preview. Fonts and visual assets are local. If using pnpm, `pnpm install --frozen-lockfile` uses the committed lockfile, and the same scripts work with pnpm.

```sh
npm test
npm run build
npm run preview
```

`npm test` covers the API client, mode navigation, dependency reveal, shared data schemas, operational allocation/deadline/capacity calculations, and parity with fresh deterministic Python output. It invokes `python3` by default; set `PYTHON` to another Python executable if needed. `npm run build` produces the Vite bundle in `dist/`. Tests do not require running services or call a model.

## Interactive demo

Demo mode is on by default and is explicit in the header and URL. The default scenario is **evt_004**, the rare-earth export licence suspension shown in the video. All ten suppliers and five single-source suppliers match the backend seed data.

| Event | Scenario | Direct supplier | Saved network risk |
| --- | --- | --- | --- |
| evt_001 | Gulf Coast port closure | Gulf Precision Castings | 0.715 |
| evt_002 | Memphis compliance finding | Delta Assembly Works | 0.397 |
| evt_003 | Greensboro credit downgrade | Piedmont Circuit Labs | 0.447 |
| **evt_004** | **Antofagasta export licence suspension** | **Altiplano Rare Earth** | **0.961** |
| evt_005 | Nagoya typhoon | Kanto Precision Bearings | 0.726 |

The default disruption reaches Shenzhen Micro Sensors and Great Lakes Stamping at tier 1, Delta Assembly Works and Ardennes Wiring Systems at tier 2, and Cascade Final Assembly at tier 3. The result is one direct supplier plus five downstream suppliers. The risk score prioritizes exposure for review; it is not a probability, downtime measurement, or revenue estimate.

**Run demo** plays the default 67-second sequence: problem → gather evidence → find constraints → compare options → recommend a plan. **View plan** opens the completed example immediately, with every stage available for review. Evidence E1–E4 comes from the saved supplier analysis. E5–E8 adds explicitly simulated warehouse inventory, manufacturing schedule/BOM, customer commitments, and quality/alternate-source records. The ledger preserves the original records and links each finding and proposed action to its supporting evidence.

The example covers 40 scheduled working hours at Cascade Final Assembly. It has 160 released sensors, 40 finished modules, and 40 additional sensors on quality hold. One shared line must satisfy priority and standard module orders plus an independent, approved service-kit order. The current strict queue stalls behind an incomplete module job; the recommended plan reserves priority stock, parks the unfilled standard remainder, and releases the kit job.

| Compared policy | Priority modules on time | Standard modules late | Kits on time | Productive hours | Modeled late fees + setup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current sequence | 20/180 | 0 | 0 | 8 | $25,600 |
| Prioritize critical order | 180/180 | 160 | 0 | 8 | $5,600 |
| Prioritize + resequence kits | 180/180 | 160 | 160 | 24 | $4,600 |

The recommended option reduces modeled cost by $21,000 and recovers 16 productive hours, while leaving 160 standard modules late. The extra kit work avoids $1,600 in kit fees for a $600 setup, saving $1,000 beyond priority allocation alone. Held inventory is never consumed. An alternate supplier is excluded because qualification takes 120 scheduled hours and no dated receipt is committed. These are illustrative one-time fees and setup costs, not revenue or a prediction of real losses; the comparison selects the least-cost feasible option among the three modeled policies. Rate, stock, approval, deadline, and dispatch assumptions remain inspectable.

The other four scenarios retain their 34–35-second supplier-exposure walkthroughs and four seed evidence entries. They do not inherit the default scenario's factory assumptions.

The playback controls support pause/resume, one-step advance, revisiting reached stages, reset, and replay. Inspecting evidence pauses playback. Changing scenarios or modes cancels the old run; hiding the tab pauses the walkthrough. Browser history and reload preserve the selected mode. The default scenario is restored when switching modes.

The dark processing rail identifies the records, comparison, proposal, and human approval in the operational example. Its final draft includes quantities, owners, scheduled hours, remaining exceptions, and conditions for reassessment. Reloading restores the same calculated proposal. The other scenarios retain their saved backend template wording. Copying a draft uses the clipboard; nothing is sent. No live backend requests are made in demo mode.

## Saved result provenance

`src/demo-client.js` exposes the seeded suppliers/events, every scenario's exact `AnalysisResult`, and separate propagation evidence. `src/story.js` turns those stored results into the walkthrough. It does not implement risk scoring. For evt_004 only, it combines that exposure with `src/operations-demo.js`, which calculates finite stock allocation and line scheduling from the explicitly simulated `src/fixtures/operations-scenario.json`. The operational draft is applied to the displayed response without modifying saved backend fixtures.

Fixtures are generated from `backend/data/seed/`, `backend.agent.propagation`, and the backend's deterministic narration templates. The generator disables Ollama and OpenClaw and needs no services. To refresh or verify them from the repository root:

```sh
python3 frontend/src/fixtures/generate-fixtures.py
python3 frontend/src/fixtures/generate-fixtures.py --check
```

The parity check fails if suppliers, events, impact results, or template wording drift from the backend. `AnalysisResult` remains the exact shared five-field schema; scores and hop metadata live in separate fixtures. See [fixture provenance](src/fixtures/README.md).

The operational records are labeled simulated in the data, interface, and draft. They demonstrate the intended synthesis workflow without claiming connections to a WMS, MES, order platform, or quality system. The staged walkthrough is not a live model reasoning trace. The supplier-risk score and operational cost calculation remain separate. Operational planning is currently frontend/demo only; live mode still uses the existing backend supplier assessment and wording endpoints.

## Live workspace

Turn **Demo mode off**, or open [the live workspace](http://127.0.0.1:5173/?demo=0). The default API origin is `http://localhost:8000`; `VITE_API_BASE` can configure the backend address. The backend allows local development origins. Live mode requires local MongoDB, seeded supplier/event records, and the running FastAPI service. Ollama supplies wording when available; the backend can return deterministic template wording when it is unavailable.

From the repository root, with the Python environment installed and local MongoDB running:

```sh
python -m backend.data.seed
uvicorn backend.api.main:app --port 8000
```

The frontend loads the actual API records and prefers evt_004 when present, otherwise the first available event. **Analyze** posts the selected event, keeps request progress visible, then reveals only the suppliers in the returned result, by dependency tier. The backend owns propagation and response generation. **Regenerate draft** requests wording again without recomputing exposure.

| Method | Path | Frontend use |
| --- | --- | --- |
| GET | `/api/suppliers` | Load supplier records |
| GET | `/api/events` | Load available disruptions |
| POST | `/api/analyze` | `{ "event_id": "evt_004" }` → `AnalysisResult` |
| POST | `/api/actions/draft` | `{ "analysis_result": result }` → `{ "draft_report": "..." }` |
| GET | `/api/offline-status` | Read configuration and explicitly reported enforcement |
| GET | `/api/monitor/status` | Read the backend monitor's running state and counters |
| GET | `/api/monitor/activity?limit=12` | Read recent assessments and delivery outcomes |

The header reads local status every five seconds after the previous read settles. It shows a blocked-call count only when the backend explicitly reports `enforced: true`. A configured model or database host is not proof that the service is reachable. Demo status is labeled unmeasured, and unavailable live readings are cleared rather than retained as healthy.

**Agent activity** reads monitor status and recent activity every three seconds after each read settles. The backend owns the unattended loop and starts it with the API lifecycle when its monitor module is available; the browser displays its state. The UI distinguishes delivered approval requests, flagged events with delivery unavailable, below-threshold assessments, and errors. It does not equate a flag with a sent message. Frontend analysis and draft controls do not send the draft.

## Recovery and cancellation

- Failed initial loads show service guidance, **Retry connection**, and **Use demo mode**. A connected API with empty supplier/event arrays shows a separate empty state and **Reload records**.
- Invalid response shapes, failed requests, and timeouts produce readable errors. Live failures are never silently replaced by fixtures.
- Requests support `AbortSignal`. Reset, scenario changes, mode changes, and unmount abort browser requests and invalidate late responses. This prevents an older result or draft from overwriting a newer run; it does not promise that a server already computing a response stops immediately.
- Reads have a 10-second timeout. Analysis and draft requests allow up to 270 seconds for the backend's sequential wording attempts and fallback. The elapsed timer remains visible while work is pending.
- Status polls do not overlap. Failed monitor readings clear old status/activity, expose **Retry status**, and continue checking. A missing monitor endpoint is reported explicitly.
- Draft-copy failure leaves the text available for manual selection. All drafts stay available for human review and remain unsent by this workspace.

## Interface and accessibility

The white/slate canvas, local Avenir Next / Segoe UI stack, blue action accent, and dark processing rail match the video. Direct disruption uses red, downstream exposure amber, and compliance status retains its own labeled indicator. Exact dependency tiers appear in both modes; on narrow screens they stack vertically instead of shrinking text.

The evidence ledger moves below the active stage on smaller screens, the processing rail becomes two columns, and controls remain keyboard accessible. The interface includes a skip link, visible focus states, report-tab keyboard navigation, live status/error text, and reduced-motion handling. See [design direction](DESIGN.md) for component roles and visual rules.
