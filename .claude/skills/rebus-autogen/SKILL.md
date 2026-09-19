---
name: rebus-autogen
description: End-to-end generator for the Decryptions daily news rebus puzzle. Pulls Google News top stories, identifies the top story from its cluster of outlet headlines, compresses it to a 3-6 word headline, decomposes every word into picture arithmetic by a numbered rulebook, sources legally safe square clip-art (Pixabay, Openverse public domain, Noto Emoji) with provenance, validates the letter math, and prepends the puzzle to decryptions_inner/src/data/puzzles.ts. Use this whenever the user wants today's puzzle, a new rebus, the daily puzzle, a rebus for a given headline or date, to swap or fix a clue image, to review or iterate on a drafted puzzle, or to change the rebus rules, even when they do not say "rebus" or "skill" explicitly.
---

# rebus-autogen

Builds one production-quality Decryptions puzzle from the news, deterministically, and improves
its own rules from feedback. The hand process this replaces failed in two recurring ways
(letter math that did not spell the answer; non-square images that shrank in the 48 px tile), so
the pipeline verifies both mechanically before anything touches the app.

## Read first

- `references/rulebook.md` (always): numbered rules H/W/C/D/B/T/F/L/Q/I. Cite rule ids in your
  reasoning ("H10 tie-break", "D3 forbids middle removal") so the user can push back on a rule.
- The three newest entries in `decryptions_inner/src/data/puzzles.ts`: the live style anchor.
- `references/archive.md`: the author's puzzle database (29 puzzles) in the author's own
  `chunk [image]` notation; the device vocabulary to draw from, and the notation to present in.
- `references/image-sourcing.md` before step 3; `references/draft-schema.md` whenever the
  validator reports a code you do not recognise; `references/examples.md` when unsure what
  "house style" looks like.

## Setup and scratch space

```bash
SKILL=.claude/skills/rebus-autogen            # relative to the repo root
WORK=<session scratchpad>/rebus-$(date +%Y-%m-%d)   # never inside the repo
python3 $SKILL/scripts/common.py --preflight
```

Preflight reports Pillow, node, tsc, `PIXABAY_API_KEY`, `OPENVERSE_TOKEN`, and network. Keep going
in degraded mode: no Pixabay key means Openverse + Noto only (say so once); no `node_modules`
means the typecheck is skipped (the Node import smoke test still runs). Only a missing repo or a
dead network stops the run.

Every script prints JSON, exits 0 on success, 1 on a validation problem, 2 on an environment
problem, and always includes `warnings`. Read the warnings; each one is either fixed or justified
in the QA table.

## Workflow

### 1. Story (skip when the user supplies a headline)

```bash
python3 $SKILL/scripts/news_topstories.py --limit 5 --work $WORK --table   # also writes $WORK/news.json
```

Show the five clusters as a table (the `--table` output, trimmed to what matters). Apply H1-H14 to
the top cluster: extract ACTOR / ACTION / OBJECT with outlet support counts, write the one-sentence
story statement (H2), compress it (H3-H8), check every token against the decomposability gate
(H9), pick the category (H13). If the top cluster fails H9 or H11, move to the next cluster and say
why. Present:

- the chosen story in one sentence and the compressed headline, with the H10 tie-break applied;
- one alternative compression;
- per word, a one-line puzzle-ability note (whole-word flag/outline, prefix/suffix strip, sound).

Default `date` is today on this Mac; the user may give another date. Rerun with
`--exclude "<regex>"` if the user rejects a story.

**Checkpoint A: stop and wait for the user to confirm the headline before any image work.**

### 2. Design (no images yet)

Write `$WORK/draft.json` (shape in `references/draft-schema.md`): for every word, list the top 3
candidate decompositions in a table with their D9 scores, pick by D10/D11, and record the winner
as `derivations` plus the `clues[]` list serialised by the C1 gap table. Chips are glue only
(D14): additive chips of at most 2 letters, never the start of the word, never more than 40% of
its letters; anything more comes from an image. Present breakdowns to the user in the archive
notation the validator returns (`arithmetic[i].notation`), e.g.
`(trout [Trout] - out [Umpire calling out]) + (zoo [Zoo entrance] - z [letters])`. Apply the
E rules while choosing: pick one signature box (E2), take at most two thematic-echo or
incongruity bonuses (E1), and name both in the table. Give every image clue a
`word` and, where it applies, a `device`. Write hints by T1-T8. Then:

