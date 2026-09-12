# Demo video — script and play-by-play

**Target runtime: 3:00.** A 90-second cut is marked with ⚡ on the beats to keep.

> **Written by Person 1.** This lives in Person 4's folder because that's where it
> belongs — `demo/` was empty, so nothing was overwritten. Person 4 owns it from here.

---

## ⚠️ Read this before you plan the shoot

Two of the four pieces this script films **do not exist yet** (checked at time of
writing):

| Piece | State | Needed for |
| --- | --- | --- |
| `backend/agent/` | done, 123 checks green | every beat |
| `backend/data/` + `backend/api/` | done, 77 integration checks green | every beat |
| `frontend/` | **empty** | Acts 1–3 (the board, the cascade, the panel) |
| `demo/` offline hook | **empty** | Act 4 (the badge) |

So: **Plan A** below is the full film and doubles as a build spec for Persons 3 and 4 —
every visual is specified tightly enough to implement directly. **Plan B**, at the
bottom, is a terminal-and-API cut you could record *today* that is still honest and
still lands the technical story.

Also unverified, and it affects one line of narration: no real `qwen3.6:35b` call and
no real OpenClaw gateway have ever been contacted from this repo — neither is installed
on the dev machine. Both paths are proven against local mocks over real HTTP. **Do not
say "running Qwen 3.6 35B" on camera until someone has actually run it.** Say what is
true instead: wording is given in Act 3.

---

## The scenario — locked

**Event `evt_004`** — the only one with a three-hop cascade. Use this one.

> *Export licence suspension on rare-earth concentrate, indefinite* — Antofagasta, CL — **HIGH**

| Hop | Supplier | Part | Flags | Score |
| --- | --- | --- | --- | --- |
| 0 | **Altiplano Rare Earth** | Neodymium magnet billet | single-source, **non-compliant** | 0.885 |
| 1 | Shenzhen Micro Sensors | Manifold pressure sensor array | single-source, at-risk | 0.381 |
| 1 | Great Lakes Stamping | Stamped steel mounting bracket | — | 0.179 |
| 2 | Delta Assembly Works | Turbocharger subassembly | at-risk | 0.166 |
| 2 | Ardennes Wiring Systems | Engine bay wiring harness | — | 0.102 |
| 3 | **Cascade Final Assembly** | **Finished powertrain module** | single-source | 0.100 |

**Network risk score: 0.961.**

Why this event and not the others: one licence decision in Chile stops the *finished
product* four tiers away. The chain terminates on the thing the company actually sells.
That's the whole argument for the product, and it needs no embellishment.

---

## Pre-flight — run this, in this order

```bash
docker start markovathon-mongo || docker run -d --name markovathon-mongo -p 27017:27017 mongo:7
python -m backend.data.seed                 # idempotent — this is your reset between takes
python backend/agent/mock_openclaw.py --port 18789 &     # or the real gateway
env -u OLLAMA_HOST python -m uvicorn backend.api.main:app --port 8000 &
cd frontend && npm run dev
```

- **`printenv OLLAMA_HOST` must be empty.** If it names another machine the agent
  refuses it and you'll silently film fallback prose.
- **Re-run the seeder between takes.** Clean board every time, one command.
- `python -m backend.agent` before you roll: if it isn't green, don't film.

---

# PLAN A — the full film

## Act 1 · The network (0:00–0:30) ⚡

**On screen.** Dark background (`#0b0d12`). Ten supplier cards in a 5×2 grid, each with
name, part, and a status dot — green `#3ad19b`, amber `#f5b64f`, red `#ff6b6b`. Cards
fade in on a 40ms stagger so the board assembles itself rather than appearing. A thin
amber ring marks the four single-source suppliers. Top-right, a small slate badge:
**External calls blocked: 0**.

**Narration.**
> "This is a supplier network — ten suppliers, the parts they ship, and their compliance
> status. Four of them are single-source: if one stops, there's no qualified alternate.
> Everything you're about to see runs on this laptop. Nothing leaves it."

**Direction.** Hold the full board for a beat before anything moves. The audience needs
to read it as *calm* so the disruption has something to break.

