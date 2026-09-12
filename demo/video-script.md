# Demo video — 2:00 shooting script

**Hard limit 2:00.** Narration is budgeted at **262 words ≈ 1:53**, leaving ~7s of
headroom. Do not add lines without cutting others.

**Prompt:** *one day to build an AI agent that runs locally on the box (no cloud API)
and helps businesses or corporates.*

> Written by Person 1; `demo/` was empty so nothing was overwritten. Person 4 owns it now.

---

## The one idea that makes 2:00 work

**The voice tells the story. The screen carries the facts.**

Every number — supplier counts, risk scores, latency, "no cloud" — appears as an
on-screen caption, never spoken. Spending 4 seconds saying "network risk zero point nine
six one" is 3% of your entire runtime. A caption costs zero.

And mechanism gets explained *while* the demo runs, not before it, via a persistent
**pipeline rail** across the bottom of every shot:

```
 ┌──────────┐   ┌───────────────┐   ┌──────────────┐   ┌──────────┐   ┌───────────┐
 │ MongoDB  │──▶│ propagation.py│──▶│ Qwen via     │──▶│ approval │──▶│ audit log │
 │  local   │   │ deterministic │   │ OpenClaw     │   │ to Slack │   │           │
 └──────────┘   └───────────────┘   └──────────────┘   └──────────┘   └───────────┘
```

Each box is grey `#2a2f3c`; it lights `#7aa9ff` for ~700ms as that stage executes, then
settles to a dim blue "done" state. By 0:55 the viewer has watched the architecture run
without a single sentence spent describing it. **This rail is how the video answers "how
does it work and where does the data come from" inside a 2-minute budget.**

---

## Criteria mapping

| Criterion | % | Earned at | How |
| --- | --- | --- | --- |
| **Local-first + always-on** | 30 | 0:12 caption · **0:55–1:17** · 1:26 | Badge + enforced guard, and the agent assessing a new event with nobody touching the machine. **Half this criterion is "acts on its own over time" — beat 4 is the only place it's earned. Never cut it.** |
| **Business value** | 30 | 0:00–0:12 · **1:38–2:00** | Tier-3 exposure nobody can see today, caught before line-down. Self-filtering: 5 assessed, 3 escalated, 2 suppressed. |
| **Demo + pitch** | 30 | all of it | Six beats, one arc, no dead air. The staggered cascade at 0:30 is the hook. |
| **Technical execution** | 10 | 0:30 rail · 1:26–1:38 | Deterministic propagation lights separately from the model; kill the model live and it still answers. |

---

## ⚠️ Before you shoot

| Piece | State |
| --- | --- |
| `backend/agent/` (incl. `monitor.py`) | done — 143 checks green |
| `backend/data/` + `backend/api/` | done — 77 integration checks green |
| `frontend/` | **empty** — beats 2, 3, 5 need it |
| offline badge hook | **empty** |
| monitor wired into API | **two lines** — see beat 4 |

**Never say these two things:**
1. *"Running Qwen 3.6 35B"* — no real call has been made from this repo; not installed on
   the dev machine. Say **"Qwen, locally, through OpenClaw"** until someone runs it on the
   GB10.
2. *"They reply APPROVE and it sends"* — nothing consumes a reply. Say **"for their
   approval"** and stop.

---

## Visual system

| | |
| --- | --- |
| Canvas | 1920×1080, 60fps, screen capture — no webcam |
| Ground | `#0b0d12`; panels `#151922`; hairlines `#262c3a` |
| Text | `#eceef4`; muted `#8b94a8`; **18px minimum**, 15px never |
| Status | green `#3ad19b` · amber `#f5b64f` · red `#ff6b6b` · accent `#7aa9ff` |
| Motion | 240ms ease-out for entrances; 600ms pulse; never linear |
| Captions | bottom-left chip, `#151922` at 92%, 22px, 240ms fade, on screen ≥2.5s |
| Cursor | hide it except when clicking. Jittery cursors read as amateur |

Record each beat separately and cut them together. One continuous take at 2:00 will cost
you more retakes than it saves.

---

## Pre-flight

```bash
docker start markovathon-mongo || docker run -d --name markovathon-mongo -p 27017:27017 mongo:7
python -m backend.data.seed         # idempotent — your reset between takes
python -m backend.agent             # must be ALL GREEN or don't roll
MONITOR_INTERVAL=8 python -m uvicorn backend.api.main:app --port 8000 &
python backend/agent/mock_openclaw.py --port 18789 &
cd frontend && npm run dev
```

