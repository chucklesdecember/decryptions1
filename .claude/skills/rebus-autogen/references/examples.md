# Worked examples

Three examples: the newest real puzzle as a draft (what "house style" is), a box from the May 1
puzzle that the rulebook would now reject and how to fix it, and a full run from a live cluster.

## 1. The May 3, 2026 puzzle as a draft (`tests/fixtures/draft-good.json`)

Headline "US Reduces Troops in Germany" (5 words, category World News, H13).

| word | derivation | steps | band | hint |
|---|---|---|---|---|
| US | `(YOUTUBE - TUBE) ~U + S` | YOUTUBE - TUBE = YOU (suffix); ~U (respell); + S | Medium | Video platform minus tube + one letter |
| REDUCES | `(TREE - TEA) ~RE + (DUCK - K) + ES` | TREE - TEA is a sound subtraction (TEA is not a prefix/suffix), so `~RE`; DUCK - K = DUC; + ES | Hard | Tree without tea sound + duck without fancy K + two letters |
| TROOPS | `(TROUT - OUT) + (ZOO - Z) + (UPS - U)` | TR + OO + PS | Medium | Fish without out + animal park without Z + delivery company without fancy U |
| IN | `(CABIN - CAB)` | prefix strip | Easy | Cabin minus taxi |
| GERMANY | `GERMANY` | whole-word outline (device: outline) | Easy | European country |

What to notice:
- Two logos (YouTube, UPS): exactly the B4 cap; both are listed for the user (L3).
- The hint style: prose, synonyms for pictures ("video platform", "animal park", "delivery
  company", "taxi"), the picture word itself when no synonym is natural ("tree", "duck",
  "cabin"), " sound" marking the phonetic step (T3, T4).
- Chips are lowercase when multi-letter ("es") and uppercase when single ("S", "Z", "U").
- Band profile Medium, Hard, Medium, Easy, Easy passes B2 (one Hard, one Easy, no adjacent Hards).

## 2. A box the rules now reject: SENATE (May 1, 2026)

As published: `(SKI - KEY) ~S + (GARDEN - GUARD) ~EN + (KARATE - CAR) ~ATE`, three sound steps in
one box. The validator returns `E_PHONETIC_LIMIT` (B3), and the hint needed "key sound" plus two
more sound reads the hint did not even mark.

Fix by D1: enumerate again.

| candidate | derivation | D9 notes | score |
|---|---|---|---|
| A | `(SEND - D) + EIGHT ~ATE` | 2 pieces, 2 tiles, one respell (-10), SEND is grade B (paper-plane icon, hint "mail it"), EIGHT is a digit picture | -15 |
| B | `(SEAL - AL) ~SE + (NATION - ION)` | NATION has no picture (P1 fails) | forbidden |
| C | `(SENSE - SE) ~SEN + ATE` chip | 3-letter chip (-6), SENSE not pictureable | forbidden |
| D | `SE + (NATE)` | no picture words | forbidden |

Winner A: `(SEND - D) + EIGHT ~ATE` = SEN + ATE = SENATE, one sound step (Medium), hint "Mail
it minus D + the number after seven (say it)". Better than the published box on every B rule, and
the validator now passes it. This is also how the retro works: the rejection ("three sound steps
was too much") tightened B3 in the changelog.

## 3. Full run from a live cluster (feed snapshot of 2026-09-05)

Cluster 1 (AP lead): "US hits Iranian oil tankers, and other key Mideast developments" /
CNN "US military strikes three Iranian tankers in retaliation for missile attacks" /
WSJ "U.S. Strikes Three Iranian Ships After Missiles Fired at American Aircraft Carrier" /
Reuters "US, Iranian forces fire at vessels in waters near Iran" /
NYT "U.S. Strikes Three Iranian 'Shadow Network' Oil Tankers, Military Says".

- **H1 essentials:** ACTOR US (5/5), ACTION hits/strikes (5/5), OBJECT Iranian tankers
  (tankers 3/5, ships/vessels 2/5), quantity three (3/5, so H7 makes it the digit token 3).
- **H2 statement:** AP is the first-listed wire outlet, so its verb: "The US hits three Iranian
  oil tankers."
- **H3-H8:** two valid compressions, "US Hits 3 Iranian Tankers" and "US Strikes 3 Iranian
  Tankers" (both 5 tokens). "Oil" has 2/5 support but would make 6 words and adds little; "in
  retaliation" is one outlet's angle (H4).
- **H10:** both have 5 words; (2) compares the differing token: STRIKES's best candidate
  (bowling strike + S, grade B, chip -2, pieces -3 = -3) beats HITS's best ((HIPPO - ppo) + ts
  = -5, two chips and no picture of the answer), so "Strikes" wins even though "Hits" is shorter
  and is the wire verb. A first dry run without H10(2) produced "US Hits 3 Iran Tankers"; that
  puzzle solved, but its HITS box was the weakest, which is why H10(2) exists.
- **H9 gate:** IRANIAN (7 letters, adjective) has no whole-word picture and no prefix/suffix
  decomposition better than -10 (IRAN + IAN chip is -6 for the chip, -5 ambiguity on a flag box).
  H9(a) swaps it for the cluster's noun form: "US Strikes 3 Iran Tankers" (headline-ese, still
  Title Case, 5 tokens). Category: World News (US action abroad, H13).
- **Design (D1-D11):**

| word | winner | letter math | band | hint |
|---|---|---|---|---|
| US | `(BUS - B)` | BUS - B = US (prefix) | Easy | Public transit minus B |
| STRIKES | `STRIKE + S` | bowling-strike icon (grade B) + S | Medium | Bowling term for knocking all pins down + S |
| 3 | `(V - II)` | V - II = 3 (numeral) | Easy | Five minus two, in Roman numerals |
| IRAN | `IRAN` | flag, device: flag | Easy | Country flag (Middle East) |
| TANKERS | `TANK + ers` | TANK + ERS (3-letter chip, allowed by W3 at -6) | Medium | Armored vehicle + ers |

  Runner-ups considered: US = US flag (forbidden by D13: the tile reads "USA", which the
  exact-match input rejects); TANKERS = `TANK + (DEER - de) + S` (-2, one more tile and a second
  chip, loses to `TANK + ers` on D10(4) fewer tiles after the score tie is broken by fewer pieces);
  `(TANK) + (EARS - A)` rejected by D3 (A is in the middle of EARS).
  Band profile Easy, Medium, Easy, Easy, Medium: passes B2. No logos. Three whole-word or
  near-whole-word boxes is at the B4 limit; acceptable because two are numeral/flag devices.
- **Images (step 3):** `bus.png` (Pixabay vector, "bus clipart"), `strike-bowling.png` (Pixabay
  vector, F2 sense suffix because "strike" alone is ambiguous), `roman-v.png` (rendered with
  `render_glyph.py`, no clean stock glyph exists) and existing `ii.png`, `iran-flag.png` (Wikimedia
  Commons PD flag via Openverse; the Commons thumbnail endpoint is used automatically), `tank.png`
  (Pixabay vector, "army tank clipart"). Every new file is 512x512 and recorded in
  `image-credits.json`.
- **QA table** shows the letter math, the two numeral devices (B4 cap 1 each: one Roman-numeral
  *box*, two glyph tiles inside it, allowed), and no warnings left unjustified.
