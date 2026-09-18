# Decryptions rebus rulebook (v1, 2026-09-05)

Numbered rules for turning one news story into one production-quality rebus puzzle.
Sections: **H** headline, **W** answers, **C** clue grammar, **D** decomposition, **B** balance,
**T** hints, **F** files and alt text, **L** legal, **Q** QA, **I** iteration.

Rule ids are permanent. When a rule changes, its text changes and `changelog.md` gets a row;
ids are never reused or renumbered, so "loosen W4" always means the same thing. Each rule
ends with a short *why* so you can generalise it to cases the rule did not foresee.

The three newest puzzles in `decryptions_inner/src/data/puzzles.ts` are the live style anchor,
and `archive.md` (the author's puzzle database, 29 puzzles back to 2024) is the device
vocabulary and the notation the author thinks in. When this file and those puzzles disagree on
taste (not on hard constraints), follow the puzzles and open a changelog row.

---

## H. Headline selection and compression

Input: one Google News story cluster (the lead headline plus ~4 related headlines from other
outlets, from `scripts/news_topstories.py`). Output: a 3-6 word headline whose tokens become
the answers, plus category, date, id.

- **H1 Essentials.** From the cluster, extract ACTOR, ACTION, OBJECT and count how many outlet
  headlines support each (aliases count: "Fed" = "Federal Reserve", "cuts" = "lowers"). Anything
  supported by 3+ of the headlines is essential and must survive compression. *Why: the shared
  facts are the story; outlet-specific angles are not.*
- **H2 Story statement.** Write one present-tense, active sentence: ACTOR ACTION OBJECT
  [WHERE / HOW MUCH]. Use the verb of the first-listed wire outlet (AP or Reuters, in cluster
  order) when one is in the cluster, else the lead outlet. The compressed headline must still say
  this sentence; it may swap in a synonym verb another outlet used when H10(2) prefers it.
  *Why: one canonical sentence removes the judgement call about "what the story is".*
- **H3 Length.** Start from the essentials; add qualifiers in order of outlet support (2+
  headlines) until you reach 5 words. Allow 6 only when an essential is multi-token or H5 forces
  a preposition. Never fewer than 3. *Why: 5 boxes fill the two-column grid and keep solve time
  in the 3-8 minute range the existing puzzles target.*
- **H4 Strip.** Drop articles, auxiliaries and copulas (is, has, will), conjunctions, quotes,
  attribution ("says", "sources", "report"), outlet names, and hedges. Convert passive to active.
  *Why: function words have no pictures and add boxes without adding meaning.*
- **H5 Keep or ban small words.** Keep "to" for the infinitive future ("Trump to Block Hormuz").
  Keep in/at/on/for only when removing it breaks the meaning ("in Germany", "at US Open").
  "not" is banned: rewrite with a negative verb (denies, rejects, halts, ends, blocks, bans).
  *Why: negation has no picture and players misread "not" boxes as errors.*
- **H6 Proper nouns.** People: surname only; a first name or mononym only if 3+ outlets use it
  ("Melania"). No titles (President, Senator). Multi-token names become separate boxes.
  Hyphenated words split into tokens ("Ex", "Lieutenant"). Places: one common token (Maine,
  Germany, Hormuz). Abbreviations (US, UK, EU, UN, ICE, NASA, FBI) only when 3+ outlets use them.
  Organisations by their common short name (Fed, Senate). *Why: every token must be one box.*
- **H7 Digits.** A number central to the story (3+ outlets) becomes its own token as digits 1-99;
  100+ is dropped or reworded; at most one digit token; no ordinals. *Why: the letter-count badge
  and the exact-match input only behave for plain digits.*
- **H8 Caps.** 12 letters per word (over 10 needs 4 pieces and a justification), 36 letters
  total. If exceeded, swap the longest content word for a shorter synonym that another outlet in
  the cluster used. *Why: the archive handles 10-12 letter words (Republicans, Commencement,
  Democratic) with 4 pieces, but anything longer blows the tile budget (B5).*
- **H9 Decomposability gate.** Every token's best candidate under D9 must score at least -10.
  If a token fails: (a) swap it for a synonym used elsewhere in the cluster; (b) if it is a
  person's name, drop it (H9 outranks H1 for names only); (c) pick the verb from this preferred
  list when the sense allows: bans, blocks, cuts, ends, fires, halts, kills, loses, opens,
  passes, quits, sets, sues, wins, beats. *Why: some words simply have no good rebus.*
- **H10 Tie-break** among valid compressions: (1) word count closest to 5 (5 > 4 > 6 > 3);
  (2) higher sum of D9 scores of the best candidate for each token that differs between the
  compressions (only the differing tokens need scoring); (3) fewer total letters; (4) matches the
  verb and word order of the first-listed wire outlet; (5) alphabetical. *Why: identical input
  must yield identical output, and a synonym that decomposes cleanly ("strikes" as a bowling
  strike) makes a better puzzle than a shorter word with no picture ("hits").*
- **H11 Taste and legal.** No private individuals, victims, or minors by name; public figures are
  fine. Deaths get neutral verbs (dies, killed) and no gore in pictures. *Why: the puzzle is
  shared on social media next to real grief.*
- **H12 Case and punctuation.** Title Case; a/an/the/in/at/on/to/for/of/and lowercase unless
  first; abbreviations uppercase; no punctuation at all. *Why: tokens must equal answers exactly.*
- **H13 Category**, first test that matches wins: Sports (athlete/team/event is the subject) >
  Entertainment > Science > Tech > Business (markets, economy, prices, rates, deals) > Politics
  (elections, candidates, legislation, votes) > U.S. News (happens in the US) > World News
  (everything else, including US action abroad). The legacy "World" is retired.
- **H14 Metadata.** `date` = target day in en-US long form ("September 17, 2026"); `id` =
  ISO date + "-" + kebab(headline); `articleUrl` is optional: WebSearch the exact headline of a
  non-wire outlet in the cluster and include the article URL only if it appears in the results
  (news.google.com links are JS redirects and AP/CNN block fetchers); omit rather than guess. The date must not already exist in `puzzles.ts`. *Why: `getCurrentPuzzle` matches the
  date string exactly and the archive sorts by id.*

## W. Per-word answers

- **W1** `answer` = token uppercased, `^[A-Z0-9]+$`; strip diacritics; no spaces, hyphens, or
  apostrophes. *Why: the input uppercases and compares exactly.*
- **W2** `answer` equals the headline token (case-insensitive), in order. *Why: the words array
  and the displayed headline must stay in lockstep.*
- **W3** Inflections stay as in the headline. A suffix may be a text chip; 2 letters or fewer
  ("s", "es", "ed") is the norm, and a 3-4 letter chip ("ers", "ing") is allowed but carries the
  D9 chip penalty (-6) so an image chunk wins whenever one exists.
- **W4** Length 2-12 (over 10 is a warning to justify); at most two 2-letter answers per puzzle;
  one-letter answers are forbidden (digit answers are governed by W5, so "3" is fine).
- **W5** Digit answers: at most one per puzzle, 1-99, clued by numeral arithmetic (D6).
- **W6** No duplicate answers in a puzzle; an answer used in the last 90 days must get different
  clues. *Why: regulars notice repeats.*
- **W7** Abbreviations decompose like any word (flag, outline, logo, or arithmetic), never as a
  text-only box. *Why: a box of chips is not a rebus.*

## C. Clue grammar

```
Box   = Piece { "+" Piece } ;             1-3 pieces (4 only if the answer has 9+ letters)
Piece = Atom | "(" Minuend "-" Atom ")" ; subtraction is ALWAYS parenthesised
Atom  = Image | Chip ;  Minuend = Image ;
Chip  = 1-4 letters (single letter UPPER, 2-4 lower) | one punctuation mark standing for its name
```

- **C1 Serialisation is mechanical.** Emit operator tokens from this gap table, then atoms;
  inside a subtraction emit `minuend, " - ", subtrahend`; if the last piece is a subtraction,
  append `")"`. Only the seven tokens `(`, ` - `, `) + (`, `) + `, `)`, ` + `, ` + (` exist.
  *Why: PuzzleBox renders operator strings verbatim (whitespace-pre); a stray space shows.*

  | previous -> next | next is an atom | next is a subtraction |
  |---|---|---|
  | start | nothing | `(` |
  | atom | ` + ` | ` + (` |
  | subtraction | `) + ` | `) + (` |

- **C2** At least one image per box (pure-chip boxes forbidden); at most 6 atoms and 2 chips per
  box; a chip may not equal the answer, and a chip of half the answer's letters or more is a
  warning to justify. *Why: chips are glue, not the puzzle.*
- **C3** The minuend (left side of a minus) is always an image. *Why: "letters minus picture"
  reads backwards to players.*
- **C4** Chips are the default for literal letters. An alphabet image (tea, pea, bee, element
  cell, Roman numeral) replaces a chip only when D9 prefers it; at most one alphabet image per box.
- **C5** `type` is only `image | text | operator` (never `symbol`); image `content` is
  `/name.png` (or `.svg`); every image has an `alt`.

## D. Decomposition procedure

- **D1 Enumerate, then score.** For each word, generate candidates from every strategy S1-S6,
  score each with D9, choose with D10, and resolve puzzle-level caps with D11. Show the top 3
  candidates per word in a table; do not stop at the first idea. *Why: the first idea is usually
  the most obvious, not the best.*
- **D2 S1 whole-word image.** The answer is itself a grade A/B picture word (DUCK, KEY), or a
  proper noun with a canonical flag, state/country outline, or logo.
- **D2b Famous-person silhouettes.** A person's name may be a whole-word box as a flat clip-art
  silhouette or outline (never a photo, never a caricature) when all four hold: (i) H6 already
  keeps the surname alone, used by 3+ outlets in the cluster; (ii) the person is on the
  silhouette-eligible list below, or the silhouette carries a feature that identifies them at
  48 px (hair, hat, glasses, robes, profile) and passes the P2 test; (iii) the file is flat
  single-colour or two-colour art on a plain background; (iv) the hint names the office or role,
  not the name ("US president, in silhouette"). Device `silhouette`, cap one per puzzle (B4).
  Silhouette-eligible (extend via the changelog): Trump (hair, profile), the Pope (mitre or
  zucchetto; stands for the office, so it clues POPE, not LEO), Obama (profile), Kim Jong Un
  (hair), Queen Elizabeth II (hat, handbag), historical figures with public-domain likenesses
  (Lincoln, Washington, Einstein, Elvis, Chaplin). Not eligible without a distinctive feature:
  Biden, Putin, Musk, most athletes; decompose those names (KORIR). *Why (author, 2026-09-05):
  "For extremely famous people, you can use a clipart silhouette or outline instead of composing
  the name, e.g. Trump." A silhouette is editorial use of a public figure's likeness in a puzzle
  about them and carries no photo rights; keep it to people the whole audience recognises.*
- **D3 S2 image minus affix.** Picture word W = X + answer or answer + X. X is removed as a whole
  prefix or suffix, never from the middle. X is a picture word or a chip. *Why: chop-front or
  chop-back is the only operation a player can run without an anagram hunt. (TREE - TEA is not
  letter arithmetic; it is a sound subtraction, see D5.)*
- **D4 S3 chunk concatenation.** Split the answer into 2-3 contiguous chunks (4 if 9+ letters),
  each produced by S1/S2/S5/S6. Enumerate every split point.
- **D5 S4 phonetic.** (a) *Sound-subtraction*: the removed prefix or suffix, as pronounced inside
  W, is a homophone of the subtrahend picture (TOLL - TOW = LL, SMILE - AISLE = SM, TREE - TEA =
  RE); the remaining letters are used verbatim; the hint must say "sound". (b) *Respell*: a whole
  piece from the whitelist YOU/EWE -> U, EYE -> I, SEA/SEE -> C, TEA -> T, PEA -> P, BEE -> B,
  ATE -> EIGHT (picture of 8), WON -> ONE, FOUR -> FOR, TWO -> TO, KNIGHT -> NIGHT; at most one
  respell per puzzle. In the draft DSL both are declared with `~RESULT`.
- **D6 S5 alphabet devices** (the picture stands for exactly what is listed):

  | Stands for | Picture | Existing file |
  |---|---|---|
  | B, P, T | bee, pea, tea | `/bee.png` `/pea.png` `/tea.png` |
  | C, I, U | sea (waves), single eye, ewe | (new: `/sea.png` `/eye.png` `/ewe.png`) |
  | K | potassium periodic cell | `/potassium-k.png`, `/potassium.png` |
  | NA, AU, FE, AL, CU, ... | periodic cell, element **symbol** only | `/sodium.png`, `/gold-au.png`, new `/<element>-<symbol>.png` |
  | numbers | Roman numeral glyph | `/ii.png` (2), `/vii.png` (7), `/roman-ten.png` (10), `/xv.png` (15) |
  | PI | pi symbol | `/puzzle-pi-symbol.png` |
  | "fancy" letters | cursive glyph | `/k-cursive.png`, `/s-cursive.png`, `/g-cursive.png`, `/ld-cursive.svg` |
  | O | ASL "O" hand sign | `/asl-o.png` |
  | COLON, DASH, SLASH, HASH, STAR, AT, AND | punctuation chip `:` `-` `/` `#` `*` `@` `&` (declare `word`) | text chip |
  | any glyph with no clean stock file | rendered with `scripts/render_glyph.py` (Roman numerals, letters, element cells; Pillow's CC0 font) | new `/roman-v.png`, `/copper-cu.png` |

- **D6b Extended device vocabulary** (from `archive.md`; all produce letters or short chunks):
  music notes on a staff (d, f, g), a circled letter grade (F), hand signs (L hand, three fingers,
  timeout T), keyboard shortcuts (Cmd+C = copy), road signs (U-turn = turn, reverse gear = R),
  currency and math symbols ($ minus its bar = S, "&" = an, "<" = less, "+ - x /" = operations),
  a calendar page (May), a clock face (ten, IV), map outlines (states, countries, Hawaii),
  an arrow or circle pointing at one part of a picture (mane, knee, shin, the "new" teddy bear),
  fill-in-the-blank slogans ("the quicker picker upper" = Bounty), and positional rebuses (the word
  "shut" sitting at the bottom of a frame = shutdown; make these with
  `render_glyph.py --style positional`). Pointing arrows and slogans are hand-made devices: use
  them only when the user asks, since no script produces them.
- **D7 S6 chip fill.** A leftover chunk of 4 letters or fewer becomes a chip; prefer
  inflectional suffixes and chips of 2 letters or fewer, and see D14 before adding any chip.
- **D8 Pictureability test** (all must hold, else the image is forbidden):
  P1 concrete noun, iconic sign, or a verb with an iconic gesture;
  P2 canonical: 4 of 5 viewers would name the 48 px clip-art with the intended word; a competing
  common name (cab/taxi, mitt/glove, mug/cup) makes it "ambiguous" and the hint must resolve it;
  P3 silhouette-legible at 48 px: no scenes, no small text (except glyph classes, logos, signs),
  no multi-object compositions;
  P4 common: in a US high-schooler's vocabulary; brands need national recognition;
  P5 safe: no photographs or realistic likenesses of real people (a flat silhouette of an
  extremely famous person is allowed under D2b), no gore, no slurs;
  P6 no wordmark: the image must not contain readable text that spells the picture word. Logos
  are used as their symbol alone (the YouTube play button without "YouTube", the Shell pecten,
  the Under Armour mark, the X glyph); text inside an image is allowed only when the text *is*
  the device (periodic cell, Roman numeral, cursive letter, sign, positional rebus). *Why: a
  wordmark hands the player the letters and turns the box into reading, not decoding.*
  P7 minimal: as simple as possible while still unmistakable. Rank candidates flat vector or
  emoji > simple illustration > clean cut-out photo; busy or realistic scenes are forbidden. A
  duck is a yellow silhouette with a bill, not a photograph of a pond. *Why: the tile is 48 px;
  only strong silhouettes and two or three identifying features survive at that size.*
  Grades: **A** +6 (duck, tree, key, clock), **B** +2 (needs the hint: guard, garden, dinner),
  **C** -6 (gesture verbs: dig, eat, blink, out). Style modifier (P7): flat vector or emoji +2,
  simple illustration 0, cut-out photo -3.
- **D9 Rubric** (sum per candidate): tiles -4 x (n-1); pieces -3 x (n-1); each image's grade;
  ambiguity -5; obscurity -8; brand logo -5; reuse of an existing `public/` file +3 (non-alphabet
  images only); same image in the last 5 puzzles -3; plural depiction -4; signage word
  (STOP/OPEN/EXIT) -4; alphabet device +4 flat; additive chip -3 (1 letter), -5 (2 letters), -8 (3-4 letters);
  subtrahend chip -2; subtraction that keeps more than it removes +2, removes more than it keeps
  -3; sound-subtraction -6; respell -10; single-tile whole-word box +8. Glyph tiles (Roman numerals, cursive letters, element cells,
  rendered glyphs) carry no picture grade; the +4 alphabet-device bonus is their whole credit.
  *Why the numbers: they encode "fewest tiles, most obvious pictures, least sound trickery" as a
  total order so two runs agree.*
- **D10 Tie-break:** (1) score (including at most two E1 bonuses per puzzle); (2) fewer sound/respell ops; (3) fewer brand logos; (4) fewer
  tiles; (5) more reused files; (6) alphabetical by concatenated image filenames.
- **D11 Puzzle-level allocation.** Take each box's top 3 candidates; pick the combination that
  maximises total score subject to every B cap; ties go to the higher score in the earlier box.
- **D12 Gate.** A best candidate below -10 sends the word back to H9.
- **D14 Images over text.** A chip is glue, never the puzzle. Additive chips (letters added
  with "+") are at most 2 letters, are never the first letters of the answer, and together carry
  at most 40% of the answer's letters (one letter is always allowed, so "US = YOU + S" stands);
  anything larger comes from an image, even at the cost of one more tile. Subtrahend chips (the part removed) may be up to 4 letters because they reveal
  nothing. Chips are for inflections ("s", "es", "ed") and single glue letters. When an image can
  carry the letters (an element cell for "al", a music note for "d", a hand sign for "L"), the
  image wins. *Why (author, 2026-09-05): "Prefer images over text, especially if the text gives
  away the word."*
- **D13 Alias pictures.** A whole-word (S1) picture is forbidden when its canonical name is a
  different spelling or alias of the answer: the US flag reads "USA" or "American flag", the Union
  Jack reads "UK" or "Britain", a skyline reads "NYC". The exact-match input rejects the alias, so
  such pictures may only appear inside arithmetic where the hint fixes the reading. *Why: the May
  1 MAINE outline works because "Maine" is the only name for it.*

## B. Difficulty balance

- **B1 Bands.** Easy = 1 piece, no sound. Medium = 1 piece with sound; 2 pieces (at most one
  sound step); 3 pieces with no sound. Hard = 3 pieces with any sound step; 4+ pieces; or any box
  with 2+ sound steps. *Calibrated so the May 3 puzzle scores Medium, Hard, Medium, Easy, Easy and the May 1 puzzle Hard, Medium, Easy, Hard, Medium; both pass B2.*
- **B2** At least one Easy box; at most two Hard; no two Hard boxes adjacent in reading order
  (the grid pairs neighbours). *Why: a run of hard boxes is where players quit.*
- **B3 Sound budget.** Sound-subtraction: 1 per box preferred; 2 in one box is a warning that
  must be justified in the QA table; 3 is forbidden. At most 3 sound ops per puzzle; at most one
  respell per puzzle. *Why: the May 1 SENATE box (three sound steps) drew the most hint use.*
- **B4 Device caps per puzzle.** Whole-word (S1) boxes 2 (more turns the rebus into a picture
  quiz); brand logos 2 (1 per box); element cells 1; Roman numerals 1; cursive glyphs 1;
  punctuation chips 1; alphabet devices 3 total, 1 per box; famous-person silhouettes 1 (D2b).
- **B5 Size.** At most 6 atoms per box, 20 per puzzle, 14 image tiles, 10 new image files.
- **B6 Freshness.** The D9 recency penalty keeps consecutive days from looking alike.

## E. Entertainment: funny, memorable, topical

The rules above make a puzzle *correct*; these make it worth sharing. They act as bonuses and
tie-breaks inside D9-D11 with caps, so they never override balance or taste (H11, L2), and they
are checked in the QA table (Q13).

- **E1 Thematic echo or comic incongruity.** When two candidates for a box are within 3 D9
  points, prefer the picture that either echoes the story (a tank in a military story, a gavel
  in a court story, a ballot for an election) or clashes with it absurdly (a hippo and an ape
  spelling POPE, a trumpet minus E.T. spelling TRUMP). Give the winner +2; at most two boxes per
  puzzle take this bonus. *Why: the archive's most-shared boxes are exactly these two kinds, and
  a small capped bonus keeps them a tie-break rather than a driver.*
- **E2 One signature box.** Every puzzle has at least one box with a device players will
  retell: a pun-level homophone (sun = son, meat = meets, witch minus C = with), a positional
  rebus (shut at the bottom of a frame = shutdown), a visual pun ($ minus its bar = S), or a
  cultural reference that needs no face (a logo used nominatively, a slogan blank, a Roman numeral
  clock). Cap two per puzzle; the signature box may be Hard, the others then stay Easy or Medium.
  *Why: the "aha" is what gets screenshotted; two is already a lot for a five-box grid.*
- **E3 Cultural references without faces.** Pop culture arrives through logos, symbols, emoji,
  slogans, titles, generic character silhouettes, and D2b silhouettes of extremely famous
  people, never photographs of real people (L2).
  A copyrighted character (E.T., a Marvel hero) counts as a logo for the B4 cap (2 per puzzle,
  1 per box) and is listed in the QA table. *Why: recognisable, shareable, and no likeness or
  photo rights to clear.*
- **E4 Topical pictures over generic ones.** For proper nouns and story-specific words, prefer
  the picture the news itself uses (the outline of the state in the story, the flag, the
  institution's emblem) so the solved grid reads like the headline. *Why: relevance is what makes
  a news rebus feel like today's puzzle and not a word game.*
- **E5 One playful hint.** At most one hint per puzzle may carry a wink ("The company that
  always says 'what can brown do for you' minus U"), as long as T5-T8 still hold; the other hints
  stay plain. *Why: a joke in every hint slows solving; one lands.*
- **E6 The line.** Three tests, applied to every picture and hint:
  (a) *Victims*: in a story about a death, crime, or disaster, the boxes that spell the victim,
  the act, or the loss (KILLS, WIFE, SHOOTING, CHILDREN, CRASH) use neutral pictures and no E1
  incongruity bonus; the puzzle still gets a signature box, but it sits on a neutral word
  (VIRGINIA outline, a Roman numeral) rather than the tragedy.
  (b) *Appearance*: a picture may stand for letters, never for how a person looks. The test is
  "would this picture still be chosen if the person looked different?" HIPPO - HIP + APE = POPE
  passes (the hippo is letters); the same hippo picked for a politician because of their weight
  fails. No caricatures, no jokes about age, body, hair, or disability.
  (c) *Groups*: no picture that stands in for a nationality, religion, or ethnicity (no sombrero
  for MEXICAN; the archive spells it (dime - di) + x + i + can, which is right).
  Public figures are fair game through wordplay on their name or office (TRUMP from a trumpet).
  *Why: the puzzle is shared next to real news; one bad joke costs more than ten good ones earn.*

## T. Hints (canonical style: prose, as in the May 1 and May 3 puzzles)

- **T1** Prose, not formulas: the box already shows the parentheses and operators, so the hint's
  only new information is what each picture is and which reading is intended.
- **T2 Template.** Piece hints joined by " + "; a subtraction is "<minuend descriptor> minus
  <subtrahend descriptor>"; chips verbatim ("+ S", "+ es"); alphabet devices by what they stand
  for ("T", "periodic K", "Copper's symbol", "fancy S"); whole-word boxes get type plus region
  ("European country", "New England state outline", "Shop-door sign").
- **T3 Descriptors.** Use the picture word's most common synonym or a 1-3 word category
  ("taxi", "delivery company", "animal park", "video platform"). The picture word itself is
  allowed when no natural synonym exists ("cabin", "duck"). Ambiguous pictures (D8 P2) must get
  the disambiguating synonym. *Why: this is the house mix ("Cabin minus taxi", "Video platform
  minus tube") and it keeps hints helpful without spelling the answer.*
- **T4 Markers.** Append " sound" after a sound-subtraction subtrahend ("minus tea sound");
  respell pieces get "(say it)".
- **T5 Never include** the answer as a word, the letter count, or another box's answer.
- **T6** At most 90 characters, sentence case, ASCII, no trailing period.
- **T7** Digit boxes spell the arithmetic ("Fifteen minus seven, in Roman numerals").
- **T8** With the box and its hint visible, a solver who knows the mechanic must reach the answer.

## F. Files and alt text

- **F1 Names.** `decryptions_inner/public/<word>.png`, referenced as `/word.png`; the name is the
  picture word in lowercase kebab ASCII. Suffixes by device: `-outline`, `-flag`, `-sign`,
  `<letter>-cursive`, `roman-<numeral>`, `<element>-<symbol>`; logos are bare unless the brand is
  also a common noun (`apple-logo.png`). Drop the legacy `puzzle-` prefix.
- **F2 Sense suffix** for ambiguous words (`bat-animal.png`, `bat-baseball.png`). Never suffix a
  file with the answer: the src is visible in dev tools (`bull-bid.png` is grandfathered, not a
  pattern). Whole-word (S1) boxes are exempt by nature: `iran-flag.png` and `germany-outline.png`
  are named for the answer because the picture *is* the answer.
- **F3 Reuse.** If a file for the picture word exists and its subject is legible at tile size,
  reuse it as it is; never replace the bytes of an existing file (that silently changes older
  puzzles). A new variant gets `-2`. Do not make padded copies of legacy files: `object-contain`
  shows a 2:1 file at 48x24 px whether or not it is padded, so padding changes nothing on screen.
  A new file that turns out unusable and that no puzzle references may be removed with
  `fetch_image.py --forget --name <name>` (it refuses tracked or referenced files).
- **F4 Alt.** A short noun phrase in house style ("Taxi cab", "Cursive letter K", "Umpire calling
  out"); never another box's answer. The validator reads the clue's `word`, not the alt.
- **F5 Image spec.** New files: 512x512 PNG from `fetch_image.py` (trim, whiten, pad) or
  `render_glyph.py`; single centred subject; white or transparent background; flat clip-art or
  cut-out photo; no text except glyph classes, logos, and signs; no baked-in transparency
  checkerboard (the fetch script refuses those). Prefer square-ish subjects: a wide subject
  (flag, bus, tank) renders at roughly 48x28 px and must still read at that size. Legacy files up
  to about 2:1 are acceptable as they are. Never add a `PuzzleBox.tsx` size exception.
- **F6 Provenance.** Every new file gets a row in `src/data/image-credits.json` (written by
  `fetch_image.py`).

## L. Legal

- **L1 Sources**, in order: Pixabay (Content License, no attribution, self-hosting required) >
  Openverse with `license=cc0,pdm` (public domain) > Noto Emoji (Apache-2.0). Photos only when no
  clip-art exists. Safe search on. See `image-sourcing.md`.
- **L2 Never**: Unsplash or Pexels API assets (their API terms require hotlinking or visible
  credit), hotlinked or watermarked previews, screenshots of other sites, photographs or
  realistic likenesses of real people, identifiable private individuals. Flat silhouettes of
  extremely famous public figures are the one exception (D2b): editorial use in a puzzle about
  the news they are in, from a licensed vector (Pixabay vector or a CC0/PD file), never on
  merchandise, and listed in the QA table like a logo.
- **L3 Logos** are nominative use (the picture names the brand). Cap them with B4, prefer a
  generic picture when one exists, and list every logo in the QA table so the user can veto.
- **L4 Keep the trail**: provenance rows (F6) plus the two license lines in `src/Attributions.md`.

## Q. QA checklist (every item must pass before presenting)

- **Q1** Letter math per box, written out (`TROUT - OUT = TR; ZOO - Z = OO; UPS - U = PS`);
  every removal is a prefix or suffix; sound ops marked "~".
- **Q2** Re-serialise the piece list with C1 and diff against `clues[]`; parentheses balance;
  only the seven operator tokens; no `symbol` clues. (`validate_puzzle.py` does this.)
- **Q3** `answer.length` equals the letters implied by Q1.
- **Q4** `words.length === hints.length`; `hints[i]` describes `words[i]`.
- **Q5** Blind re-solve: with answers hidden, write the most obvious one-word reading of every
  tile from the images alone and derive each answer; repeat with hints. Both must reach 100%.
  A tile whose obvious reading differs from its `word` gets swapped or a disambiguating hint.
- **Q6** Every image path exists, is square, and has provenance if new; no answer leaks in
  filenames or alts; no remote URLs.
- **Q7** No duplicate answers; no duplicate file within a box; W6 freshness.
- **Q8** The headline shares 2+ content words (or aliases) with every cluster headline and reads
  as that story.
- **Q9** No real faces; logos listed; H11 taste.
- **Q10** `date` format and uniqueness; `id` starts with the ISO date; category in H13; object
  will sit at index 0.
- **Q11** B1-B6 pass; report each box's band.
- **Q13** Name the signature box (E2), any E1 bonuses taken, and any character or logo
  references (E3) in the QA table so the user can veto them.
- **Q12** Emit the QA table (word | breakdown | band | images + sources | hint) in the final
  message. Write the breakdown in the author's archive notation, which the validator returns as
  `arithmetic[i].notation`: `(trout [Trout] - out [Umpire calling out]) + (zoo [Zoo entrance] - z [letters])`.

## I. Iteration protocol

- **I1** Classify each rejection: headline | word | decomposition | image | hint | difficulty |
  style.
- **I2** Find the governing rule. If it *permitted* the rejected output, tighten it (a constraint
  or a D9 penalty). If no rule covers it, add the next unused number in that section. Never
  renumber or delete; mark `deprecated` instead.
- **I3** Append to `changelog.md`: date | puzzle id | class | RULE: old -> new | why | regression
  example. Append the user's verbatim words to the feedback log in the same file.
- **I4** Regenerate from the earliest affected stage only; boxes the user approved stay fixed.
- **I5** Replay any D9 weight change against the drafts in `history/`: the last 5 accepted
  puzzles must remain top candidates, or narrow the change.
- **I6** Precedence: hard gates (H/W/C/F/Q) > changelog overrides (newest wins) > rubric weights.
- **I7 Tooling bugs.** When a script rejects a draft that the rulebook clearly allows, fix the
  script during the run only if `scripts/selftest.py` passes afterwards and the fix gets a
  changelog row; otherwise report the bug at the next checkpoint and stop. Never work around a
  validator error by editing the draft into something the rules do not want.
