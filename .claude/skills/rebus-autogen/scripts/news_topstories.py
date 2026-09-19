#!/usr/bin/env python3
"""Fetch the Google News "Top stories" RSS feed and emit story clusters as JSON.

Each RSS <item> is one story cluster: its <title> is the lead headline ("Headline - Outlet")
and its <description> holds an HTML <ol> of ~5 related headlines from other outlets.
The skill uses those ~5 headlines to identify the story and compress it (rulebook H1-H14).

Usage:
  python3 news_topstories.py [--limit 5] [--rss-file fixture.xml] [--exclude REGEX] [--work DIR]
"""
from __future__ import annotations

import argparse
import collections
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

FEED_URL = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"

STOPWORDS = set("""
a an the and or but nor so yet for of in on at to by from with as into onto over under after before
is are was were be been being has have had do does did will would shall should can could may might must
this that these those it its it's he she they them his her their we you i me my our your who whom whose
which what when where why how not no yes than then there here about above across against along amid among
around because between during except inside near off out per since through toward until up upon via within
without says said say new news live latest update updates report reports breaking analysis opinion explained
""".split())


class RelatedParser(HTMLParser):
    """Collects (headline, url, outlet) triples from the description's <ol><li><a>…</a><font>…</font></li>."""

    def __init__(self) -> None:
        super().__init__()
        self.items: list[dict] = []
        self._in_a = False
        self._in_font = False
        self._url = ""
        self._headline: list[str] = []
        self._outlet: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._in_a = True
            self._url = dict(attrs).get("href", "")
            self._headline = []
        elif tag == "font":
            self._in_font = True
            self._outlet = []
        elif tag == "li":
            self._url, self._headline, self._outlet = "", [], []

    def handle_data(self, data):
        if self._in_a:
            self._headline.append(data)
        elif self._in_font:
            self._outlet.append(data)

    def handle_endtag(self, tag):
        if tag == "a":
            self._in_a = False
        elif tag == "font":
            self._in_font = False
        elif tag == "li":
            headline = " ".join("".join(self._headline).split())
            if headline:
                self.items.append({
                    "headline": headline,
                    "outlet": " ".join("".join(self._outlet).split()),
                    "url": self._url,
                })


def split_title(title: str) -> tuple[str, str]:
    """'Headline - Outlet' -> ('Headline', 'Outlet'); tolerant of hyphens inside the headline."""
    if " - " in title:
        head, outlet = title.rsplit(" - ", 1)
        return head.strip(), outlet.strip()
    return title.strip(), ""


ABBREV = {"U.S.": "US", "U.K.": "UK", "U.N.": "UN", "E.U.": "EU", "U.S": "US", "N.Y.": "NY", "D.C.": "DC"}


def tokenize(text: str) -> list[str]:
    for dotted, plain in ABBREV.items():
        text = text.replace(dotted, plain)
    return re.findall(r"[A-Za-z][A-Za-z'’\-]*|\d+", text)


def is_title_case(tokens: list[str]) -> bool:
    """True when most 4+ letter words are capitalised (WSJ/NYT style); such headlines give no
    evidence about proper nouns, so they are ignored by proper_nouns()."""
    long_toks = [t for t in tokens if len(t) >= 4 and t.isalpha()]
    if len(long_toks) < 3:
        return False
    return sum(1 for t in long_toks if t[0].isupper()) / len(long_toks) >= 0.7


def normalize(tok: str) -> str:
    return re.sub(r"['’]s$", "", tok.lower())


def cluster_keywords(headlines: list[str]) -> list[str]:
    """Tokens that appear in 2+ headlines of the cluster (after stopword removal): the shared facts."""
    per_headline = [set(normalize(t) for t in tokenize(h)) for h in headlines]
    counts = collections.Counter(t for s in per_headline for t in s)
    keep = [t for t, n in counts.items() if n >= 2 and t not in STOPWORDS and len(t) >= 3 and not t.isdigit()]
    keep.sort(key=lambda t: (-counts[t], t))
    return keep


