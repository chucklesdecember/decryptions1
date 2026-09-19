#!/usr/bin/env python3
"""Shared helpers for the rebus-autogen scripts. Standard library only.

Every script imports this module for: repo/app paths, env loading (API keys),
cached HTTP, date/slug helpers, JSON output conventions, and the preflight check.

Exit codes used by all scripts:
  0  ok
  1  validation failure (the input is wrong; fix the draft and rerun)
  2  environment failure (network, missing tool, missing key)
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
HISTORY_DIR = SKILL_DIR / "history"

USER_AGENT = "rebus-autogen/1.0 (Decryptions daily puzzle tooling; python-urllib)"
MAX_BYTES = 15 * 1024 * 1024
ENV_FILE = Path.home() / ".config" / "rebus-autogen" / "env"

# The seven operator strings the app renders verbatim (PuzzleBox.tsx uses whitespace-pre).
OPERATOR_TOKENS = ["(", " - ", ") + (", ") + ", ")", " + ", " + ("]
# Canonical categories (rulebook H13). "World" was used once; "World News" is the house form.
CATEGORIES = ["Sports", "Entertainment", "Science", "Tech", "Business", "Politics", "U.S. News", "World News"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]
DATE_RE = re.compile(r"^(January|February|March|April|May|June|July|August|September|October|November|December) ([1-9]|[12]\d|3[01]), \d{4}$")
ID_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$")
IMAGE_PATH_RE = re.compile(r"^/[a-z0-9]+(-[a-z0-9]+)*\.(png|svg)$")
FILE_NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


# ---------------------------------------------------------------- paths
def find_repo_root(start: Path | None = None) -> Path:
    """Walk up from the script (or `start`) until decryptions_inner/src/data/puzzles.ts is found."""
    cur = (start or SCRIPT_DIR).resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / "decryptions_inner" / "src" / "data" / "puzzles.ts").exists():
            return candidate
    raise FileNotFoundError("Could not find decryptions_inner/src/data/puzzles.ts above " + str(cur))


def app_paths(root: Path | None = None) -> dict[str, Path]:
    root = root or find_repo_root()
    app = root / "decryptions_inner"
    return {
        "root": root,
        "app": app,
        "public": app / "public",
        "puzzles_ts": app / "src" / "data" / "puzzles.ts",
        "credits": app / "src" / "data" / "image-credits.json",
        "attributions": app / "src" / "Attributions.md",
    }


# ---------------------------------------------------------------- env / keys
def load_env() -> None:
    """Load KEY=VALUE lines from ~/.config/rebus-autogen/env without overriding the shell."""
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def env_key(name: str) -> str:
    load_env()
    return os.environ.get(name, "").strip()


# ---------------------------------------------------------------- dates / text
def format_puzzle_date(d: dt.date) -> str:
    """Exactly what puzzles.ts compares against: en-US long month, no zero padding."""
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def parse_puzzle_date(s: str) -> dt.date | None:
    m = DATE_RE.match(s or "")
    if not m:
        return None
    try:
        return dt.date(int(s.rsplit(", ", 1)[1]), MONTHS.index(m.group(1)) + 1, int(m.group(2)))
    except ValueError:
        return None


def iso_to_date(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def slugify(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return text.strip("-")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- wikimedia
WIKIMEDIA_ORIGINAL_RE = re.compile(r"^https?://upload\.wikimedia\.org/wikipedia/commons/([0-9a-f])/([0-9a-f]{2})/([^/?#]+)$")


def wikimedia_thumb_url(url: str, width: int = 800) -> str:
    """Rewrite a Commons original URL to its thumbnail URL.

    Originals on upload.wikimedia.org are rate-limited (HTTP 429 asks clients to use thumbnails)
    and SVG originals need rasterising anyway; the thumb endpoint does both.
    """
    m = WIKIMEDIA_ORIGINAL_RE.match(url or "")
    if not m:
        return url
    h, hh, name = m.groups()
    suffix = ".png" if name.lower().endswith(".svg") else ""
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h}/{hh}/{name}/{int(width)}px-{name}{suffix}"


# ---------------------------------------------------------------- http
class HttpError(Exception):
    def __init__(self, url: str, status: int | None, message: str):
        super().__init__(f"{message} ({url})")
        self.url, self.status, self.message = url, status, message


def _cache_path(cache_dir: Path, url: str) -> Path:
    return cache_dir / (hashlib.sha256(url.encode("utf-8")).hexdigest() + ".bin")


def http_get(url: str, headers: dict | None = None, timeout: int = 20, cache_dir: Path | None = None,
             ttl: int = 86400, max_bytes: int = MAX_BYTES, method: str = "GET") -> bytes:
    """GET (or HEAD) with a UA header, one retry on 429/5xx, and an optional on-disk cache.

    The cache exists because Pixabay's terms require API responses to be cached for 24 hours.
    file:// URLs are allowed so self-tests can run offline.
    """
    if url.startswith("file://"):
        return Path(urllib.request.url2pathname(urllib.parse.urlparse(url).path)).read_bytes()
    cache_file = None
    if cache_dir is not None and method == "GET":
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = _cache_path(cache_dir, url)
        if cache_file.exists() and (time.time() - cache_file.stat().st_mtime) < ttl:
            return cache_file.read_bytes()
    req_headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    req_headers.update(headers or {})
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers=req_headers, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if method == "HEAD":
                    return b""
                data = resp.read(max_bytes + 1)
                if len(data) > max_bytes:
                    raise HttpError(url, resp.status, f"response larger than {max_bytes} bytes")
                if cache_file is not None:
                    cache_file.write_bytes(data)
                return data
        except urllib.error.HTTPError as e:
            last_err = HttpError(url, e.code, f"HTTP {e.code}")
            if e.code in (429, 500, 502, 503, 504) and attempt == 0:
                time.sleep(2.5)
                continue
            raise last_err from None
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = HttpError(url, None, f"network error: {e}")
            if attempt == 0:
                time.sleep(1.5)
                continue
            raise last_err from None
    raise last_err  # pragma: no cover


def http_status(url: str, timeout: int = 15) -> int:
    """HEAD request; returns the HTTP status (0 on network failure)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT}, method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def http_json(url: str, **kw):
    return json.loads(http_get(url, **kw).decode("utf-8"))


