YOUR ROLE: Build /frontend/

Read CLAUDE.md (shared context) and /contracts/ first. Do not touch any folder
other than /frontend/. React + Vite, plain CSS or Tailwind, no heavy UI library.

Do NOT wait for the backend to be running. Start immediately with a hardcoded fake
AnalysisResult — copy contracts/examples/analysis_result.example.json and
contracts/examples/suppliers.example.json straight in — and build the full UI
against that fake data first.

Build:

1. Supplier board: a grid of cards, one per supplier, showing name, part_supplied,
   and a colored status dot (green=compliant, yellow=at_risk, red=non_compliant).
   Mark single_source suppliers visibly — they're the ones the story is about.

2. Event trigger: a simple dropdown/button list of events (from GET /api/events
   once available, hardcoded list until then) that "fires" an event when clicked.

3. Disruption animation: when an event fires, the directly_affected supplier cards
   should visibly pulse/flash red first, then the cascading_affected cards flash a
   beat later (use a setTimeout stagger of ~400-600ms per hop — this staggered
   reveal is the key visual moment, don't skip it even if the backend returns
   everything instantly).

4. Result panel: shows risk_summary and draft_report text once the analysis
   completes. draft_report is an email, so render it in a monospace block with
   newlines preserved. Add a "regenerate draft" button that hits
   POST /api/actions/draft with the analysis result (it re-runs only the LLM text,
   not the propagation).

5. Offline badge: a small fixed-position badge, e.g. top-right, showing
   "External calls blocked: N". Person 4 owns GET /api/offline-status — build the
   UI element now with a hardcoded 0 and poll that endpoint once it exists. That
   response also reports which local hosts the model and the database are on, so
   leave room to render those two lines: "everything on localhost" is the claim the
   badge exists to make, and showing the DB host is what makes it credible.

A visible loading state on the result panel matters: the LLM call (qwen3.6:35b,
running locally) takes a moment, and dead air during a demo reads as a crash.
Ask Person 1 for the real latency number and make sure the UI looks deliberate for
that long.

Only swap hardcoded fake data for real fetch() calls to localhost:8000/api/... once
Person 2 confirms the API is live — coordinate this explicitly, don't just try it
silently.
