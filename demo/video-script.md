# Demo video — script, play-by-play, and criteria mapping

**Runtime: 5:00** (the pitch length in the rubric). A 3:00 cut is marked ⚡.

**Hackathon prompt:** *one day to build an AI agent that runs locally on the box
(no cloud API) and helps businesses or corporates.*

> Written by Person 1. Lives in `demo/` because that's where it belongs — the folder was
> empty, so nothing was overwritten. Person 4 owns it from here.

---

## Criteria mapping — every criterion, where it's earned

| Criterion | % | Where it's earned | What specifically earns it |
| --- | --- | --- | --- |
| **Local-first + always-on** | 30 | **Act 4** (0:00 badge, 2:15 monitor, 3:40 proof) | No cloud LLM call is possible: a non-loopback host is refused before a socket opens. And the agent runs unattended — `monitor.py` wakes on an interval, assesses new events, and escalates without anyone clicking anything. **This is the criterion most demos will miss; give it the most airtime.** |
| **Business value** | 30 | **Act 1** framing, **Act 7** close | Tier-3 exposure that a buyer cannot see today, found before it becomes a line-down event. Plus measured triage: 5 events assessed, 3 escalated, 2 suppressed — the agent filters its own noise. |
| **Demo + pitch** | 30 | the whole 5:00 | Clear arc: network → disruption → reasoning → autonomy → approval → proof → value. The staggered cascade in Act 2 is the visual hook. |
| **Technical execution** | 10 | **Act 3** + **Act 6** | 143 automated checks in the agent core, 77 end-to-end through the real API and MongoDB. Kill the model live and it still returns HTTP 200 in 0.57s. |

**Where the weight actually is:** local-first *and always-on* is 30%, and "the agent acts
on its own over time" is half of that sentence. Act 4 exists entirely to satisfy it. If
you have to cut for time, cut Act 5 before Act 4.

---

## ⚠️ State of the build — read before planning the shoot

| Piece | State | Needed for |
| --- | --- | --- |
| `backend/agent/` | done — 143 checks green, incl. the monitor | every act |
| `backend/data/` + `backend/api/` | done — 77 integration checks green | every act |
| `frontend/` | **empty** | Acts 1–3, 5 (board, cascade, panel) |
| `demo/` offline hook | **empty** | the badge in Acts 1 and 6 |
| monitor wired into the API | **not yet** — two lines, see below | Act 4 |

Plan A doubles as a build spec for Persons 3 and 4. **Plan B** at the bottom is a
terminal cut you could film today with every frame real.

**Two things nobody should say on camera yet:**

1. **"Running Qwen 3.6 35B."** No real `qwen3.6:35b` call has ever been made from this
   repo, and no real OpenClaw gateway has been contacted — neither is installed on the
   dev machine. Both paths are verified against local mocks over real HTTP. Once it runs
   on the GB10 this becomes true and you should say it. Until then, Act 3 gives wording
   that is honest.
2. **"They reply APPROVE and it sends."** Nothing consumes a reply — there's no inbound
   handler. Say *"drafted for their approval"* and stop.

---

## The scenario — locked

**Event `evt_004`.** The only seeded event with a three-hop cascade.

> *Export licence suspension on rare-earth concentrate, indefinite* — Antofagasta, CL — **HIGH**

| Hop | Supplier | Part | Flags | Score |
| --- | --- | --- | --- | --- |
| 0 | **Altiplano Rare Earth** | Neodymium magnet billet | single-source, **non-compliant** | 0.885 |
| 1 | Shenzhen Micro Sensors | Manifold pressure sensor array | single-source, at-risk | 0.381 |
| 1 | Great Lakes Stamping | Stamped steel mounting bracket | — | 0.179 |
| 2 | Delta Assembly Works | Turbocharger subassembly | at-risk | 0.166 |
| 2 | Ardennes Wiring Systems | Engine bay wiring harness | — | 0.102 |
| 3 | **Cascade Final Assembly** | **Finished powertrain module** | single-source | 0.100 |

**Network risk: 0.961.** One licence decision in Chile stops the finished product four
tiers away. That's the entire business case and it needs no embellishment.

---

## Pre-flight

```bash
docker start markovathon-mongo || docker run -d --name markovathon-mongo -p 27017:27017 mongo:7
python -m backend.data.seed        # idempotent — your reset between takes
python -m backend.agent            # must be ALL GREEN before you roll
python backend/agent/mock_openclaw.py --port 18789 &   # or the real gateway
python -m uvicorn backend.api.main:app --port 8000 &
cd frontend && npm run dev
```

On the GB10, everything is loopback and nothing extra is needed. If the model lives on
the GB10 while the API runs elsewhere, set `OLLAMA_ALLOW_HOST=<that hostname>` — it
permits exactly that one host and `/api/offline-status` reports it as allowlisted rather
than loopback, so the claim on screen stays accurate.

**`printenv OLLAMA_HOST`** — if it names a box you haven't allowlisted, the agent refuses
it and you'll film fallback prose without realising.

---

# PLAN A — the full film

## Act 1 · The problem, in one board (0:00–0:40) ⚡