`MONITOR_INTERVAL=8` for filming so beat 4's wait is ~8s, not 30. `printenv OLLAMA_HOST`
must be empty or allowlisted, or you'll film fallback prose without knowing.

---

# THE SHOT LIST

### Beat 1 · The problem — 0:00–0:12 (12s)

| | |
| --- | --- |
| **On screen** | Cold open, no title card. The board assembles itself: 10 supplier cards, 5×2, fading in on a 40ms stagger. Rail dim. |
| **Caption** | `Supplier network · running entirely on local hardware` |
| **Narration (29w)** | "Every manufacturer knows its direct suppliers. Almost none can see three tiers down. That's where the failures come from — and where this agent looks, entirely on your own hardware." |

**Direction.** No logo, no "hi we're team X". You have 120 seconds; spend none of them on
a title.

---

### Beat 2 · Where the data comes from — 0:12–0:30 (18s)

| | |
| --- | --- |
| **On screen** | Status dots resolve green/amber/red. Amber rings appear on the four single-source cards. **Rail: MongoDB lights.** At 0:22, a small terminal inset (bottom-right, 2s) shows the real response scrolling: `curl -s localhost:8000/api/suppliers \| jq '.[0]'` |
| **Caption** | `10 suppliers · live from local MongoDB · no cloud, no API keys` |
| **Narration (39w)** | "Ten suppliers, live from a local MongoDB. Parts, compliance status, and who depends on whom. Four are single-source: if one stops, there's no alternate. No cloud, no API keys — supplier data like this usually can't legally leave the building." |

**Direction.** That 2-second terminal inset is doing real work: it proves the board is
reading a database rather than a hardcoded array. Don't skip it and don't narrate it.

---

### Beat 3 · The cascade — 0:30–0:55 (25s) ★ the hook

| | |
| --- | --- |
| **On screen** | Select `evt_004`; amber banner slides in. Then, **with silence between each step**: ① Altiplano pulses red twice, alone, card lifting 4px. ② *500ms* — line draws to two cards, both pulse. ③ *500ms* — lines extend, two more pulse. ④ *500ms* — final line; **Cascade Final Assembly** pulses and labels itself *Finished powertrain module*. ⑤ Gauge eases up to **0.961**. **Rail: propagation.py lights at ①.** Lines stay on screen. |
| **Caption** | `deterministic Python — the model is never asked which suppliers are affected` then `network risk 0.961 · 3 tiers · 6 suppliers` |
| **Narration (45w)** | "A rare-earth export licence is suspended in Chile. Altiplano is hit directly — single-source, already non-compliant. *(pause)* One tier down, two suppliers lose their input. *(pause)* Two tiers down, two more. *(pause)* Three tiers down: the finished powertrain module. One licence decision, four tiers from the product they sell." |

**Direction.** **The pauses are the demo.** Shoot this beat five times and keep the
calmest. Leave every connecting line lit so the full path is readable at 0:55. If one
beat gets an extra second, it's this one.

**Not theatre:** `propagation.py` returns `cascade_by_hop` = `{"1":[2],"2":[2],"3":[1]}` —
the reveal timing is computed structure.

---

### Beat 4 · It doesn't wait to be asked — 0:55–1:17 (22s) ★★ **30% lives here**

| | |
| --- | --- |
| **On screen** | Cut to the **Agent activity** panel — a live audit trail, newest on top. **Hide the cursor for this entire beat.** Three timestamped rows are already there: two `assessed_no_alert` with reasons, one `alert_dispatched`. Then a visible terminal inset pastes one `mongosh` insert. Nobody clicks anything. ~8s later a new row appears on its own and the rail's approval box lights. |
| **Caption** | `unattended · wakes on a timer` then `5 assessed · 3 escalated · 2 suppressed — it filters its own noise` |
| **Narration (45w)** | "Nothing so far needed me. It also runs unattended — waking on a timer, scoring new events, escalating only what matters. Two of five scored below the floor; it logged why and moved on. I'll add a disruption now and touch nothing." *(let the wait sit in silence)* "Found it. Escalated it." |

**Direction.** **Do not fill the wait with talking.** Eight seconds of silence while
software works on its own is the most persuasive thing in the video. If you're over
runtime, take the second from beat 6 — not this one.

