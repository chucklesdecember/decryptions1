#!/usr/bin/env python3
"""Validate a rebus draft against every hard constraint of the Decryptions app and the rulebook.

The draft is the Puzzle shape plus skill-only fields:
  words[i].derivations   e.g. "(TROUT - OUT) + (ZOO - Z) + (UPS - U)"  (see references/draft-schema.md)
  clues[j].word          for image clues (and punctuation chips): the word the picture stands for
  clues[j].device        optional: logo | flag | outline | element | roman | cursive | alphabet | sign

Usage:
  python3 validate_puzzle.py --draft draft.json [--design-only] [--today YYYY-MM-DD]
                             [--puzzles-ts PATH] [--public-dir PATH] [--credits PATH]

Exit 0 when there are no errors (warnings allowed), 1 on errors, 2 on environment problems.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

TEXT_CHIP_RE = re.compile(r"^([A-Za-z]{1,4}|[:.,\-/#*@&])$")
DSL_TOKEN_RE = re.compile(r"\(|\)|\+|-|~|[A-Za-z0-9]+|\S")
ROMAN_RE = re.compile(r"^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$")
ROMAN_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
LOGO_HINT_WORDS = {"logo", "brand", "trademark"}
CLUE_TYPES = {"image", "text", "operator"}
DEVICE_CAPS = {"logo": 2, "element": 1, "roman": 1, "cursive": 1, "silhouette": 1}


# ---------------------------------------------------------------- derivation DSL
class DerivationError(ValueError):
    pass


def tokenize_dsl(s: str) -> list[str]:
    toks = DSL_TOKEN_RE.findall(s or "")
    bad = [t for t in toks if not (t in "()+-~" or re.fullmatch(r"[A-Za-z0-9]+", t))]
    if bad:
        raise DerivationError(f"unexpected character(s) {bad} in derivation {s!r}")
    return [t.upper() if re.fullmatch(r"[A-Za-z0-9]+", t) else t for t in toks]


def parse_derivation(s: str) -> list[dict]:
    """Return terms: {"tokens": [A, B, ...], "phonetic": RESULT|None, "group": bool}."""
    toks = tokenize_dsl(s)
    if not toks:
        raise DerivationError("empty derivation")
    pos = 0
    terms: list[dict] = []

    def expect_word() -> str:
        nonlocal pos
        if pos >= len(toks) or not re.fullmatch(r"[A-Z0-9]+", toks[pos]):
            raise DerivationError(f"expected a word at token {pos} in {s!r}")
        pos += 1
        return toks[pos - 1]

    while True:
        term = {"tokens": [], "phonetic": None, "group": False}
        if pos < len(toks) and toks[pos] == "(":
            pos += 1
            term["group"] = True
            term["tokens"].append(expect_word())
            while pos < len(toks) and toks[pos] == "-":
                pos += 1
                term["tokens"].append(expect_word())
            if len(term["tokens"]) < 2:
                raise DerivationError(f"a parenthesised group needs at least one '-' in {s!r}")
            if pos >= len(toks) or toks[pos] != ")":
                raise DerivationError(f"missing ')' in {s!r}")
            pos += 1
        else:
            term["tokens"].append(expect_word())
        if pos < len(toks) and toks[pos] == "~":
            pos += 1
            term["phonetic"] = expect_word()
        terms.append(term)
        if pos >= len(toks):
            return terms
        if toks[pos] != "+":
            raise DerivationError(f"expected '+' at token {pos} in {s!r}")
        pos += 1


def roman_value(tok: str) -> int | None:
    if tok.isdigit():
        return int(tok)
    if not tok or not ROMAN_RE.fullmatch(tok):
        return None
    total, prev = 0, 0
    for ch in reversed(tok):
        v = ROMAN_VALUES[ch]
        total += -v if v < prev else v
        prev = max(prev, v)
    return total


def evaluate_term(term: dict, numeric: bool = False) -> dict:
    """Evaluate one term. Modes: whole | strip-prefix | strip-suffix | numeric | phonetic."""
    toks = term["tokens"]
    steps: list[str] = []
    cur = toks[0]
    mode = "whole"
    error = None
    for b in toks[1:]:
        prev = cur
        if numeric and roman_value(cur) is not None and roman_value(b) is not None:
            cur = str(roman_value(cur) - roman_value(b))
            mode = "numeric"
        elif cur.startswith(b) and len(cur) > len(b):
            cur = cur[len(b):]
            mode = "strip-prefix"
        elif cur.endswith(b) and len(cur) > len(b):
            cur = cur[: -len(b)]
            mode = "strip-suffix"
        else:
            error = (f"{b} is neither a prefix nor a suffix of {cur}; if the removal is by sound, "
                     f"declare the result with ~ (e.g. \"({toks[0]} - {b}) ~RESULT\")")
            break
        steps.append(f"{prev} - {b} = {cur} ({mode.replace('strip-', '')})")
    if term["phonetic"]:
        literal = "not letter arithmetic" if error else f"letters alone would give {cur}"
        steps.append(f"~ {term['phonetic']} (sound; {literal})")
        return {"result": term["phonetic"], "mode": "phonetic", "steps": steps, "error": None}
    if error:
        return {"result": None, "mode": "error", "steps": steps, "error": error}
    if numeric and len(toks) == 1 and roman_value(cur) is not None and not cur.isdigit():
        steps.append(f"{cur} = {roman_value(cur)} (numeral)")
        cur, mode = str(roman_value(cur)), "numeric"
    return {"result": cur, "mode": mode, "steps": steps, "error": None}


def canonical_clues(clues: list[dict]) -> tuple[str, list[str]]:
    """Clue list -> comparable string, e.g. (TROUT-OUT)+(ZOO-Z)+(UPS-U). Returns (string, problems)."""
    parts: list[str] = []
    problems: list[str] = []
    for j, c in enumerate(clues):
        t = c.get("type")
        if t == "image":
            w = (c.get("word") or "").upper()
            if not w:
                problems.append(f"clues[{j}] image {c.get('content')} has no 'word'")
            parts.append(w)
        elif t == "text":
            parts.append((c.get("word") or c.get("content") or "").upper())
        elif t == "operator":
            parts.append((c.get("content") or "").replace(" ", ""))
    return "".join(parts), problems


def canonical_derivation(s: str) -> str:
    return re.sub(r"~[A-Za-z0-9]+", "", s or "").replace(" ", "").upper()


def archive_notation(clues: list[dict]) -> str:
    """The author's spreadsheet notation: `chunk [image]`, e.g. (trout [Trout] - out [Umpire calling out]) + z [letter]."""
    parts = []
    for c in clues:
        t = c.get("type")
        if t == "image":
            parts.append(f"{(c.get('word') or '?').lower()} [{c.get('alt') or 'image'}]")
        elif t == "text":
            parts.append(f"{c.get('content')} [{(c.get('word') or 'letters').lower()}]")
        elif t == "operator":
            parts.append(c.get("content", ""))
    return "".join(parts)


