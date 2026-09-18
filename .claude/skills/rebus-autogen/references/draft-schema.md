# Draft schema, derivation DSL, validator codes

## The draft file

`<work>/draft.json` is the app's `Puzzle` shape plus skill-only fields. `insert_puzzle.py` strips
the skill-only fields (`derivations`, `word`, `device`, `meta`, `sources`) when it writes
`puzzles.ts`.

```json
{
  "id": "2026-09-05-fed-cuts-interest-rates",
  "headline": "Fed Cuts Interest Rates",
  "date": "September 5, 2026",
  "category": "Business",
  "articleUrl": "https://www.reuters.com/...",          // optional
  "words": [
    {
      "answer": "HOLDS",
      "derivations": "(HOLE - E) + (DUCK - UCK) + S",
      "clues": [
        { "type": "operator", "content": "(" },
        { "type": "image", "content": "/hole.png", "alt": "Hole", "word": "HOLE" },
        { "type": "operator", "content": " - " },
        { "type": "text", "content": "E" },
        { "type": "operator", "content": ") + (" },
        { "type": "image", "content": "/duck.png", "alt": "Duck", "word": "DUCK" },
        { "type": "operator", "content": " - " },
        { "type": "text", "content": "uck" },
        { "type": "operator", "content": ") + " },
        { "type": "text", "content": "S" }
      ]
    }
  ],
  "hints": ["Pit in the ground minus E + water bird minus uck + S"],
  "meta": { "newsCluster": 1, "notes": "anything useful for the retro" }
}
```

Field rules:
- `word` (image clues, required): the word the picture stands for, uppercase. A punctuation chip
  (`content: ":"`) also needs `word` (`COLON`). Plain letter chips do not.
- `device` (image clues, optional): `logo | flag | outline | element | roman | cursive | alphabet | sign | silhouette`.
  The validator uses it for the B4 caps and to list logos for the user.
- `alt`: house-style noun phrase; never another box's answer.
- `derivations`: the DSL string below; the validator checks it against both the answer and the
  clue list, so the three can never drift apart.

## Derivation DSL

```
derivation := term ('+' term)*
term       := (WORD | '(' WORD ('-' WORD)+ ')') ['~' RESULT]
```

Evaluation of a group, left to right: if the subtrahend is a **prefix** or **suffix** of the
current string, strip it. Anything else is not letter arithmetic and is an error, unless the term
declares a phonetic result with `~RESULT`, which overrides the letters and counts as one sound step.
Digit answers (`"8"`) evaluate Roman numerals and digits numerically: `(XV - VII)` -> `8`.

| Example | Result | Notes |
|---|---|---|
| `(TROUT - OUT)` | `TR` | suffix strip |
| `(CABIN - CAB)` | `IN` | prefix strip |
| `(DUCK - K) + ES` | `DUCES` | chip appended |
| `(YOUTUBE - TUBE) ~U + S` | `US` | letters give YOU; sound gives U (respell, 1 sound step) |
| `(TREE - TEA) ~RE` | `RE` | TEA is not a prefix/suffix; sound-subtraction |
| `(SMILE - AISLE) ~SM + O + KING` | `SMOKING` | |
| `EIGHT ~ATE` | `ATE` | respell of a whole picture word |
| `(XV - VII)` | `8` | numeric, only when the answer is digits |
| `GERMANY` | `GERMANY` | whole-word image |

The clue list is canonicalised (image -> `word`, text -> upper, operators without spaces) and must
equal the derivation with `~RESULT` and spaces removed, e.g. `(TROUT-OUT)+(ZOO-Z)+(UPS-U)`.

## Validator output

```json
{"ok": false,
 "errors":   [{"code": "E_ARITHMETIC", "where": "words[2]", "msg": "..."}],
 "warnings": [{"code": "W_PHONETIC_HEAVY", "where": "words[1]", "msg": "..."}],
 "arithmetic": [{"answer": "TROOPS", "derivation": "...", "notation": "(trout [Trout] - out [Umpire calling out]) + ...",
                 "computed": "TROOPS", "pieces": 3, "phoneticSteps": 0, "band": "Medium",
                 "steps": ["TROUT - OUT = TR (suffix)", "..."]}],
 "meta": {"bands": [...], "phoneticSteps": 2, "respells": 0, "tiles": 13, "atoms": 17,
          "newImages": [...], "reusedImages": [...], "devices": {"logo": 2}}}
```

