# Markov demo — editable Remotion preview

**Studio composition:** select `MarkovDemo` after starting Studio with the commands in [README.md](README.md).

An editable two-minute composition with neural narration, quiet background music, and synchronized script captions, based on the supplied shooting script and Markov's current interface. 1920×1080, 60fps, exactly 7,200 frames. Narration is enabled in the preview; use Studio's mute control for a silent version while recording your own dub. A separate `markov-demo.mp4` export is available at 1080p60, exactly 120 seconds, with H.264 video and AAC stereo audio.

## Start or edit

Requires Node 20+ and pnpm. Dependencies are pinned in package.json and pnpm-lock.yaml.

```sh
pnpm install --frozen-lockfile
pnpm exec remotion studio --no-open
```

Open the URL printed by Studio, then select **MarkovDemo**. Press Space to play or pause. Scrub the timeline to review. Each beat is also an individual composition in the Scenes folder, with synchronized narration, music and captions. Use Studio's volume or mute control to choose between the generated voice and a silent dubbing preview. Named visual layers appear in Studio; edit their React source files to change content or timing.

| Beat | Timing | Source |
|---|---|---|
| The problem | 00:00–00:12 | src/scenes/Problem.tsx |
| Supplier records | 00:12–00:30 | src/scenes/DataSources.tsx |
| The cascade | 00:30–00:55 | src/scenes/Cascade.tsx |
| Unattended monitor | 00:55–01:17 | src/scenes/Monitor.tsx |
| Draft and fallback | 01:17–01:38 | src/scenes/Response.tsx |
| Business value | 01:38–02:00 | src/scenes/Value.tsx |

`src/ui.tsx` contains the shared Markov header, supplier cards, dependency paths, fact captions and persistent pipeline rail. `src/Narration.tsx` plays the voice passages and displays timed script captions. All animation comes from Remotion frames. `src/Root.tsx` fixes dimensions, duration, and individual scene compositions.

## Motion and visual flow

- The opening assembles one actual dependency path in about one second, briefly traces its links, then sends the disruption across it on the existing narration cue.
- Supplier fields are read, highlighted and assembled into a structured record.
- The cascade follows traveling signals, active tiers and a completed impact calculation.
- The monitor shows an event entering the feed, an elapsed polling interval and the resulting flagged row.
- The response develops through evidence, impact and readable actions; the fallback path resolves to an unsent draft.
- The ending combines stock, schedule, order, and quality inputs into a proposed operating response: protect the priority order, park blocked work, and release independent kit production. A 40-hour worked example shows modeled late fees/setup, productive hours recovered, and the remaining late order, then holds still. Its closing rail summarizes operational context, impact analysis, response planning, human approval, and reassessment.

Directional scene wipes keep the application header, caption area and processing rail anchored. Each rail stage stays highlighted while it is being explained. Transitions use overlays so the six original timing windows and total duration do not change.

## Narration, captions and your own dub

- `NARRATION.md`: clean spoken script, cue windows and recording direction.
- `scripts/narration-script.json`: editable spoken text grouped into timed beats.
- `src/data/captions.json`: editable phrase timing in milliseconds.
- `public/captions.json` and `public/captions.srt`: portable caption exports.
- `public/audio/`: generated voice assets and the prepared background music included in the editable project.
- `src/BackgroundMusic.tsx`: music level, narration ducking and fade timing.

The optional voice uses **Kokoro 82M v1.0**, voice **af_heart**, generated locally with `kokoro-onnx` 0.6.1. The 203-word script is spoken in 13 connected passages. The 26 phrase captions use the model's phoneme-duration output to align their timing with those passages. The timing-enabled ONNX export is model v1.0 distributed through the wrapper's `model-files-v1.1` release; that release name does not indicate a new model version.

The composition remains exactly 120 seconds. Keep the intentional silence from 01:06 through 01:14.409; “Detected” begins at 01:14.5. The generated passages fit within the existing scene cues and leave room for the closing hold. This narration is a video asset and is separate from Markov's Qwen inference architecture.

To record your own dub, mute Studio and record six takes using `NARRATION.md`. Finish the final line by 01:57 to leave a calm closing hold. Add human recordings under `public/` and align them to the six scene windows. Retiming the phrase captions after recording will make the final dub match precisely.

### Regenerate the optional voice

Use a Python environment with `kokoro-onnx==0.6.1` and `soundfile`, plus the timing-enabled Kokoro model and voice files:

```sh
python -m pip install kokoro-onnx==0.6.1 soundfile
python scripts/generate-neural-narration.py --model MODEL.onnx --voices VOICES.bin
# Refresh only the closing passage and update all caption/reference exports:
python scripts/generate-neural-narration.py --model MODEL.onnx --voices VOICES.bin --only value
```

Supply the actual local paths for `MODEL.onnx` and `VOICES.bin`. Model downloads and the Python runtime are external to the editable archive; the generated `public/audio/` files are included, so preview playback does not require the generation environment or a model download.

## Background music

The user-provided `bombinsound-advertising-traveling-571352.mp3` is trimmed to the two-minute composition and normalized to −18 LUFS. Its playback gain is 0.20 under narration (about 14 dB quieter than the voice) and 0.29 between passages, with a 0.25-second duck attack, 0.7-second release, 1.5-second fade-in and 3-second fade-out. The narration pause during the monitor wait remains; the music continues softly.

The full composition mounts one continuous music track, so scene changes do not restart it. Individual scene compositions start at the matching music offset. Studio's mute button silences both voice and music.

## What was adapted from the shooting script

The current light slate/white Markov design was retained, as requested, with the dark pipeline rail from the video brief. The cold open, six timing windows, eight-second unattended wait, risk-to-email sequence, and first five scenes are preserved. Cascade tiers reveal alongside the corresponding script cues, with deliberate pauses between tiers.

The shooting script predates this frontend. Factual corrections are visible in the preview:

- There are ten seeded suppliers and **five** single-source suppliers.
- The data shot assembles fields from the actual local seed record rather than showing a fabricated live MongoDB request.
- The graph and 0.961 score come from a real run of the Python propagation function.
- The unattended scene replays a real daemon-thread test against a fixture feed: the event was discovered 8.409s after addition. The monitor selected three of five seeded events for escalation and suppressed two; zero messages were delivered.
- The draft is actual backend template output with the local model unavailable. Fallback completion took 0.5334s through direct Python calls, not an HTTP endpoint.
- The model and gateway nonlocal-host guards were tested. No global outbound-hook badge is shown because that hook is absent here.
- The phone/Slack inset and live model-kill shot were omitted because those services were not connected. Qwen/OpenClaw integration remains in the architecture, with template fallback and delivery-unavailable labels.
- 143 module checks passed. Raw provenance and limitations are in `evidence/`.

The closing worked example uses a stored snapshot of the frontend operational-planning comparison (`src/data/mitigation.json`), with illustrative WMS, MES, order, and quality inputs. It presents the intended operating response; this does not add operational planning to the live backend. Its modeled $25,600 → $4,600 fees/setup comparison retains the unresolved 160-module standard-order shortfall.

The `Prototype replay` label remains visible throughout. This composition is an animated reconstruction of verified component results, not a screen recording of a fully integrated deployment.

## Validation

TypeScript validation, Remotion Studio playback and composition metadata, full-resolution layout review, and script-caption timing checks were completed. The full composition is exactly 120 seconds, and each scene is independently editable. Intermediate QA images are not included in the source archive.