**Visual.** Dark ground (`#0b0d12`). Ten supplier cards, 5×2, each with name, part and a
status dot — green `#3ad19b`, amber `#f5b64f`, red `#ff6b6b`. Cards fade in on a 40ms
stagger so the board assembles itself. A thin amber ring marks the four single-source
suppliers. Top-right: **External calls blocked: 0**.

**Narration.**
> "Every manufacturer knows its direct suppliers. Almost none can see three tiers down —
> and that's where the failures come from. This is a supplier network: ten suppliers,
> their parts, their compliance status. Four are single-source, so if one stops there's
> no qualified alternate. All of this runs on the box in front of you. No cloud, no API
> keys, nothing leaves the building — which for supplier and compliance data is usually
> a contractual requirement, not a preference."

**Direction.** Hold the calm board for a beat before anything moves.

---

## Act 2 · The cascade (0:40–1:30) ⚡

**Visual.** Select `evt_004`. Amber event banner slides in. Then:

1. **Altiplano Rare Earth** pulses red twice (~600ms), alone, card lifting 4px with a red glow.
2. **500ms silence.** A line draws to two cards; **Shenzhen Micro Sensors** and **Great Lakes Stamping** pulse.
3. **500ms silence.** Lines extend; **Delta Assembly Works** and **Ardennes Wiring Systems** pulse.
4. **500ms silence.** One final line; **Cascade Final Assembly** pulses, and a label appears: *Finished powertrain module*.
5. A gauge counts up, easing out, stopping at **0.961**.

**Narration.**
> "A rare-earth export licence is suspended in Chile. Altiplano is hit directly — single
> source, and already non-compliant.
> *(pause)* One tier down, two suppliers lose their input.
> *(pause)* Two tiers down, two more.
> *(pause)* Three tiers down: the finished powertrain module. One licence decision, four
> tiers from the product they sell."

**Direction.** **The pauses are the demo.** Let each hop land in silence. Leave the
connecting lines on screen so the full path is visible at the end. Shoot it three times,
keep the calmest take. This is the hook.

**If asked whether the timing is theatre:** it isn't — `propagation.py` returns
`cascade_by_hop` as `{"1": [2], "2": [2], "3": [1]}`, so the reveal is driven by computed
structure.

---

## Act 3 · Why it can't lie (1:30–2:15) ⚡

**Visual.** Right panel slides in. The summary types at ~40ms/char — the typing *is* the
"thinking" signal. Below it the draft renders in monospace as a real email with `To:` and
`Subject:`.

**Narration.**
> "Here's the part that has to be reliable. *Which* suppliers are affected, and how risk
> cascades, is deterministic Python — not a language model. The model is never asked which
> suppliers are involved, so it cannot name the wrong one. What it does write is the
> assessment and a drafted report for a human to approve. The model runs locally through
> OpenClaw, with Qwen behind it."

**Direction.** Don't read the on-screen text aloud. Talk over it while they read.

---

## Act 4 · It doesn't wait to be asked (2:15–3:00) ⚡ **← 30% lives here**

**Visual.** Switch to an **Agent activity** panel: a live audit trail, newest at top.
Nobody touches the mouse for the whole act. A timestamped line appears on its own:

```
16:04:12   evt_002   assessed_no_alert     risk=0.397   network risk 0.397 below 0.5
16:04:12   evt_003   assessed_no_alert     risk=0.447   network risk 0.447 below 0.5
16:04:12   evt_005   alert_dispatched      risk=0.726   severity high, network risk 0.726
```

Then insert a new event into Mongo from a visible terminal — and **without any click**,
within one interval, a new line appears and an alert fires.

**Narration.**
> "Nothing I've shown so far needed me. This agent runs unattended. It wakes on an
> interval, assesses every event it hasn't seen, and decides on its own which ones a human
> should actually look at. Two of these five scored below the risk floor — it assessed
> them, logged why, and left them alone. That matters: an agent that pages you about
> everything gets muted in a week. And it never alerts twice on the same event.
> *(insert the event)* I've just added a new disruption to the database. I'm not going to
> click anything."
> *(wait — let the silence sit)*
> "There it is. It found it, scored it, and escalated it."

**Direction.** **Do not fill the wait with talking.** The silence while it works
autonomously is the entire point of the act. Set `MONITOR_INTERVAL=10` for filming so the
wait is ~10s rather than 30. Rehearse the insert as one paste.

**Wiring needed (Person 2, two lines):** in the API lifespan —
```python
from backend.agent import monitor
monitor.start(lambda: (repository.get_all_events(), repository.get_all_suppliers()))
```
plus `GET /api/monitor/status` → `monitor.status()` and `GET /api/monitor/activity` →
`monitor.activity()` for Person 3 to poll.

---

## Act 5 · Approval reaches a human (3:00–3:40)

**Visual.** The money shot: a phone inset slides into the lower-right and a Slack message
arrives — severity headline, affected supplier IDs, risk score, cascade depth per hop, the
full draft, and the decision prompt.

**Narration.**
> "The agent drafts a report *for human approval*, so it goes where the compliance officer
> already works. That's OpenClaw — it runs locally and reaches people in the apps they
> already use. The draft has left the browser and arrived on a phone, and still nothing has
> left this machine."

