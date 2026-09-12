YOUR ROLE: Build /backend/agent/

Read CLAUDE.md (shared context) and /contracts/ first. Do not touch any folder
other than /backend/agent/.

Your functions take plain dicts and know nothing about storage. Suppliers and
events now live in MongoDB, but Person 2's repository layer strips Mongo's `_id`
before anything reaches you, so what you receive is exactly the shape in
contracts/supplier.schema.json and contracts/event.schema.json. Do not import
pymongo, do not query a collection, do not accept an _id field — if you ever see
one in your input, that's a bug in the repository layer, not something for you to
handle.

Files to create:

- propagation.py:
    def get_affected_suppliers(event: dict, suppliers: list[dict]) -> dict:
        # returns {"directly_affected": [...], "cascading_affected": [...]}
        # directly_affected: suppliers whose location matches
        #   event.affected_location (simple substring/exact match, no geocoding)
        # cascading_affected: any supplier whose id appears in a directly-
        #   affected supplier's downstream_dependents list (one hop is
        #   enough for the demo — don't over-engineer multi-hop traversal
        #   unless time allows)
        # never return an id in cascading_affected that is already in
        #   directly_affected

- narrate.py:
    def generate_risk_summary(event, directly_affected, cascading_affected, suppliers) -> str:
        # builds a prompt from the structured data above and calls Ollama
        # (localhost:11434, model qwen3.6:35b) to generate 2-3 sentences
    def generate_draft_report(event, directly_affected, cascading_affected, suppliers) -> str:
        # same pattern, generates a formatted email draft addressed to a
        # generic "compliance contact" placeholder

  Read contracts/llm.md for the exact host, model, request shape and temperature.
  Define OLLAMA_HOST and OLLAMA_MODEL once, at the top of narrate.py, from env
  vars with the documented defaults. Resolve supplier ids to names/parts/statuses
  in Python and put that literal text in the prompt — the model is never asked
  which suppliers are affected, only to write about the ones you hand it.

- Write a small __main__ test block in each file so you can run and verify
  propagation.py and narrate.py directly with hardcoded sample data from
  /contracts/examples/, without needing the API or frontend running.

Start with propagation.py first — it has zero dependencies and Person 2 needs it
working before they can finish the API layer. Tell Person 2 the moment
get_affected_suppliers() returns correct results for the demo event.

Time your first real narrate.py call early and report the latency in chat. A 35B
model is fine on our hardware, but latency is the one thing that quietly breaks a
demo, and we need to know in hour one, not hour six.
