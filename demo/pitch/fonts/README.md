# Retained legacy pitch fonts

These three font families are retained assets for the original pitch design.
The refreshed `deck.html` uses the system Avenir Next / Segoe UI font stack and
does not load this directory. The refreshed PowerPoint uses Avenir Next. Neither
finished deck requires a runtime font download from Google Fonts.

The unmodified TrueType assets were retrieved on 2026-09-12 from the official
[Google Fonts repository](https://github.com/google/fonts):

| Family | Included styles | Upstream directory | License |
| --- | --- | --- | --- |
| Saira Condensed | 500, 600, 700 upright | [sairacondensed](https://github.com/google/fonts/tree/main/ofl/sairacondensed) | [SIL OFL 1.1](SairaCondensed-OFL.txt) |
| Spectral | 300, 400, 500 upright; 400 italic | [spectral](https://github.com/google/fonts/tree/main/ofl/spectral) | [SIL OFL 1.1](Spectral-OFL.txt) |
| JetBrains Mono | Upright variable font covering 400, 500, 700 | [jetbrainsmono](https://github.com/google/fonts/tree/main/ofl/jetbrainsmono) | [SIL OFL 1.1](JetBrainsMono-OFL.txt) |

Each license file preserves the upstream copyright and attribution. The original
JetBrains filename is `JetBrainsMono[wght].ttf`; its file contents are unchanged
under the local filename `JetBrainsMono-Variable.ttf`. `sources.json` records every
download URL, byte count, and SHA-256 digest. `fonts.css` contains only local
`@font-face` URLs and preserves the deck's existing `font-display: swap` behavior.

This directory is not needed when serving or copying the refreshed `deck.html`.
Eight font files total
1,549,692 bytes; the three license files total 13,194 bytes. These are development
downloads bundled with the deck, not runtime network dependencies.