```bash
python3 $SKILL/scripts/validate_puzzle.py --draft $WORK/draft.json --design-only
```

Iterate until there are no errors. Show the derivation table (word | derivation | computed |
band). **Checkpoint B (soft):** pause for the user only if the draft uses a sound step, a brand
logo, a person's name, or a rule you had to bend; otherwise continue.

### 3. Images

For each image word, in draft order:

```bash
python3 $SKILL/scripts/find_images.py --word TROUT --query "trout fish clipart" --emoji 🐟 --work $WORK
```

The local library is searched first; reuse an existing square file when it passes F5 (the
rubric rewards it). Otherwise `Read` the contact sheet the script names and choose by the
checklist in `image-sourcing.md`: first-word test, single subject, simplest candidate that is
still unmistakable (flat vector or emoji > simple illustration > cut-out photo; no realistic
scenes), and no wordmark (a logo is its symbol alone: the play button, not "YouTube"). Then:

```bash
python3 $SKILL/scripts/fetch_image.py --from-candidates $WORK/candidates/trout/results.json --pick 3 \
  --name trout --word TROUT --trim --puzzle-id <id> --work $WORK
```

`Read` the resulting `public/<name>.png`. The subject should fill most of the square; if not,
refetch with a different pick or without `--trim`. Existing files are never overwritten; a variant
gets `-2`. A bad new file goes away with `fetch_image.py --forget --name <name>` (only untracked,
unreferenced files). Update `clues[].content` in the draft with the final paths.

Notes for this step: Openverse takes 10-60 s per search, so run one word at a time. A name
that qualifies under D2b (Trump, the Pope, Obama) is searched as `<surname> silhouette` with
`--type vector` and marked `device: silhouette`; anything that is a photo or a caricature is
rejected on the contact sheet. Flags and
outlines come from Wikimedia Commons (see `image-sourcing.md` for the direct `--url` fetch with
provenance flags). Roman numerals, letters, and element cells that have no existing file are
rendered, not searched:

```bash
python3 $SKILL/scripts/render_glyph.py --text V --name roman-v --word V --puzzle-id <id> --work $WORK
```

### 4. Validate for real

```bash
python3 $SKILL/scripts/validate_puzzle.py --draft $WORK/draft.json
```

Fix every error. For every warning write one line of justification or change the draft.

### 5. Self-QA (rulebook Q1-Q12)

0. **Tile preview.** Render the draft the way `PuzzleBox.tsx` lays it out and `Read` it:

   ```bash
   python3 $SKILL/scripts/preview_boxes.py --draft $WORK/draft.json --out $WORK/preview.png              # desktop, 2 columns
   python3 $SKILL/scripts/preview_boxes.py --draft $WORK/draft.json --out $WORK/preview-mobile.png --columns 1
   ```

   Every tile must read at that size; a card with more than 3 token rows is too busy (B5).
1. **Blind re-solve.** Before rereading the draft, `Read` each new image and write the single most
   obvious word for it. Diff against `word`. Any mismatch: swap the image, or add the
   disambiguating synonym to the hint (T3), and rerun step 4.
2. Solve each box from the tiles and chips alone, then with hints; both must reach the answer.
3. Hint audit: no answer, no letter count, no other box's answer, under 90 characters.
4. Optional real-app check when `decryptions_inner/node_modules` exists (else rely on the 512 px
   files and the gray tile mat in the contact sheet):

   ```bash
   python3 $SKILL/scripts/insert_puzzle.py --draft $WORK/draft.json --work $WORK --dry-run   # writes $WORK/puzzles.dry-run.ts
   cp decryptions_inner/src/data/puzzles.ts $WORK/puzzles.orig.ts
   cp $WORK/puzzles.dry-run.ts decryptions_inner/src/data/puzzles.ts
   ```

   Start the `decryptions-dev` server from `.claude/launch.json` in the Browser pane, click Play,
   screenshot the puzzle grid (desktop and mobile widths), then restore the file:
   `cp $WORK/puzzles.orig.ts decryptions_inner/src/data/puzzles.ts`. The real insert happens only
   in step 7.

