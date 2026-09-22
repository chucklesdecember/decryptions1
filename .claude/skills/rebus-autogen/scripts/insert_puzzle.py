#!/usr/bin/env python3
"""Validate a draft, then prepend it to src/data/puzzles.ts in house style.

Steps: validate (refuse on errors) -> serialise -> splice after `export const puzzles: Puzzle[] = [`
-> Node import smoke test (puzzles[0].id, length+1, getCurrentPuzzle(date)) -> optional tsc
-> archive the draft to history/<id>.json -> print git paths and a suggested commit message.
Never runs git.

Usage:
  python3 insert_puzzle.py --draft draft.json --work DIR [--dry-run] [--no-typecheck] [--puzzles-ts PATH]
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
import validate_puzzle  # noqa: E402

ANCHOR = re.compile(r"^export const puzzles: Puzzle\[\] = \[\n", re.M)


def js_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def serialize_clue(c: dict) -> str:
    parts = [f"type: {js_str(c['type'])}", f"content: {js_str(c['content'])}"]
    if c["type"] == "image" and c.get("alt"):
        parts.append(f"alt: {js_str(c['alt'])}")
    return "{ " + ", ".join(parts) + " }"


def serialize_puzzle(draft: dict) -> str:
    out = ["  {",
           f"    id: {js_str(draft['id'])},",
           f"    headline: {js_str(draft['headline'])},",
           f"    date: {js_str(draft['date'])},",
           f"    category: {js_str(draft['category'])},",
           "    words: ["]
    for w in draft["words"]:
        out.append("      {")
        out.append(f"        answer: {js_str(w['answer'])},")
        clues = w["clues"]
        if len(clues) == 1:
            out.append(f"        clues: [{serialize_clue(clues[0])}],")
        else:
            out.append("        clues: [")
            for c in clues:
                out.append(f"          {serialize_clue(c)},")
            out.append("        ],")
        out.append("      },")
    out.append("    ],")
    out.append("    hints: [")
    for h in draft["hints"]:
        out.append(f"      {js_str(h)},")
    out.append("    ],")
    if draft.get("articleUrl"):
        out.append("    articleUrl:")
        out.append(f"      {js_str(draft['articleUrl'])},")
    out.append("  },")
    return "\n".join(out) + "\n"


def spreadsheet_row(draft: dict, validation: dict) -> str:
    """One tab-separated row in the layout of the author's `Decryptions Database.xlsx`:
    Date | Puzzle Solution | Word 1 | Word 1 Breakdown | Word 2 | ... using the archive notation."""
    d = common.parse_puzzle_date(draft["date"])
    cells = [f"{d.month}/{d.day}/{d.year}" if d else draft["date"], draft["headline"]]
    notations = {a["answer"]: a.get("notation", "") for a in validation.get("arithmetic", [])}
    for w in draft["words"]:
        ans = w["answer"]
        cells.append(ans if (ans.isdigit() or len(ans) <= 3) else ans.capitalize())
        cells.append(notations.get(ans, ""))
    return "\t".join(c.replace("\t", " ") for c in cells)


def node_smoke_test(puzzles_ts: Path, work: Path, expected_id: str, expected_count: int, date_iso: str) -> dict:
    check = work / "puzzles-check.mts"
    shutil.copyfile(puzzles_ts, check)
    script = f"""
