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

   Make sure the allowlist covers localhost:11434 (Ollama) AND localhost:27017
   (MongoDB). An over-strict patch takes down the agent and the database in one go.
   Test that the agent still narrates and the board still loads with the hook
   installed.

2b. The HTTP hook is not sufficient proof any more — close the Mongo gap.
   pymongo talks raw TCP sockets, so a database connection never passes through a
   requests/httpx patch. A teammate who "fixes" a connection issue by pasting an
   Atlas mongodb+srv:// URI would ship every supplier record to a cloud cluster
   while your badge still proudly reads "external calls blocked: 0".

   So at startup, also assert that MONGO_URI (from backend/data/db.py) parses to a
   host of localhost or 127.0.0.1, and raise immediately with a blunt message if it
   doesn't. Include the database host in the offline-status response so the claim is
   visible rather than assumed, e.g.
   {"external_calls_blocked": 0, "mode": "fully offline",
    "llm": "localhost:11434", "db": "localhost:27017"}.
   Tell Person 3 the final shape so the badge can show it.

3. Write /demo/run.sh — a single script that brings the whole stack up:
     - starts mongod if it isn't running (and creates/points at a --dbpath),
     - runs `python -m backend.data.seed` to load the fixtures (idempotent, so this
       is safe every launch and resets state between takes),
     - starts Ollama if not running, and verifies the model is pulled:
       `ollama list | grep qwen3.6`,
     - starts the FastAPI backend,
     - starts the frontend dev server.
   Fail fast with a readable message if any step doesn't come up — a script that
   half-starts is worse than one that stops and says why. Mongo is the newest
   moving part in the stack, so write and test this step early rather than at
   hour six.

4. Starting a couple hours before demo time: run the full flow end-to-end
   repeatedly, record screen captures of it working as a fallback in case the live
   demo has issues, and be the one person floating between the other three to
   unblock whoever's stuck.

5. Write the actual spoken narration script for whoever presents, timed to match
   the visual beats Person 3 builds: supplier board, disruption hits, reasoning
   shown, action drafted, offline proof. The offline badge is the closing beat —
   "zero external calls, on a model running on this laptop" — so make sure it's on
   screen when you say it.