### Error codes (exit 1; must be fixed)

| Code | Meaning | Rule |
|---|---|---|
| E_MISSING_FIELD | id/headline/date/category/words/hints missing | |
| E_DATE_FORMAT | not `Month D, YYYY` en-US long form | H14 |
| E_ID_FORMAT / E_ID_DATE_MISMATCH / E_ID_SLUG | id is not `YYYY-MM-DD-kebab(headline)` | H14 |
| E_ID_DUPLICATE / E_DATE_DUPLICATE | already in puzzles.ts | H14 |
| E_HEADLINE_WORDS | not 3-6 words | H3 |
| E_HEADLINE_PUNCT | punctuation in the headline | H12 |
| E_HEADLINE_ANSWERS_MISMATCH | headline tokens != answers | W2 |
| E_HINTS_PARITY / E_HINT_TYPE | hints count != words, or not a string | Q4 |
| E_HINT_LEAKS_ANSWER | hint contains its answer | T5 |
| E_DUPLICATE_ANSWER | same answer twice | W6 |
| E_ANSWER_TOKEN / E_ANSWER_LENGTH | not `^[A-Z0-9]+$`, or 1 letter | W1, W4 |
| E_CLUE_TYPE / E_CLUE_CONTENT | type not image/text/operator, empty content | C5 |
| E_OP_TOKEN | operator not one of the seven tokens | C1 |
| E_PARENS | unbalanced parentheses | C1 |
| E_TEXT_TOKEN / E_CHIP_IS_ANSWER / E_CHIP_WORD_MISSING | chip problems | C2, D6 |
| E_CHIP_GIVES_START | an additive chip of 2+ letters spells the start of the answer | D14 |
| E_NO_IMAGE | box without an image | C2 |
| E_MINUEND_NOT_IMAGE | left side of a minus is not an image | C3 |
| E_IMAGE_ALT_MISSING / E_IMAGE_WORD_MISSING | image lacks alt or word | C5 |
| E_IMAGE_PATH / E_IMAGE_MISSING / E_IMAGE_UNREADABLE | bad path, file absent, undecodable | F1 |
| E_IMAGE_NOT_SQUARE | new file is not square | F5 |
| E_IMAGE_NO_PROVENANCE | new file has no image-credits.json row | F6 |
| E_DERIVATION_MISSING / E_DERIVATION_SYNTAX | derivation absent or unparsable | |
| E_ARITHMETIC | derivation does not yield the answer, or a removal is not prefix/suffix | D3, Q1 |
| E_DERIVATION_MISMATCH | clue list and derivation disagree | Q2 |
| E_PHONETIC_LIMIT | 3 sound steps in one box | B3 |

### Warning codes (exit 0; each one must be justified in the QA table)

W_CATEGORY_UNKNOWN, W_ARTICLE_URL, W_DATE_PAST, W_DATE_FUTURE_EXPOSURE, W_ANSWER_LENGTH,
W_HINT_LONG, W_HINT_LEAKS_OTHER, W_CHIP_HEAVY, W_CHIP_LONG, W_CHIP_TOTAL, W_CHIP_CASE, W_IMAGE_REPEATED,
W_IMAGE_REUSED_RECENTLY, W_IMAGE_NOT_SQUARE (legacy files only), W_ALT_LEAKS_ANSWER,
W_LOGO_FLAGGED, W_SILHOUETTE, W_BOX_BUSY, W_TOO_MANY_CHIPS, W_MINUEND_CHIP, W_TOO_MANY_PIECES,
W_PHONETIC_HEAVY, W_PHONETIC_TOTAL, W_RESPELL_TOTAL, W_NO_EASY_BOX, W_TOO_MANY_HARD,
W_ADJACENT_HARD, W_WHOLE_WORD_BOXES, W_DEVICE_CAP, W_TOO_MANY_TILES, W_TOO_MANY_ATOMS,
W_TOO_MANY_NEW_IMAGES.

`W_DATE_FUTURE_EXPOSURE` matters: `getCurrentPuzzle()` falls back to `puzzles[0]` whenever no
entry matches today's date, so a future-dated puzzle at index 0 is live immediately.
