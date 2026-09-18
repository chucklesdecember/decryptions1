#!/usr/bin/env python3
"""Offline regression tests for the rebus-autogen scripts. Run after editing any script.

Uses only fixtures, a temp directory, and read-only access to the repo (puzzles.ts, public/).
Never writes into the repo.
"""
from __future__ import annotations

import copy
import datetime as dt
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
FIX = SKILL / "tests" / "fixtures"
sys.path.insert(0, str(HERE))
import common  # noqa: E402
import validate_puzzle as V  # noqa: E402
import insert_puzzle as I  # noqa: E402

TODAY = dt.date(2026, 9, 30)
results: list[tuple[str, bool, str]] = []


def check(name: str, cond, detail: str = "") -> None:
    results.append((name, bool(cond), "" if cond else str(detail)[:300]))


def run(script: str, *args) -> tuple[int, dict]:
    r = subprocess.run([sys.executable, str(HERE / script), *map(str, args)], capture_output=True, text=True)
    try:
        return r.returncode, json.loads(r.stdout)
    except json.JSONDecodeError:
        return r.returncode, {"_stdout": r.stdout[-500:], "_stderr": r.stderr[-800:]}


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="rebus-selftest-") as tmp:
        work = Path(tmp)

        # 1. news parser on the saved feed
        rc, out = run("news_topstories.py", "--rss-file", FIX / "rss-sample.xml", "--limit", "5", "--work", work)
        check("news: exit 0", rc == 0, out)
        clusters = out.get("clusters", [])
        check("news: returns 5 clusters", len(clusters) == 5, len(clusters))
        check("news: first cluster has 3+ outlet headlines", clusters and len(clusters[0]["related"]) >= 3)
        check("news: keywords and proper nouns extracted", clusters and clusters[0]["keywords"] and clusters[0]["properNouns"])
        check("news: title has no trailing outlet", clusters and clusters[0]["outlet"] and not clusters[0]["title"].endswith(clusters[0]["outlet"]))
        r = subprocess.run([sys.executable, str(HERE / "news_topstories.py"), "--rss-file", str(FIX / "rss-sample.xml"), "--limit", "2", "--table", "--work", str(work)], capture_output=True, text=True)
        check("news: --table prints a markdown table and writes news.json", r.returncode == 0 and r.stdout.startswith("| rank |") and (work / "news.json").exists(), r.stdout[:80])

        # 2. validator on the good draft (design-only and with real images)
        good = common.read_json(FIX / "draft-good.json")
        r = V.validate(good, design_only=True, today=TODAY)
        check("validate: good draft has no errors (design-only)", r["ok"], r["errors"])
        check("validate: bands match the calibrated house style", r["meta"]["bands"] == ["Medium", "Hard", "Medium", "Easy", "Easy"], r["meta"]["bands"])
        check("validate: two sound steps counted", r["meta"]["phoneticSteps"] == 2, r["meta"]["phoneticSteps"])
        r_full = V.validate(good, today=TODAY)
        check("validate: good draft passes with real public/ images", r_full["ok"], r_full["errors"])
        check("validate: legacy non-square files are warnings, not errors", any(w["code"] == "W_IMAGE_NOT_SQUARE" for w in r_full["warnings"]))
        check("validate: logos flagged for the user", sum(1 for w in r_full["warnings"] if w["code"] == "W_LOGO_FLAGGED") == 2)

        # 3. mutations must produce the expected error code
        def mut(label, fn, code):
            d = copy.deepcopy(good)
            fn(d)
            res = V.validate(d, design_only=True, today=TODAY)
            check(f"validate: {label} -> {code}", any(e["code"] == code for e in res["errors"]), [e["code"] for e in res["errors"]])

        mut("bad date format", lambda d: d.__setitem__("date", "Sep 30, 2026"), "E_DATE_FORMAT")
        mut("id/date mismatch", lambda d: d.__setitem__("id", "2026-09-29-us-reduces-troops-in-germany"), "E_ID_DATE_MISMATCH")
        mut("hints parity", lambda d: d["hints"].pop(), "E_HINTS_PARITY")
        mut("wrong arithmetic", lambda d: d["words"][2].__setitem__("derivations", "(TROUT - OUT) + (ZOO - Z) + (UPS - S)"), "E_ARITHMETIC")
        mut("middle removal without ~", lambda d: d["words"][1].__setitem__("derivations", "(TREE - TEA) + (DUCK - K) + ES"), "E_ARITHMETIC")
        mut("derivation/clue mismatch", lambda d: d["words"][3].__setitem__("derivations", "(CABIN - CAB) + N"), "E_DERIVATION_MISMATCH")
        mut("bad operator token", lambda d: d["words"][3]["clues"][2].__setitem__("content", "-"), "E_OP_TOKEN")
        mut("7-word headline", lambda d: d.__setitem__("headline", "US Reduces Troops in Germany Right Now"), "E_HEADLINE_WORDS")
        mut("headline/answers drift", lambda d: d.__setitem__("headline", "US Reduces Troops in France"), "E_HEADLINE_ANSWERS_MISMATCH")
        mut("three sound steps in one box", lambda d: d["words"][1].__setitem__("derivations", "(TREE - TEA) ~RE + (DUCK - K) ~DUC + (EEL - L) ~ES"), "E_PHONETIC_LIMIT")
        mut("duplicate id", lambda d: (d.__setitem__("id", "2026-05-03-us-reduces-troops-in-germany"), d.__setitem__("date", "May 3, 2026")), "E_ID_DUPLICATE")
        mut("image without word", lambda d: d["words"][4]["clues"][0].pop("word"), "E_IMAGE_WORD_MISSING")
        mut("hint leaks answer", lambda d: d["hints"].__setitem__(4, "Germany, obviously"), "E_HINT_LEAKS_ANSWER")
        mut("chip-only box", lambda d: d["words"][3].__setitem__("clues", [{"type": "text", "content": "IN"}]), "E_NO_IMAGE")
        mut("symbol clue type", lambda d: d["words"][4]["clues"].append({"type": "symbol", "content": "+"}), "E_CLUE_TYPE")
        mut("one-letter answer", lambda d: (d.__setitem__("headline", "US Reduces Troops in G"), d.__setitem__("id", "2026-09-30-us-reduces-troops-in-g"), d["words"][4].__setitem__("answer", "G")), "E_ANSWER_LENGTH")

        # 4. arithmetic engine on known derivations (incl. the May 1 puzzle)
        cases = [
            ("(TROUT - OUT) + (ZOO - Z) + (UPS - U)", False, "TROOPS"),
            ("(CABIN - CAB)", False, "IN"),
            ("(YOUTUBE - TUBE) ~U + S", False, "US"),
            ("(SMILE - AISLE) ~SM + O + KING", False, "SMOKING"),
            ("(MITT - TT) + (TOLL - TOW) ~LL + S", False, "MILLS"),
            ("(KEN - K) + D + S", False, "ENDS"),
            ("(BIBLE - BULL) ~BI + D", False, "BID"),
            ("(SKI - KEY) ~S + (GARDEN - GUARD) ~EN + (KARATE - CAR) ~ATE", False, "SENATE"),
            ("(XV - VII)", True, "8"),
            ("III", True, "3"),
            ("EIGHT ~ATE", False, "ATE"),
        ]
        for deriv, numeric, expected in cases:
            try:
                terms = V.parse_derivation(deriv)
                evs = [V.evaluate_term(t, numeric=numeric) for t in terms]
                got = "".join(e["result"] or "?" for e in evs)
                check(f"arith: {deriv} = {expected}", got == expected, got)
            except V.DerivationError as e:
                check(f"arith: {deriv} = {expected}", False, str(e))
        terms = V.parse_derivation("(SKI - KEY) ~S + (GARDEN - GUARD) ~EN + (KARATE - CAR) ~ATE")
        check("arith: SENATE counts 3 sound steps", sum(1 for t in terms if t["phonetic"]) == 3)
        try:
            V.parse_derivation("(TROUT OUT) + ZOO")
            check("arith: syntax error detected", False)
        except V.DerivationError:
            check("arith: syntax error detected", True)

        # 5. fetch_image on a generated wide image (file://), then overwrite refusal
        try:
            from PIL import Image, ImageDraw
            src = work / "wide.jpg"
            im = Image.new("RGB", (900, 300), "white")
            ImageDraw.Draw(im).ellipse([350, 60, 550, 260], fill=(200, 30, 30))
            im.save(src, quality=90)
            pub, cred = work / "public", work / "credits.json"
            rc, out = run("fetch_image.py", "--url", src.as_uri(), "--source", "test", "--license", "test-license",
                          "--name", "widget", "--word", "WIDGET", "--trim", "--puzzle-id", "2026-09-30-test",
                          "--work", work, "--public-dir", pub, "--credits", cred)
            check("fetch: exit 0", rc == 0, out)
            check("fetch: output is 512x512", out.get("width") == 512 and out.get("height") == 512, (out.get("width"), out.get("height")))
            check("fetch: white background for an opaque source", out.get("background") == "white", out.get("background"))
            rows = common.read_json(cred) if cred.exists() else []
            check("fetch: provenance row written", rows and rows[0]["file"] == "widget.png" and rows[0]["license"] == "test-license", rows)
            with Image.open(pub / "widget.png") as im2:
                check("fetch: saved file really is square", im2.size == (512, 512), im2.size)
            rc2, out2 = run("fetch_image.py", "--url", src.as_uri(), "--name", "widget", "--work", work, "--public-dir", pub, "--credits", cred)
            check("fetch: refuses to overwrite an existing file", rc2 == 1 and out2.get("suggestedName") == "widget-2", out2)
        except ImportError:
            check("fetch: Pillow available", False, "Pillow missing")

        # 5b. checkerboard refusal, whitening, --forget, render_glyph, preview_boxes, digit answers
        try:
            from PIL import Image, ImageDraw
            chk = work / "checker.jpg"
            im = Image.new("RGB", (400, 400), "white")
            dr = ImageDraw.Draw(im)
            for y in range(0, 400, 20):
                for x in range(0, 400, 20):
                    if (x // 20 + y // 20) % 2:
                        dr.rectangle([x, y, x + 19, y + 19], fill=(204, 204, 204))
            dr.ellipse([120, 120, 280, 280], fill=(30, 60, 200))
            im.save(chk, quality=92)
            rc, out = run("fetch_image.py", "--url", chk.as_uri(), "--name", "checker", "--license", "t", "--work", work, "--public-dir", pub, "--credits", cred)
            check("fetch: refuses a baked-in checkerboard source", rc == 1 and "checkerboard" in out.get("error", ""), out)
            off = work / "offwhite.png"
            im2 = Image.new("RGB", (400, 300), (246, 246, 246))
            ImageDraw.Draw(im2).rectangle([100, 80, 300, 220], fill=(20, 120, 40))
            im2.save(off)
            rc, out = run("fetch_image.py", "--url", off.as_uri(), "--name", "offwhite", "--license", "t", "--trim", "--work", work, "--public-dir", pub, "--credits", cred)
            with Image.open(pub / "offwhite.png") as im3:
                corner = im3.convert("RGB").getpixel((4, 4))
            check("fetch: off-white mat whitened to pure white", rc == 0 and corner == (255, 255, 255), (rc, corner))
            rc, out = run("fetch_image.py", "--forget", "--name", "offwhite", "--work", work, "--public-dir", pub, "--credits", cred)
            rows = common.read_json(cred)
            check("fetch: --forget removes the file and its provenance row", rc == 0 and not (pub / "offwhite.png").exists() and all(r["file"] != "offwhite.png" for r in rows), out)
            rc, out = run("fetch_image.py", "--forget", "--name", "duck", "--work", work, "--public-dir", common.app_paths()["public"], "--credits", cred)
            check("fetch: --forget refuses a file referenced by puzzles.ts", rc == 1 and (common.app_paths()["public"] / "duck.png").exists(), out)
            rc, out = run("render_glyph.py", "--text", "V", "--name", "roman-v", "--word", "V", "--work", work, "--public-dir", pub, "--credits", cred)
            with Image.open(pub / "roman-v.png") as g:
                dark = sum(1 for px in g.convert("L").tobytes() if px < 100)
            check("glyph: renders a 512px glyph with CC0 provenance", rc == 0 and g.size == (512, 512) and dark > 2000 and out["record"]["license"].startswith("Aileron"), (rc, g.size, dark))
            rc, out = run("render_glyph.py", "--text", "Cu", "--style", "cell", "--cell-number", "29", "--cell-label", "Copper", "--name", "copper-cu", "--word", "CU", "--work", work, "--public-dir", pub, "--credits", cred)
            check("glyph: renders a periodic-table cell", rc == 0 and (pub / "copper-cu.png").exists(), out)
            rc, out = run("preview_boxes.py", "--draft", FIX / "draft-good.json", "--out", work / "preview.png", "--columns", "1")
            check("preview: renders the fixture with every image found", rc == 0 and out.get("missingImages") == [] and out["rowsPerCard"]["REDUCES"] >= 1, out)
        except ImportError:
            check("fetch/glyph/preview: Pillow available", False, "Pillow missing")

        digit = copy.deepcopy(good)
        digit["headline"] = "US Reduces 3 in Germany"
        digit["id"] = "2026-09-30-us-reduces-3-in-germany"
        digit["words"][2] = {"answer": "3", "derivations": "(X - VII)", "clues": [
            {"type": "operator", "content": "("},
            {"type": "image", "content": "/roman-ten.png", "alt": "Roman numeral X", "word": "X", "device": "roman"},
            {"type": "operator", "content": " - "},
            {"type": "image", "content": "/vii.png", "alt": "Roman numeral VII", "word": "VII", "device": "roman"},
            {"type": "operator", "content": ")"}]}
        digit["hints"][2] = "Ten minus seven, in Roman numerals"
        rd = V.validate(digit, design_only=True, today=TODAY)
        check("validate: digit answer '3' with numeral arithmetic passes", rd["ok"] and rd["arithmetic"][2]["computed"] == "3", rd["errors"])
        check("validate: two numeral tiles in one box count as one device", not any(w["code"] == "W_DEVICE_CAP" for w in rd["warnings"]), [w["code"] for w in rd["warnings"]])
        heavy = copy.deepcopy(good)
        heavy["words"][1]["derivations"] = "(TREE - TEA) ~RE + (DUCK - K) + ES"
        rh = V.validate(heavy, design_only=True, today=TODAY)
        check("validate: a 2-letter chip on a 7-letter answer is not 'heavy'", not any(w["code"] == "W_CHIP_HEAVY" for w in rh["warnings"]))

        # 5c. D14 chip rules, archive notation, positional glyph, spreadsheet row
        giveaway = copy.deepcopy(good)
        giveaway["words"][1]["derivations"] = "RE + (DUCK - K) + ES"
        giveaway["words"][1]["clues"] = [
            {"type": "text", "content": "re"}, {"type": "operator", "content": " + ("},
            {"type": "image", "content": "/duck.png", "alt": "Duck", "word": "DUCK"}, {"type": "operator", "content": " - "},
            {"type": "image", "content": "/k-cursive.png", "alt": "Cursive letter K", "word": "K"},
            {"type": "operator", "content": ") + "}, {"type": "text", "content": "es"}]
        rg = V.validate(giveaway, design_only=True, today=TODAY)
        check("validate: additive chip spelling the start of the answer -> E_CHIP_GIVES_START", any(e["code"] == "E_CHIP_GIVES_START" for e in rg["errors"]), [e["code"] for e in rg["errors"]])
        check("validate: chips carrying >40% of the letters -> W_CHIP_TOTAL", any(w["code"] == "W_CHIP_TOTAL" for w in rg["warnings"]), [w["code"] for w in rg["warnings"]])
        sub = copy.deepcopy(good)  # subtrahend chips of 3 letters are fine
        sub["words"][3]["derivations"] = "(CABIN - CAB)"
        sub["words"][3]["clues"] = [{"type": "operator", "content": "("}, {"type": "image", "content": "/cabin.png", "alt": "Log cabin", "word": "CABIN"},
                                    {"type": "operator", "content": " - "}, {"type": "text", "content": "cab"}, {"type": "operator", "content": ")"}]
        rs = V.validate(sub, design_only=True, today=TODAY)
        check("validate: a 3-letter subtrahend chip raises no chip warning", rs["ok"] and not any(w["code"].startswith("W_CHIP") for w in rs["warnings"]), [w["code"] for w in rs["warnings"]])
        check("validate: archive notation emitted", r["arithmetic"][2]["notation"].startswith("(trout [Trout] - out [Umpire calling out]) + (zoo [Zoo entrance] - Z [letters])"), r["arithmetic"][2]["notation"])
        try:
            rc, out = run("render_glyph.py", "--text", "shut", "--style", "positional", "--position", "bottom", "--frame", "--name", "shut-down", "--word", "SHUTDOWN", "--work", work, "--public-dir", pub, "--credits", cred)
            from PIL import Image
            with Image.open(pub / "shut-down.png") as g:
                gl = g.convert("L")
                top_dark = sum(1 for px in gl.crop((60, 60, 452, 200)).tobytes() if px < 100)
                bottom_dark = sum(1 for px in gl.crop((60, 312, 452, 452)).tobytes() if px < 100)
            check("glyph: positional rebus puts the word at the bottom of the frame", rc == 0 and bottom_dark > top_dark * 3, (rc, top_dark, bottom_dark))
        except ImportError:
            pass

        sil = copy.deepcopy(good)
        for k in (0, 4):
            sil["words"][k]["clues"][1 if k == 0 else 0]["device"] = "silhouette"
        rsil = V.validate(sil, design_only=True, today=TODAY)
        check("validate: silhouettes are flagged and capped at one per puzzle",
              any(w["code"] == "W_SILHOUETTE" for w in rsil["warnings"]) and any(w["code"] == "W_DEVICE_CAP" and "silhouette" in w["msg"] for w in rsil["warnings"]),
              [w["code"] for w in rsil["warnings"]])

        # 6. serialisation + insert dry run with Node smoke test
        block = I.serialize_puzzle(good)
        check("insert: single-image box serialised inline", 'clues: [{ type: "image", content: "/germany-outline.png", alt: "Germany" }],' in block)
        check("insert: skill-only fields stripped", "word:" not in block and "derivations:" not in block and "device:" not in block and "meta:" not in block)
        rc, out = run("insert_puzzle.py", "--draft", FIX / "draft-good.json", "--work", work, "--dry-run", "--today", "2026-09-30")
        check("insert: dry run exit 0", rc == 0, out)
        check("insert: Node smoke test passed on the spliced copy", out.get("smoke", {}).get("status") == "passed", out.get("smoke"))
        check("insert: dry run did not touch puzzles.ts", "dry-run" in str(out.get("file", "")))
        row = out.get("spreadsheetRow", "")
        check("insert: spreadsheet row has Date, Solution and 5 word/breakdown pairs", row.count("\t") == 11 and row.startswith("9/30/2026\tUS Reduces Troops in Germany\tUS\t("), row[:80])
        real = common.app_paths()["puzzles_ts"].read_text(encoding="utf-8")
        check("insert: real puzzles.ts still lacks the fixture id", good["id"] not in real)

    failed = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -> {detail}"))
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
