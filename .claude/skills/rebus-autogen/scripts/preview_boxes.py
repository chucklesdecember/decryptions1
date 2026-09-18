#!/usr/bin/env python3
"""Render a draft the way PuzzleBox.tsx lays it out, at 2x, so the agent (and the user) can judge
tile legibility, chip sizes, and wrapping before anything is inserted. No dev server needed.

Mirrors PuzzleBox.tsx: 48px image tile with 4px padding on a #f5f5f5 mat with a 1px border and 8px
radius (object-contain), bordered text chips, plain operators, the letter-count badge, and the
hint under each card. Two-column grid as on desktop; pass --columns 1 for the mobile layout.

Usage:
  python3 preview_boxes.py --draft draft.json --out preview.png [--columns 2] [--scale 2] [--public-dir PATH]
Output JSON: rows per card (the rulebook wants at most 3 rows on mobile) and missing files.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--draft", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--columns", type=int, default=2)
    ap.add_argument("--scale", type=int, default=2)
    ap.add_argument("--card-width", type=int, default=344, help="CSS px; 344 is the md grid cell, ~350 the mobile card")
    ap.add_argument("--public-dir", type=Path)
    ap.add_argument("--no-hints", action="store_true")
    args = ap.parse_args()

    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        common.fail("Pillow is required for previews", 2)
    try:
        paths = common.app_paths()
    except FileNotFoundError:
        paths = {}
    public_dir = Path(args.public_dir or paths.get("public"))
    draft = common.read_json(args.draft)
    S = args.scale

    def font(px, bold=False):
        try:
            return ImageFont.load_default(size=px * S)
        except TypeError:
            return ImageFont.load_default()

    f_op, f_chip, f_badge, f_hint, f_head = font(14), font(12), font(11), font(11), font(13)
    card_w, pad, gap_x, gap_y, tile, tile_pad = args.card_width * S, 12 * S, 4 * S, 8 * S, 48 * S, 4 * S
    chip_h, chip_px = 40 * S, 8 * S
    inner_w = card_w - 2 * pad
    warnings: list[str] = []
    missing: list[str] = []

    # ---- measure tokens per word
    def token_size(c):
        if c["type"] == "image":
            return tile, tile
        if c["type"] == "text":
            l, t, r, b = ImageDraw.Draw(Image.new("RGB", (10, 10))).textbbox((0, 0), c["content"], font=f_chip)
            return (r - l) + 2 * chip_px, chip_h
        l, t, r, b = ImageDraw.Draw(Image.new("RGB", (10, 10))).textbbox((0, 0), c["content"], font=f_op)
        return max(r - l, 1), 16 * S

    cards = []
    for w, hint in zip(draft["words"], draft.get("hints", []) + [""] * len(draft["words"])):
        rows, cur, cur_w = [], [], 0
        for c in w["clues"]:
            tw, th = token_size(c)
            if cur and cur_w + gap_x + tw > inner_w:
                rows.append(cur)
                cur, cur_w = [], 0
            cur.append((c, tw, th))
            cur_w += (gap_x if cur_w else 0) + tw
        if cur:
            rows.append(cur)
        cards.append({"answer": w["answer"], "rows": rows, "hint": "" if args.no_hints else hint})
        if len(rows) > 3:
            warnings.append(f"{w['answer']}: {len(rows)} token rows at {args.card_width}px; rulebook wants at most 3 on mobile")

    # ---- layout
    header_h = 22 * S
    def wrap(text, f, max_w):
        words, lines, cur = text.split(), [], ""
        for w_ in words:
            trial = (cur + " " + w_).strip()
            l, t, r, b = draw_probe.textbbox((0, 0), trial, font=f)
            if cur and r - l > max_w:
                lines.append(cur)
                cur = w_
            else:
                cur = trial
        if cur:
            lines.append(cur)
        return lines or [""]

    draw_probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    for card in cards:
        card["hintLines"] = wrap("hint: " + card["hint"], f_hint, card_w - 2 * pad) if card["hint"] else []
    hint_h = 0 if args.no_hints else (10 + 16 * max(1, max((len(c["hintLines"]) for c in cards), default=1))) * S
    card_heights = [pad + header_h + sum(tile + gap_y for _ in c["rows"]) + pad + hint_h for c in cards]
    cols = max(1, args.columns)
    grid_gap = 12 * S
    row_heights = [max(card_heights[i:i + cols]) for i in range(0, len(cards), cols)]
    W = cols * card_w + (cols + 1) * grid_gap
    H = sum(row_heights) + (len(row_heights) + 1) * grid_gap + 30 * S
    img = Image.new("RGB", (W, H), (255, 251, 245))
    draw = ImageDraw.Draw(img)

    y = grid_gap
    for r_i, rh in enumerate(row_heights):
        for c_i in range(cols):
            idx = r_i * cols + c_i
            if idx >= len(cards):
                break
            card = cards[idx]
            x = grid_gap + c_i * (card_w + grid_gap)
            ch = card_heights[idx] - hint_h
            draw.rounded_rectangle([x, y, x + card_w, y + ch], radius=12 * S, fill="white", outline=(229, 231, 235), width=2 * S)
            # header: hint bulb placeholder + badge
            draw.rounded_rectangle([x + pad, y + pad, x + pad + 28 * S, y + pad + 28 * S], radius=6 * S, outline=(229, 231, 235), width=1 * S)
            draw.text((x + pad + 9 * S, y + pad + 5 * S), "?", fill=(120, 120, 120), font=f_badge)
            badge = str(len(card["answer"]))
            l, t, r, b = draw.textbbox((0, 0), badge, font=f_badge)
            draw.text((x + card_w - pad - (r - l), y + pad + 8 * S), badge, fill=(113, 113, 122), font=f_badge)
            # token rows, centered
            ty = y + pad + header_h + 6 * S
            for row in card["rows"]:
                row_w = sum(tw for _, tw, _ in row) + gap_x * (len(row) - 1)
                tx = x + pad + (inner_w - row_w) // 2
                for c, tw, th in row:
                    cy = ty + (tile - th) // 2
                    if c["type"] == "image":
                        draw.rounded_rectangle([tx, ty, tx + tile, ty + tile], radius=8 * S, fill=(245, 245, 245), outline=(229, 231, 235), width=1 * S)
                        fpath = public_dir / c["content"].lstrip("/")
                        box = tile - 2 * tile_pad
                        if fpath.exists() and fpath.suffix.lower() != ".svg":
                            try:
                                with Image.open(fpath) as src:
                                    src = src.convert("RGBA")
                                    src.thumbnail((box, box), Image.LANCZOS)
                                    img.paste(src, (tx + tile_pad + (box - src.width) // 2, ty + tile_pad + (box - src.height) // 2), src)
                            except Exception:
                                missing.append(c["content"])
                        else:
                            missing.append(c["content"])
                            draw.text((tx + 6 * S, ty + 18 * S), "svg" if fpath.suffix.lower() == ".svg" else "?", fill=(200, 40, 40), font=f_chip)
                    elif c["type"] == "text":
                        draw.rounded_rectangle([tx, cy, tx + tw, cy + th], radius=6 * S, fill="white", outline=(229, 231, 235), width=1 * S)
                        l, t, r, b = draw.textbbox((0, 0), c["content"], font=f_chip)
                        draw.text((tx + (tw - (r - l)) // 2 - l, cy + (th - (b - t)) // 2 - t), c["content"], fill=(24, 24, 27), font=f_chip)
                    else:
                        l, t, r, b = draw.textbbox((0, 0), c["content"], font=f_op)
                        draw.text((tx - l, ty + (tile - (b - t)) // 2 - t), c["content"], fill=(24, 24, 27), font=f_op)
                    tx += tw + gap_x
                ty += tile + gap_y
            for k, line in enumerate(card["hintLines"]):
                draw.text((x + pad, y + ch + 6 * S + k * 16 * S), line, fill=(113, 113, 122), font=f_hint)
        y += rh + grid_gap
    draw.text((grid_gap, H - 24 * S), f"spoiler: {draft.get('headline', '')}   ({draft.get('date', '')}, {draft.get('category', '')})", fill=(160, 160, 160), font=f_head)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    img.save(args.out)
    common.emit({"ok": not missing, "out": str(args.out), "width": W, "height": H,
                 "rowsPerCard": {c["answer"]: len(c["rows"]) for c in cards}, "missingImages": missing, "warnings": warnings},
                0 if not missing else 1)


if __name__ == "__main__":
    main()
