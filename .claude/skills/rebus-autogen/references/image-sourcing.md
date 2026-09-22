# Image sourcing policy

Why this exists: the app self-hosts every clue image in `public/` and shows no
credits in the UI. Only sources whose terms allow **download + self-host + no visible credit**
qualify. Terms were checked on 2026-09-05; re-check if a provider changes its API page.

## Provider order (rulebook L1)

| # | Provider | License | Attribution | Hosting | Key | Rate | Best for |
|---|---|---|---|---|---|---|---|
| 1 | Pixabay API | Pixabay Content License: free commercial use, modification allowed | not required | must download and self-host (hotlinking forbidden) | `PIXABAY_API_KEY` (free) | 100 req/min, responses must be cached 24 h, no systematic mass downloads | flat vectors and illustrations of common nouns: the house clip-art style |
| 2 | Openverse API | filter `license=cc0,pdm` so every hit is public domain | not required for CC0/PD (record it anyway) | download and self-host | none (optional `OPENVERSE_TOKEN`) | anonymous 20/min, 200/day | flags, maps, outlines, Wikimedia/Smithsonian/Met objects, historical items |
| 3 | Noto Emoji PNG | Apache-2.0 | license notice in `docs/attributions.md` | download | none | GitHub raw | deterministic fallback for everyday objects (duck, key, pill); square and transparent by construction |

Rejected: **Unsplash API** (must hotlink `photo.urls`, credit photographer + Unsplash, ping the
download endpoint), **Pexels API** (must show a prominent link to Pexels), any watermarked preview
(iStock/Shutterstock thumbnails such as the ones in the 2025-10-20 puzzle), Google Images
results, screenshots, `encrypted-tbn0.gstatic.com` links.

Pixabay Content License restrictions that matter here: no standalone redistribution of the file
(a puzzle tile is fine), no commercial use of content that shows trademarks (so do not take a
"brand logo" from Pixabay; logos come from the brand's own press kit or Wikimedia Commons with a
PD/trademark note, and are used nominatively), no misleading use of identifiable people (we use
no people at all).

## Setup (once)

1. Log in at pixabay.com, open https://pixabay.com/api/docs/ ; the key is shown on the page.
2. `mkdir -p ~/.config/rebus-autogen && printf 'PIXABAY_API_KEY=...\n' > ~/.config/rebus-autogen/env && chmod 600 ~/.config/rebus-autogen/env`
   (or export it in the shell). `scripts/common.py --preflight` confirms it is visible.
3. Optional: register an Openverse application for higher limits and set `OPENVERSE_TOKEN`.

Missing key: `find_images.py` skips Pixabay with a warning and still searches Openverse + Noto.
Tell the user once per session how to add the key; do not stop the run.

## Search recipes

`find_images.py` builds the query from `--query`; choose it by device:

| Device | Query pattern | Provider hint |
|---|---|---|
| common noun (duck, key, pill) | `<word> clipart` then `<word> cartoon` then `<word> icon` | Pixabay `--type vector,illustration`; Noto `--emoji` fallback |
| flag | `<country> flag` | Openverse (Wikimedia flags are PD) with `--type photo` (flags are not "illustration" there) |
| state or country outline | `<place> outline map` or `<place> silhouette` | Openverse; Pixabay vector |
| periodic cell | `<element> periodic table element` | Pixabay vector; else render is out of scope, reuse existing cells |
| Roman numeral, cursive letter | reuse existing files; new glyphs only from Openverse `cc0` fonts/SVGs | |
| sign (STOP, OPEN) | `<word> sign clipart` | Pixabay vector |
| famous-person silhouette (D2b) | `<surname> silhouette` then `<surname> outline vector` | Pixabay `--type vector`; Openverse cc0; take only flat single-colour art, never a photo or a caricature; Pixabay's license bars misleading use of recognisable people, which a news puzzle is not |
| logo | do **not** search stock providers; use the brand's official press kit "icon" or "symbol" asset (no wordmark) or a Wikimedia Commons file marked PD-textlogo / PD-shape, and record the URL in provenance | |

Always pass `--word` (the picture word in caps) so the local library is checked first: reuse
beats download (rulebook F3), and the D9 rubric rewards it.

## Picking from the contact sheet

`find_images.py` writes `sheet.png` with numbered candidates. Read it once and pick by:

