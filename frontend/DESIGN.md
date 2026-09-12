# Markov interface direction

Markov serves operations teams and hackathon judges who need to understand how a disruption becomes a reviewable response. The user preference is simple, clean, intuitive, with the important actions and dependencies visible. The frontend now uses the same supplier examples and visual language as the demo video.

## Visual language

Preserve the existing white/slate identity and local Avenir Next / Segoe UI font stack. The core tokens are canvas `#f5f7fa`, surface `#ffffff`, ink `#203047`, secondary text `#596779`, blue accent `#285bd0`, and divider `#dce3ed`. Plain CSS and small React components keep the interface lightweight; no external fonts, heavy UI library, or replacement theme is needed.

Use the dark `#203047` processing rail to explain four distinct responsibilities: business records, comparison, a mitigation proposal, and human approval. The operational demo labels its calculations explicitly; other scenarios and live mode retain their actual processing labels. The rail anchors the flow visually while the active workspace stays light and readable. Completion accents indicate that a step has been reached; the human-approval label continues to say the proposal is not executed.

Keep the reading hierarchy direct: page heading, scenario and primary action, current stage, evidence or result, then supporting network. Main copy is 14px, stage titles 26px, and controls approximately 13px. Text stays left aligned. Use red for direct disruption and amber for downstream exposure, with both icons and labels. A supplier's existing compliance indicator remains separate from its exposure to the selected event.

## Demo flow

The default scene is the same as the video: a rare-earth export licence suspension affects Altiplano Rare Earth. All ten supplier records and five scenarios come from backend seeds. The user's expanded direction is to show what the business can change even while the external cause stays unresolved. The default walkthrough adds simulated internal records at Cascade Final Assembly, gathers eight evidence entries, identifies constraints, compares operating policies, and develops a quantified mitigation proposal for review.

```text
Scenario selector + View plan / Run / Pause / Replay
Problem → Gather evidence → Find constraints → Compare options → Recommend a plan
Dark processing rail: business context → comparison → mitigation → human approval
[ Active stage and result                          ][ Evidence ledger ]
[ Pause / Next step / Reset and playback state                         ]
[ Supplier board, dependency inspection, and recorded demo activity    ]
```

E1–E4 come from the seeded event, part/location fields, compliance/sourcing fields, and recorded dependency relationships. E5–E8 are explicitly simulated warehouse inventory, factory schedule/BOM, customer commitments, and quality/alternate records. The gathering stage shows upstream records, then internal records, retaining all eight in the ledger. Do not imply these platforms are connected or that a model generated the demo result.

The operational comparison uses one shared line and a 40-hour horizon. Show the current sequence, priority allocation, and priority allocation plus independent kit production against the same constraints. Make the $25,600 → $4,600 modeled fees-plus-setup reduction visible alongside 180/180 priority modules on time, 160 kits on time, and 16 recovered productive hours. Keep the remaining 160 late standard modules visible. The $21,000 reduction is modeled from illustrative fees, not revenue or a promise that the shortage is resolved.

Explain why the preferred plan is feasible: 40 finished modules and 160 released sensors are available, 40 held sensors remain excluded, the kit BOM and crew are approved, and the scheduler must explicitly park the incomplete module job to release the next job. The alternate is excluded without a qualified, dated receipt. Specific owners, quantities, timing, and reassessment triggers precede the approval draft. The other four scenarios retain supplier exposure only.

The characteristic visual moment is the exact default cascade:

| Column | Suppliers |
| --- | --- |
| Direct disruption | Altiplano Rare Earth |
| Tier 1 | Shenzhen Micro Sensors; Great Lakes Stamping |
| Tier 2 | Delta Assembly Works; Ardennes Wiring Systems |
| Tier 3 | Cascade Final Assembly |

Dependency lines follow actual recorded edges between these suppliers. Membership always comes from `AnalysisResult`; frontend traversal only orders and lays out the reveal. One direct plus five downstream suppliers produces the saved **0.961** network risk result. The score is an exposure ranking input, not a probability of failure or a revenue estimate.

Evidence receipt highlights, tier-by-tier node arrivals, traced paths, and stage transitions direct attention to new information. The comparison persists long enough to read. The default operational draft is derived from the same simulated records and selected option shown in the comparison; other scenarios use saved backend template output. Drafts remain unsent. View plan makes the full example directly reviewable without waiting for playback.

## Live workflow

Demo and live modes share the header, processing rail, supplier board, dependency view, and response panel. Their data boundaries remain visible. Demo mode plays saved results without contacting services. Live mode reads the local API, displays the request wait, and then animates the returned exposure; it does not simulate a live evidence-ingestion trace that the API does not provide.

Live response wording can come from the local model or the backend's template fallback. Regeneration changes wording without changing the affected supplier set. The activity panel reads the independent backend monitor and distinguishes flagged, delivered, below-threshold, and failed outcomes. The browser does not own the unattended monitoring loop.

Status conveys evidence, not reassurance. A configured hostname does not imply service health. An outbound-block count is shown as verified only when the backend explicitly reports an active guard. Failed reads clear older readings and show an unavailable state. Monitor delivery failures are labeled as undelivered, not successful alerts.

## Control, motion and recovery

The demo uses one cancellable playback timer; pause retains the remaining duration, advancing one step leaves playback paused, and hiding the tab pauses the run. Previously reached stages can be revisited. Scenario changes, reset, and mode changes start cleanly. Evidence inspection pauses the animation so the record can be read.

Dependency reveals use a 550ms tier cadence. CSS motion is purposeful: acknowledge a received record, expose a new dependency, or introduce the current stage. Reduced motion removes animated movement and makes live tier updates immediate while retaining the information and controls.

Live requests are bounded and abortable. Loading, retryable connection failure, a connected-but-empty dataset, analysis failure, and unavailable monitoring have distinct states. Reset and mode changes invalidate older work so late responses cannot overwrite the current workspace. There is no automatic switch to demo data after a live failure.

## Responsive and accessible behavior

At desktop sizes, the evidence ledger sits beside the active stage and dependency tiers are separate columns. The operational comparison uses a semantic table; below 620px of component width, each policy becomes a labeled grid of metrics. Below 760px of viewport width, the ledger moves below the stage and the processing rail becomes a two-column grid. Below 560px, supplier tiers stack vertically and connector artwork is hidden; the tier labels preserve the relationship without tiny cards or horizontal scrolling.

Use real buttons and selects, visible keyboard focus, an accessible demo switch, a skip link, labeled status text, and keyboard-operable report tabs. Meaning must not depend on color or motion alone. Keep supplier names and parts readable and allow long draft text to wrap. The supplier board remains available below the main flow for inspection and filtering.

## Design skill provenance

The following skills informed the design work and were installed into `~/.codex/skills`:

- [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design): hierarchy, typography, product-specific focus, and critique.
- [Impeccable](https://github.com/pbakaus/impeccable): purposeful motion, clear evidence-backed copy, controls, and accessibility. Its optional context binary failed checksum-sidecar verification; existing project context was read directly and no unverified binary ran.
- [Webapp Testing](https://github.com/composio-community/awesome-codex-skills/tree/master/webapp-testing): browser inspection, interaction checks, and desktop/mobile layout review.
- [Theme Factory](https://github.com/composio-community/awesome-codex-skills/tree/master/theme-factory): installed as a reference; no preset was applied because the current clean identity was retained.

The discovery source was [Composio's design-skills list](https://composio.dev/content/top-design-skills). The project's code, seeded data, supplied video, and explicit user preferences remain the source of truth for the interface.
