# OpenClaw contract — local gateway, two jobs

> **Added by Person 1.** Additive: nothing in the existing contracts changed. It
> does need two things from other people — see *Who wires what* at the bottom.

[OpenClaw](https://openclaw.ai) is an open-source AI agent that runs on your own
machine and reaches people through the chat apps they already use. It belongs in this
project for the same reason the rest of it is local-first: state, credentials and
models stay on the box.

We use it for **two** things.

## Job 1 — model harness

Narration is routed through the gateway's OpenAI-compatible endpoint instead of calling
Ollama directly, so the model becomes a swappable OpenClaw plugin rather than a
hardcoded HTTP call. Ollama still does the inference; it just sits behind the gateway:

```json5
// ~/.openclaw/openclaw.json
{
  agents: { defaults: { model: { primary: "ollama/qwen3.6:35b" } } },
  gateway: { http: { endpoints: { chatCompletions: { enabled: true } } } },
}
```

```
POST http://127.0.0.1:18789/v1/chat/completions
Authorization: Bearer <token>
{"model": "openclaw/default", "messages": [{"role": "user", "content": "..."}], "stream": false}
-> 200 {"choices": [{"message": {"role": "assistant", "content": "<the text>"}}]}
```

Text is at `choices[0].message.content`. **The endpoint is disabled by default** — a
404 means exactly that, not that the gateway is down.

## Job 2 — approval channel

The premise of the product is that the agent drafts a report *for human approval*.
OpenClaw delivers that draft to the compliance contact in Slack/Telegram/iMessage,
which closes the loop instead of leaving a draft in a browser tab.

```
POST http://127.0.0.1:18789/tools/invoke
Authorization: Bearer <token>
x-openclaw-message-channel: slack
{"tool": "send", "args": {"channel": "slack", "text": "..."}}
-> 200 {"ok": true, "result": {...}}
-> 404 {"ok": false, "error": {"type": "not_found", ...}}     tool not available
-> 403 {"ok": false, "error": {..., "requiresApproval": true}}
```

**One documented unknown:** OpenClaw's docs specify `/tools/invoke` and its envelope
but never name the tool that sends a channel message (`send` is the name used at the
RPC layer). Rather than hardcode a guess, `backend/agent/openclaw.py` tries the
plausible names once and remembers whichever the gateway accepts — a 404 is a clean
discovery signal. Set `OPENCLAW_MESSAGE_TOOL` to skip probing once someone confirms
the real name against a live gateway.

## Configuration

| Env var | Default | Meaning |
| --- | --- | --- |
| `OPENCLAW_ENABLE` | *unset* | **off unless set to 1** — no one's machine gains a dependency by surprise |
| `OPENCLAW_HOST` | `http://127.0.0.1:18789` | gateway base URL; HTTP and WS share the port |
| `OPENCLAW_GATEWAY_TOKEN` | *unset* | `gateway.auth.mode="token"`; omit for mode `none` |
| `OPENCLAW_AGENT` | `openclaw/default` | `openclaw/<agentId>` selects which agent answers |
| `OPENCLAW_CHANNEL` | `slack` | where approvals are delivered |
| `OPENCLAW_MESSAGE_TOOL` | *probed* | skip tool discovery |
| `OPENCLAW_READ_TIMEOUT` | `30` | shorter than Ollama's on purpose — this leg is optional |

Config file lives at `~/.openclaw/openclaw.json` (JSON5 — comments and trailing commas
allowed), or wherever `OPENCLAW_CONFIG_PATH` points.

## It is a preference, never a dependency

The generation chain is:

```
OpenClaw gateway  ->  direct Ollama  ->  deterministic narrator
```

Adding a gateway adds a component that can be down, so it is layered rather than
substituted. If the gateway is off, absent, unauthorised, or has
`chatCompletions` disabled, narration drops to the direct Ollama call that was always
there, and then to templates. `POST /api/analyze` cannot fail because of OpenClaw.

Approval delivery is likewise best-effort: `request_approval()` never raises and
returns `{"delivered": bool, "tool": str|None, "detail": str, "request": {...}}`. The
message is always built even when it cannot be sent, so the UI can display exactly
what *would* have gone out.

## Still localhost-only

`OPENCLAW_HOST` is verified, not trusted — a non-local gateway is refused before a
socket is opened, the same rule applied to `OLLAMA_HOST` and `MONGO_URI`. A gateway URL
is just as capable of pointing off-box as a connection string is.

## Who wires what

- **Person 4** — add **`localhost:18789`** to the offline-hook allowlist, alongside
  11434 and 27017. Worth knowing: the gateway is where the "fully offline" story gets
  its best demo beat, because the approval lands in a real chat app with nothing
  leaving the machine.
- **Person 2** — one endpoint, whenever you have a moment. Body is in
  `backend/agent/README.md`; it is four lines and calls
  `openclaw.request_approval(analysis_result, risk)`:

  ```
  POST /api/actions/approve   {analysis_result} -> {"delivered": bool, "detail": str, "request": {...}}
  ```

- **Person 3** — if that endpoint lands, an "Send for approval" button on the result
  panel is the closing beat of the demo: the draft leaves the browser and arrives on a
  phone.

## Testing without a gateway

`backend/agent/mock_openclaw.py` serves both endpoints on localhost, with scenarios for
every failure mode (`wrong_tool`, `no_tool`, `chat_disabled`, `wrong_suppliers`,
`unauthorized`, `server_error`):

```bash
python backend/agent/mock_openclaw.py --port 18789
OPENCLAW_ENABLE=1 python -m backend.agent
```
