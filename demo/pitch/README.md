# Markov pitch

Open `deck.html` for the self-contained browser presentation or `Markov.pptx` for the editable 13-slide PowerPoint deck. The HTML supports arrow keys, Page Up/Down, Home/End, and the visible navigation buttons. It uses the local Avenir Next / Segoe UI font stack and does not require the `fonts/` folder.

`build_deck.mjs` is the shared content and layout source for both formats. Its 40-hour comparison reads the operational model in `frontend/src/operations-demo.js`; source links and presentation notes are kept with each slide.

From the repository root, regenerate the HTML with a current Node.js runtime:

```sh
node demo/pitch/build_deck.mjs --html-only
```

The PowerPoint build requires the supplied `@oai/artifact-tool` runtime, Python with Pillow and the presentations skill's validation dependencies, and the presentations skill's validation helpers. These are authoring dependencies, not requirements for opening the finished deck. Install Avenir Next for native rendering and point `COUNTER_FONT_PATH` at its licensed Bold font file for matching counter metrics; `COUNTER_FONT_INDEX` selects a face when using a font collection (default `0`). Point the environment variables at those installed dependencies:

```sh
RUNTIME_NODE_MODULES=/path/to/runtime/node_modules \
RUNTIME_PYTHON=/path/to/python3 \
PRESENTATION_SKILL_DIR=/path/to/skills/presentations \
COUNTER_FONT_PATH=/path/to/Avenir-Next-Bold.ttf \
node demo/pitch/build_deck.mjs
```

`PRESENTATION_SKILL_DIR` is required for PPTX builds. Python defaults to `python3`; `RUNTIME_PYTHON` overrides it. `RUNTIME_NODE_MODULES` may be omitted if `@oai/artifact-tool` is already resolvable from the project. The HTML-only command needs none of these dependencies or environment variables.

The full build generates the HTML and writes a new validated PPTX, all slide PNGs, and a private validation receipt under the repository's `.cache/pitch/`. Set `PITCH_WORK_DIR` to use another scratch directory. It prints the final PPTX and preview paths, also recorded in `latest-build.json`. Inspect the rendered slides before copying that PPTX to `demo/pitch/Markov.pptx` or your delivery folder.

`build_pptx.py` is the retained **legacy generator**. Do not run it for this refreshed deck: it contains the old content and dark visual design.

## Live waste counter

The evidence-first story retains the original market, downtime, decision-time arithmetic, and cross-industry argument. The operational mitigation comparison and owned action sequence are added as slides 11–12.

Slide 5 in `deck.html` starts at $0, accrues continuously from elapsed time at $550 per second, and resets when re-entered. It runs indefinitely while that slide is displayed. The $33,000/min rate rounds down the automotive estimate in Siemens’ 2022 study; the separate $2.3M/hour number is from the 2024 study.

The PowerPoint contains an embedded 3,001-frame GIF counter at ten frames per second (100 ms per frame), with a 300.1-second loop and editable rate labels. Play from slide 5 in **desktop PowerPoint Slide Show** to animate it. PowerPoint for the web and static previews may show only the first frame; use the HTML version for the reliable live counter. Sources and the playback note are also in the slide’s speaker notes.

Rebuilding the PPTX renders twelve native glyphs once with Artifact Tool, then composites elapsed-time amounts with Pillow at ten frames per second. This avoids thousands of full slide renders. The glyph metrics use the installed Avenir Next Bold face. The cached glyphs/GIF live only in the configured scratch directory. If the counter font or design changes, remove its cached GIF before rebuilding.

Desktop versus web GIF playback follows [Microsoft’s PowerPoint guidance](https://support.microsoft.com/en-us/PowerPoint/add-an-animated-gif-to-a-slide).