def proper_nouns(headlines: list[str]) -> list[str]:
    """Capitalised, non-initial tokens from sentence-case headlines (title-case headlines are skipped)."""
    counts: collections.Counter[str] = collections.Counter()
    for h in headlines:
        toks = tokenize(h)
        if is_title_case(toks):
            continue
        for i, t in enumerate(toks):
            base = re.sub(r"['’]s$", "", t)
            if i > 0 and base[:1].isupper() and normalize(base) not in STOPWORDS and len(base) >= 2:
                counts[base] += 1
    out = sorted(counts, key=lambda t: (-counts[t], t))
    return out


def parse_feed(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    clusters = []
    for rank, item in enumerate(root.iter("item"), start=1):
        title = (item.findtext("title") or "").strip()
        headline, outlet = split_title(title)
        source_el = item.find("source")
        parser = RelatedParser()
        parser.feed(item.findtext("description") or "")
        related = parser.items
        # The lead headline is normally the first related entry; make sure it is present exactly once.
        if not any(r["headline"] == headline for r in related):
            related.insert(0, {"headline": headline, "outlet": outlet, "url": (item.findtext("link") or "").strip()})
        all_headlines = [r["headline"] for r in related]
        clusters.append({
            "rank": rank,
            "title": headline,
            "outlet": outlet or (source_el.text.strip() if source_el is not None and source_el.text else ""),
            "link": (item.findtext("link") or "").strip(),
            "pubDate": (item.findtext("pubDate") or "").strip(),
            "related": related,
            "outletCount": len({r["outlet"] for r in related if r["outlet"]}),
            "keywords": cluster_keywords(all_headlines),
            "properNouns": proper_nouns(all_headlines),
        })
    return clusters


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=5, help="number of clusters to return (default 5)")
    ap.add_argument("--url", default=FEED_URL, help="RSS URL (default: US English top stories)")
    ap.add_argument("--rss-file", type=Path, help="parse a saved feed instead of fetching")
    ap.add_argument("--exclude", help="regex; clusters whose lead headline matches are skipped")
    ap.add_argument("--work", type=Path, help="scratch dir for the HTTP cache; also receives news.json")
    ap.add_argument("--table", action="store_true", help="print a markdown table instead of JSON (JSON still goes to <work>/news.json)")
    args = ap.parse_args()

    warnings: list[str] = []
    if args.rss_file:
        xml_bytes = args.rss_file.read_bytes()
        feed = str(args.rss_file)
    else:
        try:
            cache_dir = (args.work / "cache") if args.work else None
            xml_bytes = common.http_get(args.url, cache_dir=cache_dir, ttl=900)
            feed = args.url
        except common.HttpError as e:
            common.fail(f"could not fetch the feed: {e.message}. Use --rss-file or supply a headline manually.", 2)
    try:
        clusters = parse_feed(xml_bytes)
    except ET.ParseError as e:
        common.fail(f"feed is not valid XML: {e}", 2)

    if args.exclude:
        rx = re.compile(args.exclude, re.I)
        before = len(clusters)
        clusters = [c for c in clusters if not rx.search(c["title"])]
        if len(clusters) != before:
            warnings.append(f"excluded {before - len(clusters)} cluster(s) matching --exclude")
    for c in clusters:
        if len(c["related"]) < 3:
            warnings.append(f"cluster {c['rank']} has only {len(c['related'])} headline(s); story identification is weaker")
    import datetime as dt
    payload = {
        "ok": True,
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "feed": feed,
        "totalClusters": len(clusters),
        "clusters": clusters[: args.limit],
        "warnings": warnings,
    }
    if args.work:
        common.write_json(args.work / "news.json", payload)
    if args.table:
        print("| rank | lead headline | outlet | outlets | shared keywords | proper nouns |")
        print("|---|---|---|---|---|---|")
        for c in payload["clusters"]:
            print(f"| {c['rank']} | {c['title']} | {c['outlet']} | {c['outletCount']} | {', '.join(c['keywords'][:6])} | {', '.join(c['properNouns'][:5])} |")
            for r in c["related"]:
                print(f"|   |   ↳ {r['headline']} | {r['outlet']} |   |   |   |")
        for w in warnings:
            print(f"\nwarning: {w}")
        sys.exit(0)
    common.emit(payload)


if __name__ == "__main__":
    main()
