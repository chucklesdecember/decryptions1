#!/usr/bin/env python3
"""Render a text glyph into a 512x512 clue tile: Roman numerals, single letters, punctuation, or a
periodic-table cell. Used for the D6 alphabet devices when no stock source offers a clean glyph.

Default font: the one bundled with Pillow (Aileron, CC0 1.0), so the tile carries no third-party
license obligation. Pass --font PATH --font-license TEXT to use another font and record its terms.

Usage:
  python3 render_glyph.py --text V --name roman-v --word V --work DIR
  python3 render_glyph.py --text Cu --style cell --cell-number 29 --cell-label Copper --name copper-cu --word CU --work DIR
  python3 render_glyph.py --text shut --style positional --position bottom --frame --name shut-down --word SHUTDOWN --work DIR
Options: --size 512 --fill "#111111" --puzzle-id ID --force --public-dir PATH --credits PATH
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402


def load_font(path: str | None, size: int):
    from PIL import ImageFont
    if path:
        return ImageFont.truetype(path, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # very old Pillow: bitmap font, fixed size
        return ImageFont.load_default()


def fit_font(draw, text: str, path: str | None, max_w: int, max_h: int, start: int):
    size = start
    while size > 8:
        font = load_font(path, size)
        l, t, r, b = draw.textbbox((0, 0), text, font=font)
        if (r - l) <= max_w and (b - t) <= max_h:
            return font, (l, t, r, b)
        size = int(size * 0.92)
    font = load_font(path, size)
    return font, draw.textbbox((0, 0), text, font=font)


def render(text: str, size: int, style: str, fill: str, font_path: str | None, cell_number: str, cell_label: str,
           position: str = "center", frame: bool = False):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (size, size), "white")
    draw = ImageDraw.Draw(im)
    if style == "positional":
        # classic typographic rebus: where the word sits carries meaning ("shut" at the bottom = shutdown,
        # "man" above "board" = man overboard). One word placed inside a frame at --position.
        m = int(size * 0.06)
        if frame:
            draw.rounded_rectangle([m, m, size - m - 1, size - m - 1], radius=int(size * 0.04), outline=fill, width=max(2, size // 80))
        font, (l, t, r, b) = fit_font(draw, text, font_path, int(size * 0.7), int(size * 0.3), int(size * 0.3))
        tw, th = r - l, b - t
        inner = int(size * 0.1)
        x = {"left": inner, "right": size - inner - tw}.get(position, (size - tw) / 2)
        y = {"top": inner, "bottom": size - inner - th}.get(position, (size - th) / 2)
        draw.text((x - l, y - t), text, fill=fill, font=font)
        return im
    if style == "cell":
        m = int(size * 0.06)
        draw.rectangle([m, m, size - m - 1, size - m - 1], outline=fill, width=max(2, size // 64))
        font, (l, t, r, b) = fit_font(draw, text, font_path, int(size * 0.6), int(size * 0.5), int(size * 0.5))
        draw.text(((size - (r - l)) / 2 - l, (size - (b - t)) / 2 - t - size * 0.04), text, fill=fill, font=font)
        small = load_font(font_path, int(size * 0.09))
        if cell_number:
            draw.text((m + size * 0.04, m + size * 0.03), cell_number, fill=fill, font=small)
        if cell_label:
            l2, t2, r2, b2 = draw.textbbox((0, 0), cell_label, font=small)
            draw.text(((size - (r2 - l2)) / 2 - l2, size - m - size * 0.05 - (b2 - t2)), cell_label, fill=fill, font=small)
    else:
        font, (l, t, r, b) = fit_font(draw, text, font_path, int(size * 0.8), int(size * 0.8), int(size * 0.85))
        draw.text(((size - (r - l)) / 2 - l, (size - (b - t)) / 2 - t), text, fill=fill, font=font)
    return im


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text", required=True, help="glyph text, e.g. V, III, K, Cu, :")
    ap.add_argument("--name", required=True, help="file stem, lowercase kebab, e.g. roman-v")
    ap.add_argument("--word", help="what the tile stands for (default: --text uppercased)")
    ap.add_argument("--style", choices=["plain", "cell", "positional"], default="plain")
    ap.add_argument("--position", choices=["center", "top", "bottom", "left", "right"], default="center", help="positional style: where the word sits")
    ap.add_argument("--frame", action="store_true", help="positional style: draw the box the word sits in")
    ap.add_argument("--cell-number", default="", help="cell style: atomic number shown top-left")
    ap.add_argument("--cell-label", default="", help="cell style: element name shown at the bottom")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--fill", default="#111111")
    ap.add_argument("--font", help="TTF/OTF path (default: Pillow's bundled Aileron, CC0)")
    ap.add_argument("--font-license", default="", help="license text to record when --font is given")
    ap.add_argument("--puzzle-id", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--work", type=Path, required=True)
    ap.add_argument("--public-dir", type=Path)
    ap.add_argument("--credits", type=Path)
    args = ap.parse_args()

    if not common.FILE_NAME_RE.match(args.name):
        common.fail(f"--name {args.name!r} must be lowercase kebab (F1)", 1)
    if args.font and not args.font_license:
        common.fail("--font-license is required with --font so provenance stays complete (F6)", 1)
    try:
        paths = common.app_paths()
    except FileNotFoundError:
        paths = {}
    public_dir = Path(args.public_dir or paths.get("public"))
    credits_path = Path(args.credits or paths.get("credits"))
    target = public_dir / f"{args.name}.png"
    if target.exists() and not args.force:
        common.fail(f"{target} exists; existing files are immutable (F3). Choose another --name or pass --force.", 1)
    try:
        im = render(args.text, args.size, args.style, args.fill, args.font, args.cell_number, args.cell_label,
                    position=args.position, frame=args.frame)
    except ImportError:
        common.fail("Pillow is required to render glyphs", 2)
    public_dir.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".png.tmp")
    im.save(tmp, format="PNG", optimize=True)
    tmp.replace(target)
    record = {
        "file": target.name, "word": (args.word or args.text).upper(), "source": "rendered",
        "sourceId": args.text, "sourceUrl": "", "downloadUrl": "",
        "author": "rebus-autogen render_glyph.py" + (f" with font {Path(args.font).name}" if args.font else " with Pillow's bundled Aileron font"),
        "license": args.font_license if args.font else "Aileron font, CC0 1.0 (rasterised text)",
        "licenseUrl": "" if args.font else "https://creativecommons.org/publicdomain/zero/1.0/",
        "attribution": "",
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "sha256": common.sha256_file(target), "puzzleId": args.puzzle_id,
    }
    credits = common.read_json(credits_path) if credits_path.exists() else []
    credits = [r for r in credits if r.get("file") != target.name]
    credits.append(record)
    common.write_json(credits_path, credits)
    common.emit({"ok": True, "file": str(target), "width": args.size, "height": args.size, "record": record, "warnings": []})


if __name__ == "__main__":
    main()
