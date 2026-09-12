# Markov demo video

The final [MP4](markov-demo.mp4) and its editable Remotion project: **1920×1080, 60 fps, exactly 120 seconds**. Includes the faster opening, operational mitigation ending, neural narration, captions, and background music.

## Preview and edit

Requires Node.js 20+ and pnpm. From the repository root:

```sh
cd demo/video
pnpm install --frozen-lockfile
pnpm exec remotion studio --no-open
```

Open the URL printed by Studio and select **MarkovDemo**. The six scenes are also available as individual compositions. Edit `src/scenes/`; shared components are in `src/ui.tsx`. Studio's mute control silences narration and music.

## Render

Requires FFmpeg on `PATH` for the final exact-duration remux:

```sh
mkdir -p rendered
pnpm exec remotion render MarkovDemo rendered/markov-demo-raw.mp4 --codec=h264 --crf=18 --audio-codec=aac --audio-bitrate=192k --pixel-format=yuv420p
ffmpeg -i rendered/markov-demo-raw.mp4 -t 120 -c copy -movflags +faststart rendered/markov-demo.mp4
```

The remux removes any AAC encoder padding after two minutes without re-encoding. Local renders stay outside Git. Validate source types with `pnpm exec tsc --noEmit`.

## Script, captions, and sound

- [NARRATION.md](NARRATION.md): spoken script and recording cues; editable text is in `scripts/narration-script.json`.
- [public/captions.srt](public/captions.srt): portable subtitles; timed JSON also lives in `public/` and `src/data/`.
- `public/audio/`: all playback assets, including the complete narration-only reference WAV.
- [PROJECT_NOTES.md](PROJECT_NOTES.md): scene timings, design, motion, and historical evidence notes.

Narration uses **Kokoro-82M v1.0**, voice **af_heart**, generated locally with `kokoro-onnx 0.6.1`: 203 words in 13 passages with 26 model-aligned caption phrases. [Narration provenance](public/audio/provenance.json) records the model source and hash. Optional regeneration requires Python, FFmpeg, `kokoro-onnx==0.6.1`, `soundfile`, and separately downloaded timing-enabled model and voice files:

```sh
python scripts/generate-neural-narration.py --model MODEL.onnx --voices VOICES.bin
```

Use `--only value` to regenerate just the closing passage. Generated audio is included; Python environments, model weights, caches, and temporary renders are excluded.

Music is the user-provided `bombinsound-advertising-traveling-571352.mp3`, prepared to 120 seconds at −18 LUFS. Playback gain is 0.20 during narration and 0.29 between passages, with fades and ducking defined in `src/BackgroundMusic.tsx`. [Music provenance](public/audio/music-provenance.json) records those settings.

The supplier evidence captures in `evidence/` are historical records from the prototype commit identified there. The closing operating example is stored in `src/data/mitigation.json`; it presents the proposed mitigation while retaining the remaining standard-order shortfall.
