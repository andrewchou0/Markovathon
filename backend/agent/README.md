# /backend/agent — reasoning core (Person 1)

Two modules, one rule: **`propagation.py` decides, `narrate.py` describes.**

| File | Job | Depends on |
| --- | --- | --- |
| `propagation.py` | which suppliers are hit, what cascades, how bad | nothing — stdlib only |
| `narrate.py` | the two prose fields, via local Ollama | `httpx` if present, else stdlib |
| `mock_ollama.py` | test fixture: a fake model on localhost | stdlib only |
| `__main__.py` | `python -m backend.agent` — full self-test | the above |

## Status: done and green

```bash
python -m backend.agent          # 83 checks: both suites + the API handoff
```

Runs with **no API, no frontend, no MongoDB and no Ollama**. Needs nothing started.

## Wiring it up — for Person 2

This is the entire body of `POST /api/analyze`. Nothing else is needed:

```python
from backend.agent import narrate, propagation

risk = propagation.get_affected_suppliers(event, suppliers)   # event/suppliers = plain dicts
direct, cascade = risk["directly_affected"], risk["cascading_affected"]

return {
    "event": event,
    "directly_affected": direct,
    "cascading_affected": cascade,
    "risk_summary": narrate.generate_risk_summary(event, direct, cascade, suppliers),
    "draft_report": narrate.generate_draft_report(event, direct, cascade, suppliers),
}
```

For `POST /api/actions/draft`, call `generate_draft_report(...)` on its own — it never
touches propagation, so "regenerate" re-runs only the text.

Things you do not need to handle:

- **Neither narrate function ever raises**, and neither ever returns an empty string.
  No try/except needed at the route. If the model is down, prose still comes back.
- **Malformed input never raises either.** `None`, `{}`, wrong types, unknown supplier
  ids, a `downstream_dependents` entry pointing at a supplier that doesn't exist — all
  handled, with anything suspicious reported in `risk["diagnostics"]`.
- I take plain dicts and return plain dicts. I never import `pymongo` and never see an
  `_id`, as long as your repository layer keeps projecting `{"_id": 0}`.

## Extra keys you can ignore, or use — for Person 3

`get_affected_suppliers()` returns the two contract keys **plus** these. Additive only;
nothing existing was renamed, so ignoring them is safe:

| Key | Use |
| --- | --- |
| `cascade_by_hop` | `{"1": [ids], "2": [ids]}` — **this is your stagger**: reveal hop 1, wait 400-600ms, reveal hop 2 |
| `hop_depth` | `{id: 0}` for direct, `1..N` per hop |
| `impact_scores` | `{id: 0.0-1.0}` — card intensity, or a number on the card |
| `network_risk_score` | one headline 0.0-1.0 figure for the whole event |
| `single_source_exposed` | affected ids with no qualified alternate — the ones worth badging |
| `ranked_affected` | every affected id, most exposed first |
| `diagnostics` | why each supplier matched, plus any bad fixture data |

On the demo event that yields `{"1": ["sup_002","sup_003"], "2": ["sup_004"]}` — two
real hops, so the staggered reveal has a genuine second beat rather than a fake delay.

## For Person 4 — offline proof and status

```python
narrate.narration_health()     # never raises, never blocks beyond the connect timeout
# -> {"model", "host", "host_is_local", "reachable", "model_present", "mode", "stats", ...}
```

`mode` is `"llm"` or `"deterministic"`, so `/api/offline-status` can show what is
actually generating the text rather than asserting it.

Two things worth knowing for your hook:

1. `narrate.py` prefers **httpx** precisely so your monkeypatch covers the LLM path.
   It falls back to stdlib `urllib` only if httpx isn't installed.
2. **It refuses a non-local `OLLAMA_HOST` itself**, before opening a socket, and falls
   back to deterministic narration. This is not theoretical: a dev machine here had
   `OLLAMA_HOST=http://chimmychonga:11434` exported, which would have quietly turned
   the "fully offline" agent into a remote API client. Same guard you're applying to
   `MONGO_URI` — see below.

## Heads-up for everyone: check your shell

```bash
printenv OLLAMA_HOST      # must be empty, or http://localhost:11434
```

If it names another machine, unset it. The code now refuses it rather than calling it,
but you'll silently get fallback prose instead of model prose and wonder why.

## How reliability is achieved

The LLM is the only component that can fail, so it is the only one with a safety net:

1. **Connect fast, read patiently** — 3s connect, 90s read (`OLLAMA_READ_TIMEOUT`).
2. **Retry once, but never a timeout** — re-waiting a 90s timeout in front of an
   audience is worse than falling back.
3. **Sanitize** — strips `<think>` blocks, code fences and stacked preambles
   ("Certainly. Here's the draft: ```markdown Summary: ...") to a fixed point, then
   clamps the summary to 3 sentences.
4. **Quality gate** — output that is too short, or that names none of the suppliers
   propagation identified, is treated as a failure. Cheap hallucination guard: we
   already know who is affected, so prose mentioning none of them is describing
   something that didn't happen.
5. **Deterministic narrator** — on any failure, templates built from the same
   structured facts produce the summary and the email. Written to be presentable on
   screen, because that is exactly when they appear.

Fixed `seed=7` and `temperature=0.3`, so the same event reads the same way on every
take — worth knowing when Person 4 rehearses a script against it.

## Testing without a 35B model

`mock_ollama.py` serves the two endpoints `narrate.py` uses, on localhost:

```bash
python backend/agent/mock_ollama.py --port 11434              # behaves like a healthy model
OLLAMA_HOST=http://localhost:11434 python -m backend.agent    # now runs in llm mode
```

`--scenario` covers the failure modes deliberately: `good`, `messy`, `empty`,
`garbage`, `slow`, `error`. Handy for Person 3 — you can see real llm-mode text in the
result panel with no GPU and no 20GB download.

## What I have NOT verified

The live path is proven against `mock_ollama.py` over real HTTP (transport, retry,
parsing, sanitizing, gate, fallback — 36 checks), but **no real `qwen3.6:35b` call has
been made**: Ollama isn't installed on this machine. What's untested is therefore
model-specific only — actual latency, and whether the real model's phrasing clears the
quality gate. First person with Ollama running should do:

```bash
env -u OLLAMA_HOST python backend/agent/narrate.py
```

and post the reported latency. If the real thing is slow or its prose trips the gate,
those are both one-constant changes in `narrate.py` — and the fallback covers the demo
in the meantime.
