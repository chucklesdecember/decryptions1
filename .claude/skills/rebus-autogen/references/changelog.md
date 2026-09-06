# Rulebook changelog

One row per rule change. Rule ids are permanent: a rule is tightened, loosened, or marked
`deprecated`, never renumbered or deleted, so feedback like "W4 is too strict" always resolves.

Precedence when rules disagree (rulebook I6): hard gates (H/W/C/F/Q sections) > the newest
changelog row that overrides a rule > rubric weights (D9).

| Date | Trigger puzzle id | Class | Rule: old -> new | Why | Regression example |
|---|---|---|---|---|---|
| 2026-09-05 | (initial) | style | Rulebook v1 written from the 11 existing puzzles (May 3 and May 1, 2026 as primary anchors) | Turn the hand process into explicit, numbered rules | May 3 puzzle re-expressed in `tests/fixtures/draft-good.json` validates clean |
| 2026-09-05 | (initial) | difficulty | B1: first draft rated 3+ pieces as Hard -> 3 pieces without sound is Medium | The two newest puzzles (May 3, May 1) had 3-4 Hard boxes under the first draft, so the bands did not describe the house style | `validate_puzzle.py` on `draft-good.json` reports bands Medium, Hard, Medium, Easy, Easy |
| 2026-09-05 | 2026-09-05-us-hits-3-iran-tankers (dry run) | headline | H10: tie-break added step (2) "higher D9 score of the differing tokens" before "fewer letters" | The rules chose "Hits" over "Strikes" although HITS has no picture and STRIKES does; compression must consider decomposability | examples.md §3 now yields "US Strikes 3 Iran Tankers" |
| 2026-09-05 | (dry run) | word | W3: 3-4 letter suffix chips forbidden -> allowed with the D9 -6 penalty; W4 clarified that digit answers are governed by W5 | The example used `TANK + ers`; the penalty already expresses the preference | `validate_puzzle.py` accepts answer "3" |
| 2026-09-05 | (dry run) | decomposition | D13 added: alias pictures (US flag = "USA") are forbidden as whole-word boxes | D9 preferred the US flag (+9) although the exact-match input rejects "USA" | rulebook D13 |
| 2026-09-05 | (dry run) | image | F2 whole-word exemption; F3/F5 reworded: legacy files reused as they are (padding does not enlarge a wide subject), checkerboard sources refused, off-white mats whitened, `--forget` for unusable new files | `deer.png` arrived with a baked-in checkerboard and was immutable; `iran-flag.png` tripped F2 as written | `fetch_image.py` refuses the checkerboard fixture in selftest |
| 2026-09-05 | (dry run) | style | D6/D9: rendered glyphs via `render_glyph.py`; glyph tiles carry no picture grade | No clean Roman numeral V exists in any stock source | `roman-v.png` renders from Pillow's CC0 font |
| 2026-09-05 | (dry run) | headline | H14: articleUrl found by WebSearch on a non-wire outlet's exact headline; omit rather than guess | Google redirect links and AP/CNN block fetchers | |
| 2026-09-05 | (dry run) | style | I7 added: tooling bugs may be fixed mid-run only with a green selftest and a changelog row | The validator rejected the digit answer "3"; the agent had no sanctioned path | |
| 2026-09-05 | (dry run) | tooling | validate_puzzle.py: digit answers exempt from E_ANSWER_LENGTH; B4 device caps count boxes, not tiles; W_CHIP_HEAVY fires above half, not at half | Roman X and VII in one box tripped the cap; "ts" on HITS tripped the chip warning | selftest: dry-run draft validates clean |
| 2026-09-05 | (author feedback + archive) | decomposition | D14 added: additive chips at most 2 letters, never the start of the answer, at most 40% of its letters; chip penalties raised (-3/-5/-8), subtrahend chips -2 | Author: prefer images over text, especially when the text gives the word away | `validate_puzzle.py`: E_CHIP_GIVES_START, W_CHIP_LONG, W_CHIP_TOTAL |
| 2026-09-05 | (author feedback) | image | D8 P6 added: no wordmarks; logos as symbol only (YouTube play button without the word) | Author: use the YouTube logo without the "YouTube" text | image-sourcing.md checklist item 2 |
| 2026-09-05 | (author feedback) | image | D8 P7 added: minimalist clip-art with clearly identifiable features; D9 style modifier flat +2 / photo -3; realistic scenes forbidden | Author: images as simple as possible while still conveying the meaning | image-sourcing.md checklist item 3 |
| 2026-09-05 | (archive analysis) | word | H8/W4: 10-letter cap -> 12 with a warning above 10; 36 letters total | The archive uses Republicans, Commencement, Democratic, Temporarily with 4 pieces | `validate_puzzle.py`: W_ANSWER_LENGTH above 10, E_ANSWER_LENGTH above 12 |
| 2026-09-05 | (archive analysis) | style | D6b added: the archive's device vocabulary (music notes, grades, hand signs, symbols, clock, calendar, pointing arrows, slogans, positional rebuses); Q12 uses the author's `chunk [image]` notation; insert_puzzle.py emits a paste-ready spreadsheet row | 29-puzzle database exported to `archive.md` | `render_glyph.py --style positional` builds "shut" at the bottom of a frame = shutdown |
| 2026-09-05 | (author feedback) | style | E section added (E1 thematic echo / comic incongruity bonus, E2 signature box, E3 references without faces, E4 topical pictures, E5 one playful hint, E6 the line); Q13 added; D14 allows one chip letter for 2-letter answers | Author asked how to make puzzles funny, entertaining and relevant (message truncated after "without"; assumed "without hurting solvability or taste") | archive: trumpet - E.T. = TRUMP, hippo - hip + ape = POPE |
| 2026-09-05 | (author feedback) | decomposition | D2b added: flat silhouettes of extremely famous people as whole-word boxes (surname kept by 3+ outlets, distinctive feature at 48 px, flat art, hint names the office, cap 1); P5/L2/E3 reworded from "no real faces" to "no photographs or realistic likenesses" | Author: for extremely famous people use a clipart silhouette or outline instead of composing the name, e.g. Trump | `validate_puzzle.py`: device `silhouette`, W_SILHOUETTE; `find_images.py` flags silhouettes instead of faces |

## Feedback log

Verbatim user feedback captured at the retro step, newest first. Each entry names the puzzle id
and the rule(s) it changed, so a future reader can see why a rule exists.

- 2026-09-05, author (chat): "For extremely famous people, you can use a clipart silhouette or outline instead of composing the name, e.g. Trump" -> D2b, P5, L2, E3, B4.
- 2026-09-05, author (chat, truncated): "How to make them funny/entertaining/relevant without" -> E1-E6, Q13; the ending of the sentence is still to be confirmed.
- 2026-09-05, author (via `Decryptions Database.xlsx` and chat): "Prefer images over text, especially if the text gives away the word. E.g. use YouTube logo stock photo without the 'YouTube' text." and "Images should be as simple as possible while still conveying the meaning: prefer minimalist clip-art with clearly identifiable features over complicated realistic shots." -> D14, P6, P7, D9 style modifier.
- 2026-09-05, dry run `2026-09-05-us-hits-3-iran-tankers` (unattended agent, no human feedback yet): 19 friction points reported by the run itself, folded into the rows above; remaining open items: parallel thumbnail fetching was added but Openverse remains slow; first-run scaffolding files (`image-credits.json`, `Attributions.md`) are committed with the skill.