### 6. Present

Show the QA table and wait:

| # | word | derivation | band | images (file, source, license) | hint |
|---|---|---|---|---|---|

followed by: validator warnings with justifications, every logo or character used (L3, E3),
the signature box and E1 bonuses (Q13), new files created, and the story sentence. **Checkpoint C: stop and wait for approval.** Feedback loops back to
step 2 (word or decomposition), step 3 (image), or step 5 (hint); approved boxes stay fixed (I4).

### 7. Insert

```bash
python3 $SKILL/scripts/insert_puzzle.py --draft $WORK/draft.json --work $WORK
```

The script validates again, prepends the object at index 0 of `puzzles.ts` in house style, runs a
Node import smoke test (`puzzles[0].id`, count + 1, `getCurrentPuzzle(date)`), runs `tsc` when
available, restores the backup on failure, archives the draft to `$SKILL/history/<id>.json`, and
prints `gitAddPaths` plus `suggestedCommit` (`new puzzle M/D/YY`, the author's convention).

The output also carries `spreadsheetRow` (and writes `$WORK/spreadsheet-row.tsv`): one
tab-separated row in the layout of the author's `Decryptions Database.xlsx` (Date | Puzzle
Solution | Word | Breakdown ...), ready to paste into that workbook. Show it.

Report the result and propose the commit:

```bash
git add <gitAddPaths> && git commit -m "new puzzle M/D/YY"
```

Commit only when the user says so; push only on an explicit request (a push deploys to Vercel).

### 8. Retro and rule iteration (rulebook I1-I6)

Ask one question: "Anything to change for next time?" For each piece of feedback: classify it
(headline | word | decomposition | image | hint | difficulty | style), find the governing rule,
tighten or add a rule in `references/rulebook.md` keeping ids stable, and append a row to
`references/changelog.md` with the puzzle id, the old and new rule text, the reason, and a
regression example. Copy the user's words verbatim into the feedback log in the same file. Rules
that changed a D9 weight are replayed against the drafts in `history/` (I5).

The same applies mid-run: when the user rejects a box, fix the puzzle and the rule that allowed
it in the same turn.

## Other entry points

- **"Make a rebus for '<headline>' dated <date>"**: skip step 1; still run the H rules on the
  supplied headline (compress it if it is longer than 6 words and say what changed).
- **"Swap the <word> image"**: step 3 for that word only under a new filename (`<word>-2`),
  then steps 4-7. The old file stays untouched because older puzzles may use it.
- **"Change rule X" / "the puzzles are too hard"**: step 8 alone; edit the rulebook and
  changelog, then rerun `validate_puzzle.py` on the newest `history/` draft to show the effect.
- **Offline or no key**: `news_topstories.py --rss-file $SKILL/tests/fixtures/rss-sample.xml`
  for a rehearsal; `find_images.py --source local,openverse,noto`.

## Hard limits

- Write inside the repo only to `decryptions_inner/public/` (new files), `puzzles.ts` (via
  `insert_puzzle.py`), `src/data/image-credits.json`, and `$SKILL/history/` and `references/`.
  `$SKILL/scripts/` may be edited only to fix a tooling bug, and only if `selftest.py` passes
  afterwards and the fix gets a changelog row (rulebook I7).
- Never hotlink, never use Unsplash/Pexels API assets, never use a photo of a real person, never
  overwrite an existing image, never add a `PuzzleBox.tsx` size exception (pad the image instead).
- Never commit or push without the user's go-ahead in this conversation.
- Show the user the headline (Checkpoint A) before spending image-API calls, and the finished
  puzzle (Checkpoint C) before inserting.

## Self-test

```bash
python3 $SKILL/scripts/selftest.py
```

Runs the validator on `tests/fixtures/draft-good.json` (the May 3, 2026 puzzle re-expressed)
and a set of mutations, the arithmetic engine on known derivations, the RSS parser on a saved
feed, `fetch_image.py` on generated images (wide, off-white, checkerboard), `render_glyph.py`,
`preview_boxes.py`, and `insert_puzzle.py --dry-run`. Run it after editing any script.