**Wiring (Person 2, two lines) in the API lifespan:**
```python
from backend.agent import monitor
monitor.start(lambda: (repository.get_all_events(), repository.get_all_suppliers()))
```
plus `GET /api/monitor/activity` → `monitor.activity()` for Person 3 to poll.

---

### Beat 5 · Draft, delivered — 1:17–1:38 (21s)

| | |
| --- | --- |
| **On screen** | Split: left, the risk summary types at 40ms/char and the draft renders as a real email with `To:`/`Subject:`. **Rail: Qwen-via-OpenClaw lights.** Right, a phone inset slides in and the Slack message lands. Then jump-cut to a terminal, kill the model process, re-fire the event — panel refills in under a second. **Rail: model box greys out, everything else still lights.** |
| **Caption** | `drafted for human approval — nothing sent` then `model killed · HTTP 200 in 0.57s` |
| **Narration (45w)** | "The draft goes to the compliance officer where they already work — through OpenClaw, running locally. And zero external calls isn't a claim: any non-local request raises. Kill the model mid-demo —" *(kill it)* "— and the analysis still completes. The propagation is deterministic; the wording falls back to templates." |

**Direction.** Rehearse the kill to one keystroke. If OpenClaw isn't pointed at a real
channel, **cut the phone inset** rather than fake it — beat 4 already carries the
autonomy claim, and a staged inbox is the one thing that would cost you credibility.

---

### Beat 6 · What it's worth — 1:38–2:00 (22s)

| | |
| --- | --- |
| **On screen** | Pull back to the full board, cascade path still lit, gauge at 0.961, **External calls blocked: 0** badge zoomed slightly. Rail fully lit, end to end. Hold the final frame 1.5s after the last word. |
| **Caption** | `3 tiers of visibility · 0.57s with the model down · 143 + 77 automated checks` |
| **Narration (59w)** | "So: an agent that watches your supplier network on your own hardware, finds the exposure three tiers down that nobody sees today, and puts a drafted response in front of the person who can approve it — before it's a line-down event. For regulated manufacturing, running locally isn't a feature. It's the only way they can run this at all." |

**Direction.** That last sentence is the pitch. Land it clean, then stop talking and let
the final frame breathe. Don't add "thanks for watching".

---

## If you're over 2:00, cut in this order

1. The 2s terminal inset in beat 2 (−2s)
2. The phone inset in beat 5, keeping the draft and the kill (−4s)
3. One pause in beat 3, never more than one (−1.5s)
4. Trim beat 6's narration to end at *"...before it's a line-down event."* (−6s)

**Never cut:** beat 4, or the three staggered pauses in beat 3. Those are 30% of the
score and the entire visual hook respectively.

---

## Plan B — filmable today, no frontend

Six terminal shots, ~1:50: `python -m backend.agent` (143 green) → `python -m
backend.agent.monitor` (**the autonomy beat**: 5 assessed, 3 escalated, 2 suppressed,
silent on re-scan) → `curl .../api/suppliers | jq` → `curl -X POST .../api/analyze` (3-hop
cascade + drafted email) → `python -m backend.agent.openclaw` (the approval message) →
kill the model, repeat the analyze call. 18px+ font, generous line height.

---

## Off-camera: prepared answers

**"Is it really no-cloud?"** Enforced, not asserted. Outbound HTTP raises on any
non-loopback host; the badge is that hook. Model host, gateway and database URI are all
verified before a socket opens — we caught a dev machine pointing `OLLAMA_HOST` at another
box. If the model legitimately sits on a separate machine you own, that host must be named
explicitly and reports as *allowlisted*, not loopback.

**"How is this always-on rather than a button?"** `monitor.py` runs in a daemon thread,
wakes on an interval, assesses anything unseen, deduplicates, applies a severity *and*
risk floor, and keeps an audit trail of what it ignored and why. Beat 4 inserts straight
into the database and never touches the UI.

**"Could the model invent a supplier?"** It's never asked which are affected — that's
deterministic Python. It receives resolved names to write prose about, and a gate rejects
text naming none of the identified suppliers.

**"Did you test with the real model?"** Not yet — honest. Every path is verified against
local mocks over real HTTP, 43 checks on the gateway alone, and the deterministic fallback
means the demo works either way. *Don't dress this up; a clean "not yet" beats a hedge
that unravels.*

**"Cycles in the dependency graph?"** Bounded breadth-first walk with cycle protection,
recording the shortest path to each supplier. Tested.