**Direction.** Film a real phone or a clean screen mirror. If OpenClaw isn't configured
against a real channel, **cut this act rather than stage it** — a faked inbox reads as
faked, and Act 4 already carries the autonomy point.

---

## Act 6 · The proof (3:40–4:20) ⚡

**Visual.** Zoom the badge: **External calls blocked: 0**. Then, in one visible motion,
kill the model process and re-fire the same event. The panel fills anyway, in well under a
second.

**Narration.**
> "Zero external calls — enforced, not claimed. Any outbound request to a non-local host
> raises, and that counter is the hook doing it. Both the model host and the database URI
> are verified as local before a socket opens. And when the model dies mid-demo —" *(kill
> it)* "— the analysis still completes. Propagation is deterministic and the narration falls
> back to templates. There's no failure mode where this shows you nothing."

**Direction.** Rehearse the kill to one keystroke. Measured: **HTTP 200 in 0.57s**, full
prose, nothing logged as an error.

---

## Act 7 · What it's worth (4:20–5:00) ⚡

**Visual.** Back to the full board, cascade path still lit, risk gauge at 0.961.

**Narration.**
> "So: an agent that watches a supplier network on your own hardware, finds the exposure
> three tiers down that nobody can see today, and puts a drafted response in front of the
> person who can approve it — before it becomes a line-down event. It filters its own
> noise, it runs unattended, and it works with the model switched off. For any company
> whose supplier and compliance data legally cannot go to a cloud model — regulated
> manufacturing, defence, pharma — that last part isn't a feature. It's the only way they
> can run this at all."

**Numbers you can defend.** Use these, and **do not invent dollar figures** — one
follow-up question and an invented number costs more than it earns:
- 3 tiers of visibility vs. the 1 tier a buyer typically has
- 5 events assessed, 3 escalated, 2 suppressed — measured, from the seeded set
- 0.57s end-to-end with the model down
- 143 + 77 automated checks

---

# PLAN B — the cut you can film today

No frontend needed. ~2:30, every frame real.

| # | Command | Shows |
| --- | --- | --- |
| 1 | `python -m backend.agent` | 143 checks green, incl. the unattended scan |
| 2 | `python -m backend.agent.monitor` | **the autonomy criterion**: 5 assessed, 3 escalated, 2 suppressed with reasons, dedup on re-scan |
| 3 | `curl -s localhost:8000/api/suppliers \| jq '.[0]'` | live data from MongoDB, contract-shaped |
| 4 | `curl -s -X POST localhost:8000/api/analyze -d '{"event_id":"evt_004"}' \| jq` | 1 direct, 5 cascading, 3 hops, drafted email |
| 5 | `python -m backend.agent.openclaw` | the approval message exactly as delivered |
| 6 | kill the model → repeat 4 | 200 in 0.57s, prose intact |

Record at 16px+ with generous line height. Tiny terminal text kills more demo videos than
bad ideas.

---

## If it breaks on the day

| Symptom | Do this |
| --- | --- |
| Board empty | `python -m backend.data.seed` — idempotent, safe mid-demo |
| Prose looks templated | `printenv OLLAMA_HOST` — an un-allowlisted host is refused by design |
| Monitor seems idle | `GET /api/monitor/status` shows ticks and uptime; `MONITOR_INTERVAL` may just be 30s |
| Alert didn't arrive | say "delivery is best-effort and reports honestly" — the response carries `delivered: false` and a reason. Move on |
| Anything 500s | re-run the seeder, re-click. Don't debug on camera |

**Record a clean backup take the moment one exists.** A recording of a real run isn't
cheating.

---

## Prepared answers

**"Is it really no-cloud, or do you just say so?"**
> Enforced. Outbound HTTP is patched to raise on any non-loopback host; the counter on
> screen is that hook. The model host, gateway and database URI are all verified before a
> socket opens. We caught a dev machine with `OLLAMA_HOST` pointed at another box, which
> would have silently made it a remote client. If the model legitimately runs on a separate
> box you own, that host has to be named explicitly and it's reported as allowlisted, not
> loopback.

**"How is this 'always-on' rather than a button?"**
> `monitor.py` runs in a daemon thread, wakes on an interval, and assesses anything it
> hasn't seen. It deduplicates, applies a severity and risk floor, and keeps an audit trail
> of what it ignored and why. Act 4 adds an event to the database without touching the UI
> and the agent picks it up on its own.

**"Couldn't the LLM invent a supplier?"**
> It's never asked which suppliers are affected — that's deterministic Python. The model
> only receives resolved names to write prose about, and there's a gate that rejects
> generated text naming none of the identified suppliers.

**"Did you test with the real model?"**
> Not yet, and that's honest — every path is verified against local mocks over real HTTP,
> 43 checks on the gateway alone, and the deterministic fallback means the demo works
> either way. *(Don't dress this up. A clean "not yet" beats a hedge that unravels.)*

**"What if a supplier depends on one that depends on it?"**
> Handled — bounded breadth-first walk with cycle protection, recording the shortest path
> to each supplier. There's a test for exactly that.
