YOUR ROLE: Build /demo/ and own final integration

Read CLAUDE.md (shared context) and /contracts/ first. You own /demo/, and you're
the one person who may make small coordinated edits elsewhere (the startup hook in
backend/api/main.py) — clear those with Person 2 before you touch the file.

1. Lock the exact demo scenario NOW, in the first hour: which event fires, which
   suppliers it hits directly, which cascade. Write this down as /demo/script.md
   and hand the specific supplier/event IDs to Person 2 so the fixtures are built
   to match exactly. Pick a single-source supplier with at least two downstream
   dependents — the cascade is the visual payoff.

2. Build the offline-mode enforcement: a startup hook (in backend/api/main.py,
   coordinate with Person 2) that monkeypatches the `requests` and `httpx`
   libraries to raise an exception if any call targets a host that isn't
   localhost/127.0.0.1. Keep a global counter of blocked-attempt calls (should stay
   at 0 in a working demo) and expose it via GET /api/offline-status returning
   {"external_calls_blocked": 0, "mode": "fully offline"}.

   Make sure the allowlist covers localhost:11434 — every Ollama call goes through
   the same patched library, so an over-strict patch takes down the whole agent.
   Test that the agent still narrates with the hook installed.

3. Write /demo/run.sh — a single script that starts Ollama (if not running, and
   verifies qwen3.6:35b is pulled: `ollama list | grep qwen3.6`), starts the
   FastAPI backend, and starts the frontend dev server, so the whole thing comes up
   with one command.

4. Starting a couple hours before demo time: run the full flow end-to-end
   repeatedly, record screen captures of it working as a fallback in case the live
   demo has issues, and be the one person floating between the other three to
   unblock whoever's stuck.

5. Write the actual spoken narration script for whoever presents, timed to match
   the visual beats Person 3 builds: supplier board, disruption hits, reasoning
   shown, action drafted, offline proof. The offline badge is the closing beat —
   "zero external calls, on a model running on this laptop" — so make sure it's on
   screen when you say it.
