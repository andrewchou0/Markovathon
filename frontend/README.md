# Markov frontend — Person 3

React + Vite, plain CSS. All implementation is confined to `frontend/`.

## Run

Node 20.19+ or 22.12+ is required by Vite 7. Install packages once while online, then the frontend runs locally without external assets, fonts, APIs, or model calls.

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173/?demo=1**. If pnpm is installed, `pnpm install --frozen-lockfile` uses the committed lockfile; the same scripts work with pnpm.

```bash
npm test
npm run build
npm run preview
```

## Current behavior

- **Demo mode** enables the sample workspace. Turning it off unmounts playback, cancels draft work, and clears the sample data. URL query, reload and browser history preserve the selected mode.
- **Run demo** starts a roughly 34-second walkthrough: problem → gather evidence → synthesize → calculate impact → develop response. Both the port closure and compliance scenarios have complete stories.
- **Pause / Resume** preserves remaining time in a frame. **Next step** advances one evidence record, finding, calculation, or response action and leaves playback paused. Stage buttons revisit already reached stages. Reset and replay start clean. Changing scenarios cancels the previous run. Hiding the tab pauses the walkthrough.
- The evidence ledger accumulates four source records. Click a record or E1–E4 reference to pause and inspect its content. Source records remain available through the response stage.
- Additional port demo assumptions: 120 housings on hand, 10 consumed/hour, no replenishment, a 48-hour interruption. Displayed arithmetic: 12 hours of inventory coverage, 36 hours of potential gap, 360 units of demand exposed. These are explicitly illustrative values, not measurements of an actual business or confirmed production losses.
- The audit demo calculates 3 required records minus 2 received = 1 missing attestation. It does not invent a monetary impact or shipment hold.
- Supplier exposure uses only IDs in the supplied AnalysisResult. Direct impact precedes downstream reveal by 550ms per graph hop. Existing compliance dots and single-source markings remain distinct from event exposure.
- Response priorities appear one at a time, before the original sample assessment/email becomes reviewable. The draft preserves whitespace, can be copied, and reloads a sample on regeneration. Nothing is sent; no local model is called in demo mode.
- **Local status** shows the sample counter and disconnected model/database status. Live enforcement is unverified; switching demo off does not enable live monitoring.
- Keyboard focus, report-tab arrow keys, reduced motion, responsive evidence layout, and persistent playback controls are included.

## Demo data boundaries

`src/story.js` owns supplemental illustrative sources, findings, arithmetic and action plans. Slack and ERP entries are sample local exports, not connected platforms. `src/demo-client.js` and the copied contract fixtures still own supplier IDs and final AnalysisResult prose. The frontend does not implement business risk propagation or expose model reasoning. `src/use-playback.js` controls presentation timing with one cancellable timer.

The existing API contract supplies only a final analysis; it has no evidence or calculation trace. Real staged progress will need a separate, agreed backend trace/status contract. Do not present this simulated timeline as actual backend work, or silently replace failed live responses with fixtures.

## Integration handoff — waiting for Person 2

The role brief explicitly requires Person 2's confirmation before switching away from fixtures. No live fetch calls or automatic backend probes are present.

Once Person 2 confirms readiness, replace the demo client and wire these existing contracts through localhost:8000 (a Vite `/api` proxy can avoid CORS during development):

| Method | Path | Request / response |
| --- | --- | --- |
| GET | `/api/suppliers` | Array matching supplier schema |
| GET | `/api/events` | Array matching event schema |
| POST | `/api/analyze` | `{ "event_id": "evt_001" }` → AnalysisResult |
| POST | `/api/actions/draft` | `{ "analysis_result": result }` → confirm exact draft response envelope |
| GET | `/api/offline-status` | `external_calls_blocked`, `mode`, `llm`, `db` |

Integration questions for the team:

1. **Person 2:** Confirm the API is live and whether `/api/actions/draft` returns a JSON string or `{ "draft_report": "..." }`; current prose does not pin down that envelope.
2. **Person 1:** Share the measured local-model latency. Keep real request progress visible for that entire duration and allow recovery from timeout/failure without silently replacing the result with a fixture.
3. **Person 4:** Confirm `llm` and `db` fields in the status endpoint. Poll only after integration, and show unavailable/stale status when polling fails instead of implying verified enforcement.
4. **Shared fixture note:** `sup_002` depends onward to `sup_004`, but the port analysis example lists only `sup_002` and `sup_003` as cascading. The frontend deliberately preserves the supplied example. Confirm the intended propagation depth with Person 1; do not silently change the contracts.

## Five-minute frontend walkthrough

1. Run the Gulf Coast scenario. Describe the port disruption as the first stage opens.
2. Pause on **Gather evidence**. Open Slack and Warehouse ERP records to show the source context.
3. Advance through synthesis. Explain how the port, supplier and inventory records connect.
4. Pause on **Calculate impact**. Show the direct/downstream relationship and the inventory arithmetic. Call out the sample assumptions.
5. Advance through the response priorities, then review the assessment and email. Copy the draft if useful; nothing is sent.
6. Switch to Memphis for a second use case or turn Demo mode off to show the live-service boundary.

Design and installed skill provenance are in `DESIGN.md`. All implementation remains in `frontend/`; backend, contracts and demo scripts are unchanged.

This preview does not claim connected Slack/ERP ingestion, live camera ingestion, continuous background monitoring, or autonomous physical operations.