import {{ puzzles, getCurrentPuzzle }} from {json.dumps(check.resolve().as_uri())};
const problems = [];
if (puzzles[0].id !== {json.dumps(expected_id)}) problems.push('puzzles[0].id is ' + puzzles[0].id);
if (puzzles.length !== {expected_count}) problems.push('length is ' + puzzles.length + ', expected {expected_count}');
const cur = getCurrentPuzzle(new Date({json.dumps(date_iso)} + 'T12:00:00'));
if (cur.id !== {json.dumps(expected_id)}) problems.push('getCurrentPuzzle(date) returned ' + cur.id);
const ids = new Set(puzzles.map(p => p.id));
if (ids.size !== puzzles.length) problems.push('duplicate ids');
console.log(JSON.stringify({{ ok: problems.length === 0, problems, count: puzzles.length }}));
"""
    try:
        r = subprocess.run(["node", "--no-warnings", "--input-type=module", "-e", script],
                           capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        return {"status": "skipped", "reason": "node not installed"}
    except subprocess.TimeoutExpired:
        return {"status": "failed", "reason": "node timed out"}
    if r.returncode != 0:
        return {"status": "failed", "reason": (r.stderr or r.stdout).strip()[-800:]}
    try:
        res = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        return {"status": "failed", "reason": "unparseable node output: " + r.stdout[-400:]}
    return {"status": "passed" if res.get("ok") else "failed", "reason": "; ".join(res.get("problems", [])), "count": res.get("count")}


def typecheck(app_dir: Path) -> dict:
    tsc = app_dir / "node_modules" / ".bin" / "tsc"
    if not tsc.exists():
        return {"status": "skipped", "reason": "node_modules not installed (run `npm install` at the repo root)"}
    r = subprocess.run(["npm", "run", "typecheck", "--silent"], cwd=app_dir, capture_output=True, text=True, timeout=300)
    return {"status": "passed" if r.returncode == 0 else "failed", "reason": (r.stdout + r.stderr).strip()[-1500:]}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--draft", type=Path, required=True)
    ap.add_argument("--work", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true", help="validate, serialise, and smoke-test a copy; do not touch puzzles.ts")
    ap.add_argument("--no-typecheck", action="store_true")
    ap.add_argument("--puzzles-ts", type=Path, help="override target file (tests)")
    ap.add_argument("--public-dir", type=Path)
    ap.add_argument("--credits", type=Path)
    ap.add_argument("--today", help="YYYY-MM-DD for date warnings")
    args = ap.parse_args()

    warnings: list[str] = []
    draft = common.read_json(args.draft)
    try:
        paths = common.app_paths()
    except FileNotFoundError:
        paths = {}
    puzzles_ts = Path(args.puzzles_ts or paths["puzzles_ts"])
    today = common.iso_to_date(args.today) if args.today else None
    result = validate_puzzle.validate(draft, today=today, puzzles_ts=puzzles_ts, public_dir=args.public_dir,
                                      credits_path=args.credits)
    if not result["ok"]:
        common.emit({"ok": False, "inserted": False, "error": "draft has validation errors", "validation": result, "warnings": []}, 1)
    warnings += [f"{w['code']}: {w['msg']}" for w in result["warnings"]]

    original = puzzles_ts.read_text(encoding="utf-8")
    if len(ANCHOR.findall(original)) != 1:
        common.fail("anchor line `export const puzzles: Puzzle[] = [` not found exactly once in puzzles.ts", 2)
    block = serialize_puzzle(draft)
    updated = ANCHOR.sub(lambda m: m.group(0) + block, original, count=1)
    old_count = len(validate_puzzle.scan_puzzles_ts(puzzles_ts))
    date_iso = common.parse_puzzle_date(draft["date"]).isoformat()

    args.work.mkdir(parents=True, exist_ok=True)
    row = spreadsheet_row(draft, result)
    (args.work / "spreadsheet-row.tsv").write_text(row + "\n", encoding="utf-8")
    if args.dry_run:
        candidate = args.work / "puzzles.dry-run.ts"
        candidate.write_text(updated, encoding="utf-8")
        smoke = node_smoke_test(candidate, args.work, draft["id"], old_count + 1, date_iso)
        common.emit({"ok": smoke["status"] != "failed", "inserted": False, "dryRun": True, "file": str(candidate),
                     "block": block, "smoke": smoke, "typecheck": {"status": "skipped", "reason": "dry run"},
                     "spreadsheetRow": row, "warnings": warnings}, 0 if smoke["status"] != "failed" else 1)

    backup = args.work / "puzzles.ts.bak"
    shutil.copyfile(puzzles_ts, backup)
    tmp = puzzles_ts.with_suffix(".ts.tmp")
    tmp.write_text(updated, encoding="utf-8")
    tmp.replace(puzzles_ts)

    smoke = node_smoke_test(puzzles_ts, args.work, draft["id"], old_count + 1, date_iso)
    tc = {"status": "skipped", "reason": "--no-typecheck"} if args.no_typecheck else typecheck(paths["app"] if paths else puzzles_ts.parents[2])
    if smoke["status"] == "failed" or tc["status"] == "failed":
        shutil.copyfile(backup, puzzles_ts)
        common.emit({"ok": False, "inserted": False, "restored": True, "smoke": smoke, "typecheck": tc, "warnings": warnings}, 1)

    history_file = common.HISTORY_DIR / f"{draft['id']}.json"
    common.write_json(history_file, draft)
    root = paths.get("root")
    rel = (lambda p: str(Path(p).resolve().relative_to(root)) if root else str(p))
    git_paths = [rel(puzzles_ts), rel(history_file)]
    if paths.get("credits") and paths["credits"].exists():
        git_paths.append(rel(paths["credits"]))
    for f in result["meta"].get("newImages", []):
        git_paths.append(rel(paths["public"] / f))
    d = common.parse_puzzle_date(draft["date"])
    common.emit({"ok": True, "inserted": True, "dryRun": False, "puzzlesCount": old_count + 1, "smoke": smoke,
                 "typecheck": tc, "historyFile": str(history_file), "backup": str(backup), "gitAddPaths": git_paths,
                 "suggestedCommit": f"new puzzle {d.month}/{d.day}/{d.year % 100}", "spreadsheetRow": row,
                 "spreadsheetRowFile": str(args.work / "spreadsheet-row.tsv"), "warnings": warnings})


if __name__ == "__main__":
    main()
