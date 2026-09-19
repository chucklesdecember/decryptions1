#!/usr/bin/env python3
"""Download one clue image, make it a clean 512x512 square, save it to public/, record provenance.

Why squaring: PuzzleBox.tsx renders every image in a fixed 48x48 tile with object-contain, so a
wide or tall file shrinks to a sliver. Padding here means PuzzleBox.tsx never needs a new
per-filename size exception.

Usage:
  python3 fetch_image.py --from-candidates <work>/candidates/duck/results.json --pick 3 --name duck --work DIR
  python3 fetch_image.py --url URL --source openverse --author A --page-url P --license L --name duck --work DIR
Options: --word DUCK (default: NAME upper) --size 512 --bg auto|white|transparent --margin 0.06
         --trim --puzzle-id ID --force --public-dir PATH --credits PATH

Refuses to overwrite an existing file (a past commit silently replaced cab.png and changed an
older puzzle); use a new name such as duck-2 or pass --force deliberately.
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402


def looks_like_checkerboard(im) -> bool:
    """True when the border of an opaque image is the grey/white checkerboard some sites bake into
    'transparent background' downloads (rawpixel stickers served as JPG)."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    if w < 64 or h < 64:
        return False
    patch = max(24, min(w, h) // 8)
    corners = [(0, 0), (w - patch, 0), (0, h - patch), (w - patch, h - patch)]
    hits = 0
    for x0, y0 in corners:
        data = rgb.crop((x0, y0, x0 + patch, y0 + patch)).tobytes()
        light = grey = 0
        for r, g, b in zip(data[0::3], data[1::3], data[2::3]):
            if max(r, g, b) - min(r, g, b) > 10:
                continue
            if r >= 232:
                light += 1
            elif 165 <= r <= 228:
                grey += 1
        n = patch * patch
        if light >= 0.22 * n and grey >= 0.22 * n:
            hits += 1
    return hits >= 3


def whiten(im, threshold: int = 236):
    """Map near-white pixels (off-white source mats, ~245 grey) to pure white so the tile mat stays clean."""
    r, g, b, a = im.split()
    mask = Image_eval_min(r, g, b, threshold)
    white = Image.new("RGBA", im.size, (255, 255, 255, 255))
    return Image.composite(white, im, mask)


def Image_eval_min(r, g, b, threshold):
    from PIL import ImageChops
    m = ImageChops.darker(ImageChops.darker(r, g), b)
    return m.point(lambda v: 255 if v >= threshold else 0)


def process_with_pillow(raw: bytes, size: int, bg: str, margin: float, trim: bool,
                        allow_checkerboard: bool = False, do_whiten: bool = True) -> tuple[bytes, dict]:
    global Image
    from PIL import Image, ImageOps
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im)
    orig_w, orig_h = im.size
    im = im.convert("RGBA")
    has_alpha = im.getextrema()[3][0] < 255
    if not has_alpha and not allow_checkerboard and looks_like_checkerboard(im):
        raise ValueError("source has a baked-in transparency checkerboard (fails F5); pick another candidate or pass --allow-checkerboard")
    if not has_alpha and do_whiten:
        im = whiten(im)
    if trim:
        # content = not transparent and not near-white
        px = im.load()
        w, h = im.size
        mask = Image.new("L", (w, h), 0)
        mpx = mask.load()
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a > 16 and not (r > 242 and g > 242 and b > 242):
                    mpx[x, y] = 255
        bbox = mask.getbbox()
        if bbox and (bbox[2] - bbox[0]) > 8 and (bbox[3] - bbox[1]) > 8:
            pad = max(2, int(0.02 * max(w, h)))
            im = im.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad)))
    background = "transparent" if (bg == "transparent" or (bg == "auto" and has_alpha)) else "white"
    w, h = im.size
    side = int(round(max(w, h) * (1 + 2 * margin)))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0) if background == "transparent" else (255, 255, 255, 255))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    canvas = canvas.resize((size, size), Image.LANCZOS)
    if background == "white":
        canvas = canvas.convert("RGB")
    out = io.BytesIO()
    canvas.save(out, format="PNG", optimize=True)
    return out.getvalue(), {"originalWidth": orig_w, "originalHeight": orig_h, "background": background, "trimmed": bool(trim),
                            "whitened": bool(do_whiten and not has_alpha)}