---

## Act 2 · The disruption (0:30–1:15) ⚡

**On screen.** Click the event dropdown → `evt_004`. The event banner slides in from the
top in amber, then:

1. **Altiplano Rare Earth** pulses red, twice, ~600ms — alone. Its card lifts 4px with a
   red glow.
2. **500ms pause.** A line draws from it to two cards; **Shenzhen Micro Sensors** and
   **Great Lakes Stamping** pulse.
3. **500ms pause.** Lines extend; **Delta Assembly Works** and **Ardennes Wiring
   Systems** pulse.
4. **500ms pause.** One final line; **Cascade Final Assembly** pulses — and a label
   appears beneath it: *Finished powertrain module*.
5. A risk gauge counts up, easing out, and stops at **0.961**.

**Narration.**
> "A rare-earth export licence is suspended in Chile. Altiplano is hit directly — and
> it's single-source and already non-compliant.
> *(pause)* One tier down, two suppliers lose their input.
> *(pause)* Two tiers down, two more.
> *(pause)* Three tiers down, the finished powertrain module. One licence decision,
> four tiers away from the product you actually sell. Network risk: 0.96."

**Direction.** **The pauses are the demo.** Let each hop land in silence before you
speak the next one. Don't dissolve the connecting lines — leave them, so by the end the
audience can see the whole propagation path at once. This is the single most important
shot in the video; shoot it three times and keep the calmest take.

**Why it holds up.** The hop timings aren't theatre — `propagation.py` returns
`cascade_by_hop` as `{"1": [2 ids], "2": [2 ids], "3": [1 id]}`, so the reveal is
driven by real computed structure. Worth saying if asked.

---

## Act 3 · The reasoning and the draft (1:15–2:10) ⚡

**On screen.** Right-hand panel slides in. The risk summary types out at ~40ms/char (not
instant — the typing *is* the "it's thinking" signal). Below it, the draft report renders
in monospace as a real email with `To:` and `Subject:` lines.

**Narration.**
> "Now the part that has to be reliable: *which* suppliers are affected, and how the
> risk cascades, is deterministic Python. Not a language model. The model can't name the
> wrong supplier, because it was never asked which ones were affected.
> What the model does write is this — the assessment, and a drafted report for a human to
> approve."

**The honest line about the model.** Until someone has run the real thing, say:
> "The model runs locally through OpenClaw, with Qwen behind it."

Once verified, upgrade to: *"…Qwen 3.6 35B, on this machine."* **Not before.**

**Direction.** Don't read the summary aloud — let the audience read while you talk over
it. Reading text on screen aloud is the fastest way to lose a room.

---

## Act 4 · Approval leaves the building (2:10–2:40) ⚡

**On screen.** Click **Send for approval**. Then — the money shot — a phone inset slides
into the lower-right corner and a Slack message arrives: severity headline, affected
supplier IDs, risk score, cascade depth per hop, the full draft, and the decision
prompt.

**Narration.**
> "This drafts a report *for human approval* — so it goes to the compliance officer
> where they already work. That's OpenClaw: it runs locally, and it reaches people in
> the apps they already use. The draft has left the browser and arrived on a phone, and
> still nothing has left this machine."

**Direction.** Use a real phone on a stand, filmed, or a clean screen mirror. A faked
mockup will read as faked. If OpenClaw isn't configured against a real channel, **cut
this act** rather than stage it — Plan B covers the alternative.

**⚠️ Do not say "and they reply APPROVE and it sends."** Nothing consumes a reply yet —
there's no inbound handler. Say *"for their approval"* and stop there.

---

## Act 5 · The proof (2:40–3:00) ⚡

**On screen.** Zoom the badge: **External calls blocked: 0**. Then, in one motion, kill
the model process in a visible terminal and click the same event again. The result panel
fills anyway, in well under a second.

**Narration.**
> "Zero external calls — enforced, not claimed: any outbound request to a non-local host
> raises. And when the model goes down mid-demo —" *(kill it)* "— the analysis still
> completes. The propagation is deterministic, and the narration falls back to
> templates. This doesn't have a failure mode where it shows you nothing."

