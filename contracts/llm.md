# LLM contract — local Ollama only

## The one model, the one host

```
OLLAMA_HOST  = http://localhost:11434     # never any other host, from any file
OLLAMA_MODEL = qwen3.6:35b                # Qwen 3.6 35B
ENDPOINT     = POST {OLLAMA_HOST}/api/generate
```

Define these **once**, in `backend/agent/narrate.py`, read from the environment with the
values above as defaults:

```python
import os
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.6:35b")
```

Nothing else in the codebase hardcodes a model name or a host. If the local tag turns
out to be spelled differently, change the default here and tell the team in chat —
don't scatter a second spelling through the repo.

## Verify before you build against it

```bash
ollama list                     # confirm the exact local tag
ollama pull qwen3.6:35b         # if it isn't there yet
```

Smoke test the endpoint (this is the only network shape any of our code uses):

```bash
curl -s http://localhost:11434/api/generate -d '{
  "model": "qwen3.6:35b",
  "prompt": "Reply with the single word: ready",
  "stream": false
}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["response"])'
```

**Time the first real call early.** A 35B model on our hardware is the whole reason
this model was chosen, but latency is the one thing that can quietly break the demo.
If `risk_summary` + `draft_report` together take longer than a few seconds, say so in
chat in hour one, not at hour six.

## Request shape

```json
{
  "model": "qwen3.6:35b",
  "prompt": "<full prompt, structured data already resolved into text>",
  "stream": false,
  "options": { "temperature": 0.3 }
}
```

Response: `{"response": "<text>", ...}` — read `["response"]` and strip it.

Keep `stream: false`. The frontend does a single request/response, no websockets, and
streaming would only add failure modes.

## What the LLM is and isn't for

- **Is for:** `risk_summary` (2–3 sentences) and `draft_report` (email draft).
- **Is not for:** deciding which suppliers are affected, or how the risk cascades.
  That is deterministic Python in `backend/agent/propagation.py`.

Pass the LLM the *already-computed* supplier names, parts, statuses and event details
as literal text in the prompt. Never ask it to infer the affected set, and never ask it
to output JSON we then depend on — it returns prose, nothing more.

Low temperature (~0.3) on purpose: we want the same demo event to read roughly the same
way every run.
