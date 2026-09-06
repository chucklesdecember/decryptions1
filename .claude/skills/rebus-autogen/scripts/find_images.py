#!/usr/bin/env python3
"""Search for a clue image: local library first, then Pixabay, Openverse (CC0/PD), Noto Emoji.

Writes thumbnails and a numbered contact sheet so the agent can inspect every candidate with a
single Read, then hands the chosen candidate to fetch_image.py.

Usage:
  python3 find_images.py --word DUCK [--query "duck clipart"] [--source local,pixabay,openverse,noto]
                         [--emoji 🦆] [--type vector,illustration] [--limit 8] --work DIR

Output: JSON with local matches, candidates (idx, source, size, tags, author, license, flags),
the contact sheet path, and the results.json path fetch_image.py consumes.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

PIXABAY_LICENSE = ("Pixabay Content License", "https://pixabay.com/service/license-summary/")
NOTO_LICENSE = ("Apache-2.0", "https://github.com/googlefonts/noto-emoji/blob/main/LICENSE")
NOTO_BASE = "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/"
FACE_WORDS = {"portrait", "woman", "man", "girl", "boy", "face", "selfie", "celebrity", "president",
              "actor", "actress", "people", "person", "model", "politician"}
LOGO_WORDS = {"logo", "brand", "trademark", "emblem"}
TEXT_WORDS = {"text", "typography", "quote", "lettering", "font", "word", "banner"}


def flags_for(tags: str, query: str) -> list[str]:
    words = set(re.findall(r"[a-z]+", (tags or "").lower()))
    qwords = set(re.findall(r"[a-z]+", (query or "").lower()))
    out = []
    if words & {"silhouette", "outline", "shadow"}:
        out.append("silhouette")
    elif words & FACE_WORDS:
        out.append("face?")
    if (words | qwords) & LOGO_WORDS:
        out.append("logo?")
    if words & TEXT_WORDS:
        out.append("text?")
    return out


def image_size(path: Path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def search_local(word: str, public_dir: Path, credits: list[dict]) -> list[dict]:
    stem = word.lower()
    found: dict[str, dict] = {}
    if public_dir.exists():
        for p in sorted(public_dir.iterdir()):
            if not p.is_file():
                continue
            s = p.stem.lower()
            if s == stem or s.startswith(stem + "-") or s == "puzzle-" + stem:
                size = image_size(p)
                found[p.name] = {
                    "file": p.name, "path": str(p),
                    "width": size[0] if size else None, "height": size[1] if size else None,
                    "square": bool(size and 0.95 <= size[0] / size[1] <= 1.05),
                    "manifest": None,
                }
    for row in credits:
        if str(row.get("word", "")).upper() == word.upper():
            f = row.get("file")
            p = public_dir / f if f else None
            if p and p.exists():
                found.setdefault(f, {"file": f, "path": str(p), "width": None, "height": None, "square": None, "manifest": None})
                found[f]["manifest"] = {k: row.get(k) for k in ("source", "license", "puzzleId", "fetchedAt")}
    return list(found.values())


def search_pixabay(query: str, types: list[str], limit: int, cache_dir: Path, min_width: int, warnings: list[str]) -> list[dict]:
    key = common.env_key("PIXABAY_API_KEY")
    if not key:
        warnings.append("PIXABAY_API_KEY not set; Pixabay skipped (add it to the shell or ~/.config/rebus-autogen/env)")
        return []
    out: list[dict] = []
    seen: set = set()
    for t in types:
        if len(out) >= limit:
            break
        params = {"key": key, "q": query[:100], "image_type": t, "safesearch": "true",
                  "per_page": max(3, min(limit * 2, 30)), "min_width": min_width, "order": "popular", "lang": "en"}
        url = "https://pixabay.com/api/?" + urllib.parse.urlencode(params)
        try:
            data = common.http_json(url, cache_dir=cache_dir, ttl=86400, timeout=45)
        except common.HttpError as e:
            warnings.append(f"pixabay {t}: {e.message}")
            continue
        for hit in data.get("hits", []):
            if hit["id"] in seen:
                continue
            seen.add(hit["id"])
            tags = hit.get("tags", "")
            out.append({
                "source": "pixabay", "id": str(hit["id"]), "type": hit.get("type", t),
                "width": hit.get("imageWidth"), "height": hit.get("imageHeight"),
                "tags": tags, "author": hit.get("user", ""), "pageUrl": hit.get("pageURL", ""),
                "downloadUrl": hit.get("largeImageURL") or hit.get("webformatURL"),
                "thumbUrl": hit.get("webformatURL", "").replace("_640", "_340") or hit.get("previewURL"),
                "license": PIXABAY_LICENSE[0], "licenseUrl": PIXABAY_LICENSE[1],
                "flags": flags_for(tags, query),
            })
            if len(out) >= limit:
                break
        time.sleep(0.7)
    return out


def search_openverse(query: str, limit: int, cache_dir: Path, category: str | None, warnings: list[str]) -> list[dict]:
    params = {"q": query, "license": "cc0,pdm", "page_size": max(1, min(limit, 20)),
              "extension": "png,jpg", "mature": "false"}
    if category:
        params["category"] = category
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(params)
    headers = {"Accept": "application/json"}
    token = common.env_key("OPENVERSE_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        data = common.http_json(url, headers=headers, cache_dir=cache_dir, ttl=86400, timeout=60)
    except common.HttpError as e:
        warnings.append(f"openverse: {e.message}")
        return []
    out = []
    for r in data.get("results", []):
        tags = ", ".join(t.get("name", "") for t in (r.get("tags") or [])[:10])
        lic = (r.get("license") or "").upper()
        download, thumb = r.get("url"), r.get("thumbnail") or r.get("url")
        if r.get("source") == "wikimedia" or common.WIKIMEDIA_ORIGINAL_RE.match(download or ""):
            # Commons originals return 429 and Openverse's thumbnail proxy often 424s for them;
            # the Commons thumb endpoint is reliable and rasterises SVGs.
            width = r.get("width") or 1000
            download = common.wikimedia_thumb_url(download, min(1000, max(300, width - 1)) if width > 300 else 300)
            thumb = common.wikimedia_thumb_url(r.get("url"), 400)
        out.append({
            "source": "openverse", "id": r.get("id", ""), "type": r.get("category") or "",
            "width": r.get("width"), "height": r.get("height"),
            "tags": (r.get("title") or "") + (" | " + tags if tags else ""),
            "author": r.get("creator") or "", "pageUrl": r.get("foreign_landing_url") or "",
            "downloadUrl": download, "originalUrl": r.get("url"), "thumbUrl": thumb,
            "license": "Public Domain Mark" if lic == "PDM" else ("CC0" if lic == "CC0" else f"CC {lic}"),
            "licenseUrl": r.get("license_url") or "", "provider": r.get("source") or "",
            "attribution": r.get("attribution") or "",
            "flags": flags_for(tags + " " + (r.get("title") or ""), query),
        })
    return out


def noto_filename(emoji: str) -> str:
    cps = [f"{ord(c):x}" for c in emoji if ord(c) != 0xFE0F]
    return "emoji_u" + "_".join(cps) + ".png"


def search_noto(emoji: str, warnings: list[str]) -> list[dict]:
    name = noto_filename(emoji)
    url = NOTO_BASE + name
    status = common.http_status(url)
    if status != 200:
        warnings.append(f"noto: {name} not found (HTTP {status}); try a different emoji")
        return []
    return [{
        "source": "noto", "id": name, "type": "emoji", "width": 512, "height": 512, "tags": emoji,
        "author": "Google Noto Emoji", "pageUrl": "https://github.com/googlefonts/noto-emoji",
        "downloadUrl": url, "thumbUrl": url, "license": NOTO_LICENSE[0], "licenseUrl": NOTO_LICENSE[1], "flags": [],
    }]


def build_thumbnails_and_sheet(cands: list[dict], out_dir: Path, cache_dir: Path, warnings: list[str]) -> str | None:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        warnings.append("Pillow missing: no thumbnails or contact sheet; inspect pageUrl links instead")
        return None
    out_dir.mkdir(parents=True, exist_ok=True)
    cell, pad, cols = 220, 10, 4
    import io
    from concurrent.futures import ThreadPoolExecutor

    def fetch_one(c):
        try:
            raw = common.http_get(c["thumbUrl"], cache_dir=cache_dir, ttl=86400, timeout=30)
            im = Image.open(io.BytesIO(raw)).convert("RGBA")
            im.thumbnail((cell - 2 * pad, cell - 2 * pad - 24))
            path = out_dir / f"{c['idx']:02d}.png"
            im.save(path)
            return c, im, None
        except Exception as e:
            return c, None, e

    thumbs = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for c, im, e in pool.map(fetch_one, cands):
            if im is None:
                c["flags"].append("thumb-failed")
                c["thumb"] = None
                warnings.append(f"candidate {c['idx']}: thumbnail failed ({e})")
            else:
                c["thumb"] = str(out_dir / f"{c['idx']:02d}.png")
                thumbs.append((c["idx"], im, c))
    thumbs.sort(key=lambda t: t[0])
    if not thumbs:
        return None
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * cell), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=18)
    except TypeError:
        font = ImageFont.load_default()
    for n, (idx, im, c) in enumerate(thumbs):
        x0, y0 = (n % cols) * cell, (n // cols) * cell
        # light gray mat like the app tile so transparent art reads the way it will in the puzzle
        draw.rectangle([x0 + pad, y0 + pad, x0 + cell - pad, y0 + cell - pad - 24], fill=(245, 245, 245), outline=(200, 200, 200))
        ox = x0 + (cell - im.width) // 2
        oy = y0 + pad + (cell - 2 * pad - 24 - im.height) // 2
        sheet.paste(im, (ox, oy), im)
        label = f"{idx}  {c['source'][:4]} {c.get('width') or '?'}x{c.get('height') or '?'}" + (" " + " ".join(c["flags"]) if c["flags"] else "")
        draw.text((x0 + pad, y0 + cell - pad - 20), label, fill=(20, 20, 20), font=font)
    sheet_path = out_dir / "sheet.png"
    sheet.save(sheet_path)
    return str(sheet_path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--word", required=True, help="the picture word in caps, e.g. DUCK")
    ap.add_argument("--query", help="search phrase (default: '<word> clipart')")
    ap.add_argument("--source", default="local,pixabay,openverse,noto")
    ap.add_argument("--emoji", help="emoji for the Noto fallback, e.g. 🦆")
    ap.add_argument("--type", default="vector,illustration", help="pixabay image types in order; add 'photo' for photos")
    ap.add_argument("--category", help="openverse category: illustration | photograph | digitized_artwork (default: illustration unless --type has photo)")
    ap.add_argument("--limit", type=int, default=8, help="max candidates per provider")
    ap.add_argument("--min-width", type=int, default=300)
    ap.add_argument("--work", type=Path, required=True, help="scratch dir (never inside the repo)")
    ap.add_argument("--public-dir", type=Path)
    ap.add_argument("--credits", type=Path)
    args = ap.parse_args()

    warnings: list[str] = []
    word = args.word.strip().upper()
    query = args.query or f"{word.lower()} clipart"
    sources = [s.strip() for s in args.source.split(",") if s.strip()]
    types = [t.strip() for t in args.type.split(",") if t.strip()]
    cache_dir = args.work / "cache"
    try:
        paths = common.app_paths()
    except FileNotFoundError:
        paths = {}
    public_dir = args.public_dir or paths.get("public")
    credits_path = args.credits or paths.get("credits")
    credits = common.read_json(credits_path) if credits_path and Path(credits_path).exists() else []

    local = search_local(word, Path(public_dir), credits) if ("local" in sources and public_dir) else []
    cands: list[dict] = []
    if "pixabay" in sources:
        cands += search_pixabay(query, types, args.limit, cache_dir, args.min_width, warnings)
    if "openverse" in sources:
        category = args.category or (None if "photo" in types else "illustration")
        cands += search_openverse(query, args.limit, cache_dir, category, warnings)
    if "noto" in sources and args.emoji:
        cands += search_noto(args.emoji, warnings)
    for i, c in enumerate(cands, start=1):
        c["idx"] = i
    out_dir = args.work / "candidates" / word.lower()
    sheet = build_thumbnails_and_sheet(cands, out_dir, cache_dir, warnings) if cands else None
    results = {
        "ok": True, "word": word, "query": query, "sources": sources,
        "local": local, "candidates": cands, "contactSheet": sheet,
        "resultsFile": str(out_dir / "results.json"), "warnings": warnings,
    }
    if not cands and not local:
        results["suggestions"] = ["broaden the query (e.g. '<word> cartoon', '<word> icon')",
                                  "pass --emoji for the Noto fallback", "add photo to --type"]
    common.write_json(out_dir / "results.json", results)
    common.emit(results)


if __name__ == "__main__":
    main()