def process_with_sips(src: Path, dst: Path, size: int) -> dict:
    subprocess.run(["sips", "-s", "format", "png", "--resampleHeightWidthMax", str(size),
                    "--padToHeightWidth", str(size), str(size), "--padColor", "FFFFFF", str(src), "--out", str(dst)],
                   check=True, capture_output=True)
    return {"background": "white", "trimmed": False, "tool": "sips"}


def forget(target: Path, credits_path: Path, paths: dict) -> None:
    """Remove a new, unreferenced, untracked image and its provenance row (a bad pick that never shipped)."""
    name = "/" + target.name
    puzzles_ts = paths.get("puzzles_ts")
    if puzzles_ts and Path(puzzles_ts).exists() and name in Path(puzzles_ts).read_text(encoding="utf-8"):
        common.fail(f"{target.name} is referenced in puzzles.ts; existing puzzle images are immutable (F3)", 1)
    root = paths.get("root")
    if root and target.exists():
        r = subprocess.run(["git", "ls-files", "--error-unmatch", str(target)], cwd=root, capture_output=True)
        if r.returncode == 0:
            common.fail(f"{target.name} is tracked by git; not deleting (F3)", 1)
    removed_file = False
    if target.exists():
        target.unlink()
        removed_file = True
    rows = common.read_json(credits_path) if credits_path.exists() else []
    kept = [r for r in rows if r.get("file") != target.name]
    if len(kept) != len(rows):
        common.write_json(credits_path, kept)
    common.emit({"ok": True, "forgot": target.name, "removedFile": removed_file, "removedCreditRows": len(rows) - len(kept)})


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from-candidates", type=Path, help="results.json written by find_images.py")
    ap.add_argument("--pick", type=int, help="candidate idx from the contact sheet")
    ap.add_argument("--url")
    ap.add_argument("--source", default="manual")
    ap.add_argument("--source-id", default="")
    ap.add_argument("--author", default="")
    ap.add_argument("--page-url", default="")
    ap.add_argument("--license", default="")
    ap.add_argument("--license-url", default="")
    ap.add_argument("--name", required=True, help="file stem, lowercase kebab, e.g. duck or bat-animal")
    ap.add_argument("--word", help="the word the picture stands for (default: NAME uppercased)")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--bg", choices=["auto", "white", "transparent"], default="auto")
    ap.add_argument("--margin", type=float, default=0.06)
    ap.add_argument("--trim", action="store_true", help="crop to the subject before padding")
    ap.add_argument("--puzzle-id", default="")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file (changes older puzzles that use it)")
    ap.add_argument("--allow-checkerboard", action="store_true", help="accept a source whose border looks like a baked-in transparency checkerboard")
    ap.add_argument("--no-whiten", action="store_true", help="keep off-white source mats instead of mapping them to pure white")
    ap.add_argument("--forget", action="store_true", help="delete public/<name>.png and its provenance row if no puzzle references it and git does not track it")
    ap.add_argument("--work", type=Path, required=True)
    ap.add_argument("--public-dir", type=Path)
    ap.add_argument("--credits", type=Path)
    args = ap.parse_args()

    warnings: list[str] = []
    if not common.FILE_NAME_RE.match(args.name):
        common.fail(f"--name {args.name!r} must be lowercase kebab (F1)", 1)
    try:
        paths = common.app_paths()
    except FileNotFoundError:
        paths = {}
    public_dir = Path(args.public_dir or paths.get("public"))
    credits_path = Path(args.credits or paths.get("credits"))
    target = public_dir / f"{args.name}.png"
    if args.forget:
        forget(target, credits_path, paths)
    if target.exists() and not args.force:
        n = 2
        while (public_dir / f"{args.name}-{n}.png").exists():
            n += 1
        common.fail(f"{target} exists; existing files are immutable (F3). Use --name {args.name}-{n} or --force.", 1,
                    suggestedName=f"{args.name}-{n}")

    meta = {"source": args.source, "sourceId": args.source_id, "author": args.author, "pageUrl": args.page_url,
            "license": args.license, "licenseUrl": args.license_url, "url": args.url, "attribution": ""}
    if args.from_candidates:
        results = common.read_json(args.from_candidates)
        cands = {c["idx"]: c for c in results.get("candidates", [])}
        if args.pick not in cands:
            common.fail(f"--pick {args.pick} is not a candidate idx in {args.from_candidates}", 1)
        c = cands[args.pick]
        meta.update({"source": c["source"], "sourceId": str(c.get("id", "")), "author": c.get("author", ""),
                     "pageUrl": c.get("pageUrl", ""), "license": c.get("license", ""), "licenseUrl": c.get("licenseUrl", ""),
                     "url": c.get("downloadUrl"), "attribution": c.get("attribution", "")})
        if c.get("flags"):
            warnings.append(f"candidate flags: {' '.join(c['flags'])}")
    if not meta["url"]:
        common.fail("no download URL: pass --url or --from-candidates/--pick", 1)
    if not meta["license"]:
        warnings.append("no license recorded; fill --license before committing (F6)")

    args.work.mkdir(parents=True, exist_ok=True)
    raw = b""
    url_candidates = [meta["url"]]
    thumb = common.wikimedia_thumb_url(meta["url"], 1000)
    if thumb != meta["url"]:
        url_candidates.insert(0, thumb)  # Commons originals answer 429; the thumb endpoint rasterises SVGs too
    last = None
    for u in url_candidates:
        try:
            raw = common.http_get(u, timeout=40)
            meta["url"] = u
            break
        except common.HttpError as e:
            last = e
    if not raw:
        common.fail(f"download failed: {last.message if last else 'no data'}", 2)
    if len(raw) < 200:
        common.fail("downloaded file is too small to be an image", 2)
    src = args.work / "downloads" / f"{args.name}.orig"
    src.parent.mkdir(parents=True, exist_ok=True)
    src.write_bytes(raw)

    info: dict
    try:
        png, info = process_with_pillow(raw, args.size, args.bg, args.margin, args.trim,
                                        allow_checkerboard=args.allow_checkerboard, do_whiten=not args.no_whiten)
        public_dir.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(".png.tmp")
        tmp.write_bytes(png)
        tmp.replace(target)
    except ImportError:
        warnings.append("Pillow missing: used sips (white padding, no trim)")
        info = process_with_sips(src, target, args.size)
    except ValueError as e:
        common.fail(str(e), 1)
    except Exception as e:
        common.fail(f"image processing failed: {e}", 2)

    from_size = None
    try:
        from PIL import Image
        with Image.open(target) as im:
            from_size = im.size
        if info.get("originalWidth") and min(info["originalWidth"], info["originalHeight"]) < 200:
            warnings.append(f"source was only {info['originalWidth']}x{info['originalHeight']}; may look soft at 2x")
    except Exception:
        pass

    record = {
        "file": target.name, "word": (args.word or args.name.split("-")[0]).upper(),
        "source": meta["source"], "sourceId": meta["sourceId"], "sourceUrl": meta["pageUrl"],
        "downloadUrl": meta["url"], "author": meta["author"], "license": meta["license"],
        "licenseUrl": meta["licenseUrl"], "attribution": meta["attribution"],
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "sha256": common.sha256_file(target), "puzzleId": args.puzzle_id,
    }
    credits = common.read_json(credits_path) if credits_path.exists() else []
    credits = [r for r in credits if r.get("file") != target.name]
    credits.append(record)
    common.write_json(credits_path, credits)
    common.emit({"ok": True, "file": str(target), "width": from_size[0] if from_size else args.size,
                 "height": from_size[1] if from_size else args.size, "bytes": target.stat().st_size,
                 "background": info.get("background"), "trimmed": info.get("trimmed"), "whitened": info.get("whitened"), "record": record,
                 "creditsFile": str(credits_path), "warnings": warnings})


if __name__ == "__main__":
    main()