1. **First-word test**: the word you would say on seeing the tile at 48 px is the intended
   picture word. A duck that reads "bird" fails; a pill that reads "capsule" is fine only if the
   hint says "medicine tablet".
2. **Single subject, no scene**, no embedded text or watermark, no border or frame. Logos are
   symbol-only: the play button, not the "YouTube" wordmark (rulebook P6). Query `<brand> icon`
   or `<brand> symbol`, never `<brand> logo text`.
3. **Simplest wins** (rulebook P7): flat vector or emoji > simple illustration > clean cut-out
   photo; realistic or busy scenes are out. Choose the candidate with the fewest details that is
   still unmistakable; two or three identifying features (a duck's bill and body shape) are all
   that survive at 48 px.
4. **Background** white or transparent. `fetch_image.py --trim` crops to the subject; off-white
   mats are whitened; padding is transparent when the source has alpha, else white. Skip rawpixel
   items titled "transparent background" or "png sticker": they arrive as flattened JPGs with a
   grey checkerboard baked in, and the fetch script refuses them.
5. Skip anything flagged `face?` (portraits), `text?` (typography), or `logo?` unless the box is
   a logo box.

Then `fetch_image.py --from-candidates <results.json> --pick <n> --name <file> --puzzle-id <id>`.
Read the resulting 512 px PNG: the subject should fill most of the square.

## Noto Emoji fallback

File name = `emoji_u` + lowercase hex code points joined by `_`, FE0F variation selectors removed:
🦆 U+1F986 -> `emoji_u1f986.png`. `find_images.py --emoji 🦆` computes this and HEAD-checks
`https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/<name>`. Flag emoji are
**not** in that directory (they live under a different license), so flags always come from
Wikimedia Commons. Emoji are a distinct visual style; use at most 3 per puzzle so the grid does
not look like a phone keyboard.

## Wikimedia Commons (flags, outlines, maps)

Openverse returns Commons files with `source: wikimedia`. Originals on `upload.wikimedia.org`
answer HTTP 429 to scripted downloads and Openverse's own thumbnail proxy often fails for them, so
both scripts rewrite Commons URLs to the Commons thumbnail endpoint automatically (it also
rasterises SVGs). When Openverse does not surface the file you want, fetch it directly with full
provenance from the Commons file page:

```bash
python3 $SKILL/scripts/fetch_image.py --url "https://upload.wikimedia.org/wikipedia/commons/c/ca/Flag_of_Iran.svg"   --source wikimedia --page-url "https://commons.wikimedia.org/wiki/File:Flag_of_Iran.svg"   --author "<from the file page>" --license "Public domain" --license-url "<license link from the file page>"   --name iran-flag --word IRAN --puzzle-id <id> --work $WORK
```

Only PD / CC0 files qualify (rulebook L1); CC BY and CC BY-SA files need visible credit the app
does not show.

## Glyphs (Roman numerals, letters, element cells)

Stock searches return decorated lettering, not clean glyphs. Render them instead:

```bash
python3 $SKILL/scripts/render_glyph.py --text V --name roman-v --word V --puzzle-id <id> --work $WORK
python3 $SKILL/scripts/render_glyph.py --text Cu --style cell --cell-number 29 --cell-label Copper --name copper-cu --word CU --work $WORK
```

The default font is the one bundled with Pillow (Aileron, CC0), recorded as provenance. Match the
look of the existing `ii.png` / `xv.png` (plain dark glyph on white).

## Timing and cleanup

Openverse searches take 10-60 s each (the API is slow and thumbnails are downloaded); run one
`find_images.py` at a time and expect a minute per word. A new file that turns out unusable and
that no puzzle references is removed together with its provenance row by
`fetch_image.py --forget --name <name>`; tracked or referenced files are refused.

## Provenance record (written by fetch_image.py)

```json
{"file": "duck.png", "word": "DUCK", "source": "pixabay", "sourceId": "1234567",
 "sourceUrl": "https://pixabay.com/vectors/...", "downloadUrl": "https://pixabay.com/get/...",
 "author": "OpenClipart-Vectors", "license": "Pixabay Content License",
 "licenseUrl": "https://pixabay.com/service/license-summary/",
 "fetchedAt": "2026-09-05T21:40:00Z", "sha256": "...", "puzzleId": "2026-09-05-..."}
```

Stored in `src/data/image-credits.json` (array). Not imported by the app, so it
adds nothing to the bundle; `resolveJsonModule` is on if a credits page is ever wanted.