# ---------------------------------------------------------------- puzzles.ts scan
def scan_puzzles_ts(path: Path) -> list[dict]:
    """Extract id, date, headline, images per top-level puzzle object (ids appear first in each)."""
    text = path.read_text(encoding="utf-8")
    starts = [(m.start(), m.group(1)) for m in re.finditer(r'^  \{\n\s+id: "([^"]+)"', text, re.M)]
    entries = []
    for i, (pos, pid) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        seg = text[pos:end]
        date_m = re.search(r'^\s+date: "([^"]+)"', seg, re.M)
        head_m = re.search(r'^\s+headline: "([^"]+)"', seg, re.M)
        entries.append({
            "id": pid,
            "date": date_m.group(1) if date_m else "",
            "headline": head_m.group(1) if head_m else "",
            "images": re.findall(r'content: "(/[^"]+)"', seg),
        })
    return entries


# ---------------------------------------------------------------- validation
def validate(draft: dict, *, design_only: bool = False, today: dt.date | None = None,
             puzzles_ts: Path | None = None, public_dir: Path | None = None,
             credits_path: Path | None = None) -> dict:
    errors: list[dict] = []
    warnings: list[dict] = []
    today = today or dt.date.today()

    def err(code, where, msg):
        errors.append({"code": code, "where": where, "msg": msg})

    def warn(code, where, msg):
        warnings.append({"code": code, "where": where, "msg": msg})

    try:
        paths = common.app_paths()
    except FileNotFoundError:
        paths = {}
    puzzles_ts = puzzles_ts or paths.get("puzzles_ts")
    public_dir = public_dir or paths.get("public")
    credits_path = credits_path or paths.get("credits")

    # ---- top-level fields
    for key in ("id", "headline", "date", "category", "words", "hints"):
        if key not in draft:
            err("E_MISSING_FIELD", key, f"draft has no '{key}'")
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings, "arithmetic": [], "meta": {}}

    pid, headline, date_s = str(draft["id"]), str(draft["headline"]), str(draft["date"])
    words, hints = draft["words"], draft["hints"]

    if not common.DATE_RE.match(date_s):
        err("E_DATE_FORMAT", "date", f"{date_s!r} must look like 'September 5, 2026' (en-US long month, no leading zero)")
    date_obj = common.parse_puzzle_date(date_s)
    if not common.ID_RE.match(pid):
        err("E_ID_FORMAT", "id", f"{pid!r} must be YYYY-MM-DD-kebab-headline")
    else:
        if date_obj and pid[:10] != date_obj.isoformat():
            err("E_ID_DATE_MISMATCH", "id", f"id starts with {pid[:10]} but date is {date_obj.isoformat()}")
        if common.slugify(headline) != pid[11:]:
            err("E_ID_SLUG", "id", f"id slug {pid[11:]!r} must equal kebab(headline) {common.slugify(headline)!r}")
    if draft["category"] not in common.CATEGORIES:
        warn("W_CATEGORY_UNKNOWN", "category", f"{draft['category']!r} is not in {common.CATEGORIES}")
    url = draft.get("articleUrl")
    if url is not None and not str(url).startswith("https://"):
        warn("W_ARTICLE_URL", "articleUrl", "articleUrl should be an https URL to the outlet's article")

    # ---- headline <-> answers
    head_tokens = re.findall(r"[A-Za-z0-9]+", headline)
    if not 3 <= len(head_tokens) <= 6:
        err("E_HEADLINE_WORDS", "headline", f"{len(head_tokens)} words; rulebook H3 requires 3-6")
    if re.search(r"[^A-Za-z0-9 ]", headline):
        err("E_HEADLINE_PUNCT", "headline", "headline must contain only letters, digits and spaces (H12)")
    answers = [str(w.get("answer", "")) for w in words]
    if [t.upper() for t in head_tokens] != [a.upper() for a in answers]:
        err("E_HEADLINE_ANSWERS_MISMATCH", "words", f"headline tokens {[t.upper() for t in head_tokens]} != answers {answers}")
    if len(hints) != len(words):
        err("E_HINTS_PARITY", "hints", f"{len(hints)} hints for {len(words)} words; hints[i] pairs with words[i]")
    if len(set(a.upper() for a in answers)) != len(answers):
        err("E_DUPLICATE_ANSWER", "words", "duplicate answers in one puzzle (W6)")

    # ---- existing puzzles
    existing = scan_puzzles_ts(puzzles_ts) if puzzles_ts and Path(puzzles_ts).exists() else []
    if any(e["id"] == pid for e in existing):
        err("E_ID_DUPLICATE", "id", f"{pid} already exists in puzzles.ts")
    if any(e["date"] == date_s for e in existing):
        err("E_DATE_DUPLICATE", "date", f"a puzzle dated {date_s} already exists in puzzles.ts")
    if date_obj:
        if date_obj < today:
            warn("W_DATE_PAST", "date", f"{date_s} is before today ({today.isoformat()})")
        elif date_obj > today and not any(e["date"] == common.format_puzzle_date(today) for e in existing):
            warn("W_DATE_FUTURE_EXPOSURE", "date", "future-dated puzzle at index 0 shows immediately: getCurrentPuzzle falls back to puzzles[0] when no puzzle matches today")
    recent_images = {img for e in existing[:5] for img in e["images"]}
    all_existing_images = {img for e in existing for img in e["images"]}

    credits = []
    if credits_path and Path(credits_path).exists():
        try:
            credits = common.read_json(Path(credits_path))
        except Exception as e:  # pragma: no cover
            warn("W_CREDITS_UNREADABLE", "credits", str(e))
    credited_files = {row.get("file") for row in credits}

    # ---- per word
    arithmetic = []
    bands = []
    phonetic_total = 0
    respell_total = 0
    tiles_total = 0
    atoms_total = 0
    device_boxes: dict[str, set] = {}
    whole_word_boxes = 0
    new_images: list[str] = []
    reused_images: list[str] = []
    seen_in_puzzle: set[str] = set()
    recently_reused: list[str] = []
    legacy_not_square: list[str] = []

    try:
        from PIL import Image  # type: ignore
    except Exception:
        Image = None  # type: ignore

    for i, w in enumerate(words):
        where = f"words[{i}]"
        answer = str(w.get("answer", ""))
        clues = w.get("clues", [])
        if not re.fullmatch(r"[A-Z0-9]+", answer):
            err("E_ANSWER_TOKEN", where, f"answer {answer!r} must match ^[A-Z0-9]+$ (uppercase, single token)")
        if len(answer) < 2 and not answer.isdigit():
            err("E_ANSWER_LENGTH", where, "one-letter answers are forbidden (W4; digit answers are governed by W5)")
        elif len(answer) > 12:
            err("E_ANSWER_LENGTH", where, f"{answer} has {len(answer)} letters; H8 caps words at 12")
        elif len(answer) > 10:
            warn("W_ANSWER_LENGTH", where, f"{answer} has {len(answer)} letters; over 10 needs 4 pieces and a justification (H8)")
        hint = hints[i] if i < len(hints) else ""
        if isinstance(hint, str):
            if answer and re.search(rf"\b{re.escape(answer)}\b", hint, re.I) and not answer.isdigit():
                err("E_HINT_LEAKS_ANSWER", f"hints[{i}]", f"hint contains the answer {answer!r}")
            if len(hint) > 100:
                warn("W_HINT_LONG", f"hints[{i}]", f"{len(hint)} chars; T6 asks for 90 or fewer")
            for k, other in enumerate(answers):
                if k != i and len(other) >= 3 and re.search(rf"\b{re.escape(other)}\b", hint, re.I):
                    warn("W_HINT_LEAKS_OTHER", f"hints[{i}]", f"hint mentions another box's answer {other!r}")
        else:
            err("E_HINT_TYPE", f"hints[{i}]", "hint must be a string")

        # clue-level checks
        n_images = n_chips = 0
        additive_chip_letters = 0
        for j, c in enumerate(clues):
            cw = f"{where}.clues[{j}]"
            t = c.get("type")
            content = c.get("content")
            if t not in CLUE_TYPES:
                err("E_CLUE_TYPE", cw, f"type {t!r}; only image | text | operator are used (C5)")
                continue
            if not isinstance(content, str) or content == "":
                err("E_CLUE_CONTENT", cw, "content must be a non-empty string")
                continue
            if t == "operator":
                if content not in common.OPERATOR_TOKENS:
                    err("E_OP_TOKEN", cw, f"operator {content!r} is not one of {common.OPERATOR_TOKENS} (C1)")
            elif t == "text":
                n_chips += 1
                prev_op = clues[j - 1].get("content", "") if j > 0 and clues[j - 1].get("type") == "operator" else ""
                subtrahend = prev_op.endswith(" - ")
                if not TEXT_CHIP_RE.match(content):
                    err("E_TEXT_TOKEN", cw, f"chip {content!r} must be 1-4 letters or one punctuation mark")
                elif content.isalpha():
                    if content.upper() == answer:
                        err("E_CHIP_IS_ANSWER", cw, "a chip may not equal the answer (C2)")
                    elif not subtrahend:
                        additive_chip_letters += len(content)
                        if len(content) >= 2 and answer.startswith(content.upper()):
                            err("E_CHIP_GIVES_START", cw, f"additive chip {content!r} spells the start of {answer}; letters that give the word away must come from an image (D14)")
                        if len(content) > 2:
                            warn("W_CHIP_LONG", cw, f"additive chip {content!r} has {len(content)} letters; D14 prefers an image for anything beyond a suffix")
                        elif len(answer) >= 3 and len(content) * 2 > len(answer):
                            warn("W_CHIP_HEAVY", cw, f"chip {content!r} is more than half of {answer}; justify or use an image (C2)")
                    if len(content) == 1 and not content.isupper():
                        warn("W_CHIP_CASE", cw, "single-letter chips are uppercase in house style")
                    if 2 <= len(content) <= 4 and not content.islower():
                        warn("W_CHIP_CASE", cw, "multi-letter chips are lowercase in house style")
                if content in ":.,-/#*@&" and not c.get("word"):
                    err("E_CHIP_WORD_MISSING", cw, "a punctuation chip needs 'word' (e.g. COLON)")
            elif t == "image":
                n_images += 1
                tiles_total += 1
                if not c.get("alt"):
                    err("E_IMAGE_ALT_MISSING", cw, "every image needs an alt (C5)")
                if not c.get("word"):
                    err("E_IMAGE_WORD_MISSING", cw, "image clue needs 'word' (what the picture stands for) so arithmetic can be checked")
                if not common.IMAGE_PATH_RE.match(content):
                    err("E_IMAGE_PATH", cw, f"{content!r} must look like /kebab-name.png (F1); remote URLs are forbidden")
                else:
                    fname = content[1:]
                    if content in seen_in_puzzle:
                        warn("W_IMAGE_REPEATED", cw, f"{content} appears more than once in this puzzle")
                    seen_in_puzzle.add(content)
                    if content in recent_images:
                        recently_reused.append(content)
                    alt = str(c.get("alt", ""))
                    for k, other in enumerate(answers):
                        if k != i and len(other) >= 3 and re.search(rf"\b{re.escape(other)}\b", alt, re.I):
                            warn("W_ALT_LEAKS_ANSWER", cw, f"alt mentions another box's answer {other!r} (F4)")
                    if not design_only and public_dir:
                        fpath = Path(public_dir) / fname
                        is_new = content not in all_existing_images
                        if not fpath.exists():
                            err("E_IMAGE_MISSING", cw, f"{fpath} does not exist")
                        else:
                            (new_images if is_new else reused_images).append(fname)
                            if is_new and fname not in credited_files:
                                err("E_IMAGE_NO_PROVENANCE", cw, f"new file {fname} has no row in image-credits.json (F6)")
                            if Image is not None and fpath.suffix.lower() != ".svg":
                                try:
                                    with Image.open(fpath) as im:
                                        wpx, hpx = im.size
                                    ratio = wpx / hpx if hpx else 0
                                    if not 0.95 <= ratio <= 1.05:
                                        if is_new:
                                            err("E_IMAGE_NOT_SQUARE", cw, f"{fname} is {wpx}x{hpx}; tiles are 48x48 with object-contain, pad it square (F5)")
                                        else:
                                            shown = f"{48 if ratio >= 1 else round(48 * ratio)}x{48 if ratio <= 1 else round(48 / ratio)}"
                                            legacy_not_square.append(f"{fname} {wpx}x{hpx}, renders {shown} px")
                                except Exception as e:
                                    err("E_IMAGE_UNREADABLE", cw, f"{fname}: {e}")
                device = c.get("device")
                if device:
                    device_boxes.setdefault(device, set()).add(i)
                if device == "logo" or any(k in str(c.get("alt", "")).lower() for k in LOGO_HINT_WORDS):
                    warn("W_LOGO_FLAGGED", cw, f"{content} is a brand logo: nominative use, cap 2 per puzzle, list it for the user (L3)")
                if device == "silhouette":
                    warn("W_SILHOUETTE", cw, f"{content} is a famous-person silhouette (D2b): flat art only, hint names the office, list it for the user")
        if n_images == 0:
            err("E_NO_IMAGE", where, "a box needs at least one image (C2)")
        if answer and not answer.isdigit() and additive_chip_letters > max(1, int(0.4 * len(answer))):
            warn("W_CHIP_TOTAL", where, f"{additive_chip_letters} of {len(answer)} letters come from additive chips; D14 allows one letter or 40%, whichever is more")
        atoms = n_images + n_chips
        atoms_total += atoms
        if atoms > 6:
            warn("W_BOX_BUSY", where, f"{atoms} atoms; C2 allows 6")
        if n_chips > 2:
            warn("W_TOO_MANY_CHIPS", where, f"{n_chips} chips; C2 allows 2")
        if n_images == 1 and n_chips == 0 and len(clues) == 1:
            whole_word_boxes += 1
        # minuend must be an image (C3)
        for j, c in enumerate(clues):
            if c.get("type") == "operator" and str(c.get("content", "")).endswith("("):
                nxt = clues[j + 1] if j + 1 < len(clues) else None
                if not nxt or nxt.get("type") != "image":
                    if nxt and nxt.get("type") == "text" and nxt.get("word"):
                        warn("W_MINUEND_CHIP", f"{where}.clues[{j+1}]", "punctuation chip as minuend; allowed once per puzzle (D6)")
                    else:
                        err("E_MINUEND_NOT_IMAGE", f"{where}.clues[{j+1}]", "the left side of a subtraction must be an image (C3)")
        # parentheses balance over the concatenated operators
        ops = "".join(c.get("content", "") for c in clues if c.get("type") == "operator")
        depth = 0
        for ch in ops:
            depth += (ch == "(") - (ch == ")")
            if depth < 0:
                break
        if depth != 0:
            err("E_PARENS", where, f"unbalanced parentheses in operators {ops!r}")

        # derivation + arithmetic
        deriv = w.get("derivations") or w.get("derivation")
        record = {"answer": answer, "derivation": deriv, "notation": archive_notation(clues), "computed": None,
                  "pieces": 0, "phoneticSteps": 0, "steps": []}
        if not deriv:
            err("E_DERIVATION_MISSING", where, "words[i].derivations is required (see draft-schema.md)")
        else:
            try:
                terms = parse_derivation(deriv)
                record["pieces"] = len(terms)
                if len(terms) > (4 if len(answer) >= 9 else 3):
                    warn("W_TOO_MANY_PIECES", where, f"{len(terms)} pieces; C grammar allows 3 (4 for 9+ letter answers)")
                numeric = answer.isdigit()
                computed = ""
                ok = True
                for term in terms:
                    ev = evaluate_term(term, numeric=numeric)
                    record["steps"].extend(ev["steps"] or [f"{term['tokens'][0]} (whole)"])
                    if ev["error"]:
                        err("E_ARITHMETIC", where, ev["error"])
                        ok = False
                        break
                    if ev["mode"] == "phonetic":
                        record["phoneticSteps"] += 1
                        if not term["group"]:
                            respell_total += 1
                    computed += ev["result"]
                if ok:
                    record["computed"] = computed
                    if computed != answer:
                        err("E_ARITHMETIC", where, f"derivation yields {computed!r} but answer is {answer!r}")
                phonetic_total += record["phoneticSteps"]
                if record["phoneticSteps"] >= 3:
                    err("E_PHONETIC_LIMIT", where, "3 sound steps in one box is forbidden (B3)")
                elif record["phoneticSteps"] == 2:
                    warn("W_PHONETIC_HEAVY", where, "2 sound steps in one box; justify in the QA table (B3)")
                canon_c, problems = canonical_clues(clues)
                canon_d = canonical_derivation(deriv)
                if not problems and canon_c != canon_d:
                    err("E_DERIVATION_MISMATCH", where, f"clues read {canon_c!r} but derivation reads {canon_d!r}")
                # band (B1)
                sound = record["phoneticSteps"] > 0
                n_pieces = len(terms)
                if n_pieces == 1 and not sound:
                    band = "Easy"
                elif record["phoneticSteps"] >= 2 or n_pieces >= 4 or (n_pieces == 3 and sound):
                    band = "Hard"
                else:
                    band = "Medium"
                record["band"] = band
                bands.append(band)
            except DerivationError as e:
                err("E_DERIVATION_SYNTAX", where, str(e))
        arithmetic.append(record)

    if recently_reused:
        warn("W_IMAGE_REUSED_RECENTLY", "words", f"used in one of the last 5 puzzles (B6): {', '.join(recently_reused)}")
    if legacy_not_square:
        warn("W_IMAGE_NOT_SQUARE", "words", f"legacy files that are not square; fine if the subject is legible at the size shown (F5): {', '.join(legacy_not_square)}")

    # ---- puzzle-level balance and caps
    if bands:
        if "Easy" not in bands:
            warn("W_NO_EASY_BOX", "words", "no Easy box (B2)")
        if bands.count("Hard") > 2:
            warn("W_TOO_MANY_HARD", "words", f"{bands.count('Hard')} Hard boxes; B2 allows 2")
        if any(bands[k] == "Hard" and bands[k + 1] == "Hard" for k in range(len(bands) - 1)):
            warn("W_ADJACENT_HARD", "words", "two Hard boxes are adjacent (B2)")
    if phonetic_total > 3:
        warn("W_PHONETIC_TOTAL", "words", f"{phonetic_total} sound steps in the puzzle; B3 allows 3")
    if respell_total > 1:
        warn("W_RESPELL_TOTAL", "words", f"{respell_total} respells; B3 allows 1")
    if whole_word_boxes > 2:
        warn("W_WHOLE_WORD_BOXES", "words", f"{whole_word_boxes} single-image boxes; B4 allows 2")
    device_counts = {dev: len(boxes) for dev, boxes in device_boxes.items()}
    for dev, cap in DEVICE_CAPS.items():
        if device_counts.get(dev, 0) > cap:
            warn("W_DEVICE_CAP", "words", f"{device_counts[dev]} boxes use a '{dev}' device; B4 allows {cap} (tiles inside one box count once)")
    if tiles_total > 14:
        warn("W_TOO_MANY_TILES", "words", f"{tiles_total} image tiles; B5 allows 14")
    if atoms_total > 20:
        warn("W_TOO_MANY_ATOMS", "words", f"{atoms_total} atoms; B5 allows 20")
    if len(new_images) > 10:
        warn("W_TOO_MANY_NEW_IMAGES", "words", f"{len(new_images)} new files; B5 allows 10")

    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "arithmetic": arithmetic,
        "meta": {
            "bands": bands,
            "phoneticSteps": phonetic_total,
            "respells": respell_total,
            "tiles": tiles_total,
            "atoms": atoms_total,
            "newImages": new_images,
            "reusedImages": reused_images,
            "devices": device_counts,
            "designOnly": design_only,
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--draft", type=Path, required=True)
    ap.add_argument("--design-only", action="store_true", help="skip image existence/squareness/provenance checks")
    ap.add_argument("--today", help="YYYY-MM-DD (default: today)")
    ap.add_argument("--puzzles-ts", type=Path)
    ap.add_argument("--public-dir", type=Path)
    ap.add_argument("--credits", type=Path)
    args = ap.parse_args()
    try:
        draft = common.read_json(args.draft)
    except Exception as e:
        common.fail(f"cannot read draft: {e}", 2)
    today = common.iso_to_date(args.today) if args.today else None
    result = validate(draft, design_only=args.design_only, today=today, puzzles_ts=args.puzzles_ts,
                      public_dir=args.public_dir, credits_path=args.credits)
    common.emit(result, 0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