# ---------------------------------------------------------------- output
def emit(obj, code: int = 0) -> None:
    obj.setdefault("warnings", [])
    print(json.dumps(obj, indent=2, ensure_ascii=False))
    sys.exit(code)


def fail(message: str, code: int = 2, **extra) -> None:
    payload = {"ok": False, "error": message, "warnings": []}
    payload.update(extra)
    emit(payload, code)


def read_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)


# ---------------------------------------------------------------- preflight
def preflight() -> dict:
    out: dict = {"ok": True, "warnings": [], "checks": {}}
    c = out["checks"]
    c["python"] = sys.version.split()[0]
    try:
        import PIL  # noqa: F401
        c["pillow"] = PIL.__version__
    except Exception:
        c["pillow"] = None
        out["warnings"].append("Pillow missing: fetch_image.py falls back to sips (white padding only); find_images.py cannot build contact sheets")
    c["sips"] = bool(subprocess.run(["which", "sips"], capture_output=True).stdout.strip())
    try:
        c["node"] = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        c["node"] = None
        out["warnings"].append("node missing: insert_puzzle.py skips the import smoke test")
    try:
        paths = app_paths()
        c["repo_root"] = str(paths["root"])
        c["public_files"] = len([p for p in paths["public"].iterdir() if p.is_file()])
        c["credits_manifest"] = paths["credits"].exists()
        c["tsc"] = (paths["app"] / "node_modules" / ".bin" / "tsc").exists()
        if not c["tsc"]:
            out["warnings"].append("node_modules not installed: typecheck and the Vite preview are unavailable (run `npm install` in decryptions_inner)")
    except FileNotFoundError as e:
        out["ok"] = False
        c["repo_root"] = None
        out["warnings"].append(str(e))
    c["pixabay_key"] = bool(env_key("PIXABAY_API_KEY"))
    if not c["pixabay_key"]:
        out["warnings"].append("PIXABAY_API_KEY not set (shell env or ~/.config/rebus-autogen/env): Pixabay is skipped; Openverse + Noto Emoji still work")
    c["openverse_token"] = bool(env_key("OPENVERSE_TOKEN"))
    c["network_google_news"] = http_status("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en")
    if c["network_google_news"] != 200:
        out["warnings"].append("Google News RSS unreachable: supply a headline manually or use --rss-file")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="rebus-autogen shared helpers")
    ap.add_argument("--preflight", action="store_true", help="report tool/key/network readiness as JSON")
    args = ap.parse_args()
    if args.preflight:
        result = preflight()
        emit(result, 0 if result["ok"] else 2)
    ap.print_help()
