# /contracts — source of truth

Three shapes, and the LLM call. Everything else in this repo is built against these.

| File | What it pins down |
| --- | --- |
| `supplier.schema.json` | one supplier, as stored in `backend/data/fixtures/suppliers.json` |
| `event.schema.json` | one disruption event, as stored in `backend/data/fixtures/events.json` |
| `analysis_result.schema.json` | the response body of `POST /api/analyze` |
| `llm.md` | the Ollama host, model (`qwen3.6:35b`) and request shape |
| `examples/` | copy-pasteable real payloads — start here |

## How to use this

- **Person 1** — read `supplier.schema.json` + `event.schema.json` for your function
  inputs, `analysis_result.schema.json` for the two lists you return, `llm.md` for the
  call.
- **Person 2** — your fixtures must validate against the supplier/event schemas exactly.
- **Person 3** — copy `examples/analysis_result.example.json` straight into your
  frontend as hardcoded fake data and build the whole UI against it before any backend
  exists. It is a realistic one-direct / two-cascading result, so the staggered reveal
  has something to animate.
- **Person 4** — the demo scenario you lock in hour one is expressed in these ids.

## Changing a contract

Don't do it silently. Three other people's code depends on these shapes staying
stable. If a change is genuinely necessary: say it in chat, name the field, update the
schema **and** the example in the same commit.

## Validating a fixture against a schema

```bash
pip install jsonschema
python3 - <<'PY'
import json, jsonschema
schema = json.load(open("contracts/supplier.schema.json"))
for s in json.load(open("backend/data/fixtures/suppliers.json")):
    jsonschema.validate(s, schema)
print("suppliers.json OK")
PY
```

Note: `analysis_result.schema.json` uses a `$ref` to the event schema, so validate it
with a resolver rooted at `contracts/` (or just eyeball it — it's a hackathon).
