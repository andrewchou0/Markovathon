# /contracts — source of truth

Three shapes, the LLM call, and the database. Everything else in this repo is built
against these.

| File | What it pins down |
| --- | --- |
| `supplier.schema.json` | one supplier — a document in the `suppliers` collection |
| `event.schema.json` | one disruption event — a document in the `events` collection |
| `analysis_result.schema.json` | the response body of `POST /api/analyze` |
| `llm.md` | the Ollama host, model (`qwen3.6:35b`) and request shape |
| `storage.md` | local MongoDB: URI, db/collections, the `_id` rule, seeding |
| `examples/` | copy-pasteable real payloads — start here |

## How to use this

- **Person 1** — read `supplier.schema.json` + `event.schema.json` for your function
  inputs, `analysis_result.schema.json` for the two lists you return, `llm.md` for the
  call.
- **Person 2** — `storage.md` is your main brief alongside this one. Your seed JSON must
  validate against the supplier/event schemas exactly, and every read must project
  `{"_id": 0}` so what leaves the API still matches them.
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
for s in json.load(open("backend/data/seed/suppliers.json")):
    jsonschema.validate(s, schema)
print("suppliers.json OK")
PY
```

Note: `analysis_result.schema.json` uses a `$ref` to the event schema, so validate it
with a resolver rooted at `contracts/` (or just eyeball it — it's a hackathon).

The schemas set `additionalProperties: false`, which means a leaked Mongo `_id` is a
validation failure by design. That's deliberate — see the `_id` rule in `storage.md`.