**Direction.** Rehearse the kill until it's one keystroke. This is the strongest
engineering beat in the film and it's real: measured at **HTTP 200 in 0.57s** with full
prose and nothing logged as an error.

---

# PLAN B — the cut you can film today

No frontend required. Terminal-only, 2:00, and every frame is real.

| # | Command | What it shows |
| --- | --- | --- |
| 1 | `python -m backend.agent` | 123 checks going green, including "no Mongo `_id` leaked" and the API handoff |
| 2 | `curl -s localhost:8000/api/suppliers \| jq '.[0]'` | live data out of MongoDB, contract-shaped |
| 3 | `curl -s -X POST localhost:8000/api/analyze -d '{"event_id":"evt_004"}' \| jq` | the cascade: 1 direct, 5 cascading, 3 hops, and the drafted email |
| 4 | `python backend/agent/openclaw.py` | the approval message rendered exactly as it would be delivered |
| 5 | kill the model → re-run step 3 | 200 in 0.57s, prose intact |

Narrate it as *"here's the engine, and here's the proof it doesn't lie"*. Screen-record
at 1.5× line height with a 16px+ font; tiny terminal text kills more demo videos than
bad ideas do.

---

## Criteria mapping — **TO COMPLETE**

> I don't have the hackathon prompt or rubric. Paste it and I'll fill this in properly:
> one row per criterion, the timecode that satisfies it, and the exact sentence that
> earns it. Until then this table is deliberately empty rather than invented.

| Criterion | Beat | Timecode | What earns it |
| --- | --- | --- | --- |
| *(pending the prompt)* | | | |

What the current cut demonstrably proves, whatever the rubric turns out to be:

- **Local-first / privacy** — enforced, with a visible counter, and a guard that refuses
  a non-local host before opening a socket (Act 5)
- **Sponsor tooling, visibly used** — MongoDB (Act 1 data), OpenClaw as both model
  harness and approval channel (Acts 3–4), local Qwen behind the gateway
- **Technical depth** — deterministic multi-hop propagation with cycle protection,
  scores normalised rather than clamped, 123 + 77 automated checks
- **Reliability under failure** — the one beat most demos can't do (Act 5)
- **Real workflow, not a toy** — the output is a draft for a named human to approve

---

## If it breaks on the day

| Symptom | Do this |
| --- | --- |
| Board loads empty | `python -m backend.data.seed` — idempotent, safe mid-demo |
| Prose looks generic/templated | `printenv OLLAMA_HOST` — a non-local value is refused by design |
| `/api/analyze` hangs | it can't for longer than the timeouts; check the model process is actually up |
| Approval doesn't arrive | say "delivery is best-effort and reports honestly" — the response literally carries `delivered: false` and a reason. Then move on |
| Anything 500s | it shouldn't — but `git stash` nothing, just re-run the seeder and re-click |

**Record a full clean take as a backup the moment one exists.** Live demos fail; a
recording of a real run is not cheating.

---

## Prepared answers for judges

**"Is it actually offline, or do you just say so?"**
> Enforced. Outbound HTTP is monkeypatched to raise on any non-local host, and the
> counter on screen is that hook. The model host and the database URI are both verified
> to be localhost before a socket opens — we found a dev machine with `OLLAMA_HOST`
> pointed at another box, which would have silently made it a remote client.

**"How do I know the LLM isn't making up the affected suppliers?"**
> It can't — it's never asked. `propagation.py` computes the affected set in plain Python
> and the model only receives the resolved names to write prose about. There's also a
> gate that rejects generated text naming none of the identified suppliers.

**"Did you test it with the real model?"**
> Not yet — that's honest. Every path is verified against local mocks over real HTTP, 43
> checks on the gateway alone, and the deterministic fallback means the demo works either
> way. *(Don't dress this up. Judges respect a clean "not yet" far more than a hedge that
> unravels under one follow-up.)*

**"What happens when a supplier depends on a supplier that depends on it?"**
> Handled — the cascade is a bounded breadth-first walk with cycle protection, and it
> records the shortest path to each supplier. There's a test for exactly that.
