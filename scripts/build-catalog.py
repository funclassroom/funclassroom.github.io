#!/usr/bin/env python3
"""Build assets/js/catalog.js from every portal in scripts/portals.py.

One tile per game. When the same title exists on more than one portal the
others become fallbacks: the player tries them in order until one loads.

Run by .github/workflows/catalog.yml, on runners with real network access.
"""

import html
import json
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import portals

OUT = "assets/js/catalog.js"
AI_TOKENS = (
    "artificial-intelligence", "chatgpt", "gpt-", "midjourney", "stable-diffusion",
    "gemini", "veo-3", "neural-network", "ai-image", "ai-art", "ai-chat",
)


def is_ai(slug, title):
    key = (slug + " " + title).lower()
    if any(token in key for token in AI_TOKENS):
        return True
    return re.search(r"\bai\b", key) is not None


def read_existing():
    """Keep real titles, ratings and play counts between rebuilds."""
    try:
        with open(OUT, encoding="utf-8") as handle:
            text = handle.read()
    except FileNotFoundError:
        return {}

    rows = {}
    pattern = r'\["([^"]+)",\s*"((?:[^"\\]|\\.)*)",\s*([0-9.]+),\s*(\d+),\s*"([^"]*)"'
    for match in re.finditer(pattern, text):
        slug = match.group(1)
        rows[slug] = {
            "title": match.group(2).replace('\\"', '"').replace("\\\\", "\\"),
            "rating": float(match.group(3)),
            "plays": int(match.group(4)),
            "thumb": match.group(5),
        }
    return rows


def clean_title(text):
    """Feeds carry HTML entities and zero-width joiners; browsers should not."""
    text = html.unescape(text or "")
    text = re.sub(r"[\u200b-\u200f\u202a-\u202e\ufeff\u2060]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def count_playable(path):
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
    except FileNotFoundError:
        return 0
    return text.count('"gamemonetize.com"')


UA_CHECK = "Mozilla/5.0 (compatible; classroom-catalog/3.0)"


def status_of(url):
    """What the host actually answers. 404/410 means the game is gone."""
    request = urllib.request.Request(url, headers={"User-Agent": UA_CHECK}, method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status
    except urllib.error.HTTPError as err:
        return err.code
    except Exception:  # noqa: BLE001 - timeouts and DNS flake are "unknown"
        return 0


def verify(entries, workers=24):
    """Check the route each tile opens with; drop tiles that are truly gone."""
    urls = sorted({entry["sources"][0]["url"] for entry in entries})
    print("checking %d urls" % len(urls), file=sys.stderr)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        codes = dict(zip(urls, pool.map(status_of, urls)))

    gone = alive = unknown = 0
    kept = []
    for entry in entries:
        code = codes.get(entry["sources"][0]["url"], 0)
        if code in (404, 410):
            gone += 1
            continue
        if 200 <= code < 400:
            alive += 1
            entry["sources"][0]["ok"] = True
        else:
            unknown += 1
        kept.append(entry)

    print("sources alive %d, gone %d, unknown %d" % (alive, gone, unknown))
    verify_stats.update({"checked": len(urls), "alive": alive, "gone": gone, "unknown": unknown})
    return kept


def js(value):
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


verify_stats = {}


def main():
    do_verify = "--verify" in sys.argv
    existing = read_existing()
    playable_before = count_playable(OUT)

    collected = []
    for portal in portals.PORTALS:
        try:
            games = portal(existing) if portal is portals.madkidgames else portal()
        except Exception as err:  # noqa: BLE001 - one portal must not sink the build
            print("portal %s failed: %s" % (portal.__name__, err), file=sys.stderr)
            continue
        print("%-14s %d games" % (portal.__name__, len(games)))
        collected.extend(games)

    if not collected:
        print("no portal returned anything; leaving the catalogue alone", file=sys.stderr)
        return 1

    # Group by normalised title so duplicates collapse into one tile.
    groups = {}
    order = []
    for game in collected:
        key = portals.norm(game["title"])
        if not key:
            continue
        game["title"] = clean_title(game["title"])
        if not game["title"]:
            continue
        if is_ai(game.get("slug", ""), game["title"]):
            continue

        if key not in groups:
            groups[key] = []
            order.append(key)
        bucket = groups[key]
        if not any(item["url"] == game["url"] for item in bucket):
            bucket.append(game)
        if game.get("alt"):
            alt = dict(game)
            alt["url"] = game["alt"]
            alt.pop("alt", None)
            alt["embed"] = True
            if not any(item["url"] == alt["url"] for item in bucket):
                bucket.append(alt)

    # Sources that can actually play inside the page come first; a tile whose
    # only source forbids framing is still kept, it just opens in a new tab.
    def rank(game):
        # The source most likely to render goes first: GameMonetize's CDN
        # answers 200, MadKid is behind a bot wall we cannot see through.
        return (
            0 if game["portal"] == "gamemonetize.com" else 1,
            0 if game.get("embed") else 1,
            0 if game.get("thumb") else 1,
            game["portal"],
        )

    entries = []
    for key in order:
        bucket = sorted(groups[key], key=rank)[:3]
        primary = bucket[0]
        entries.append({
            "id": primary.get("slug") or key.replace(" ", "-"),
            "title": primary["title"],
            "rating": primary.get("rating", 0.0),
            "plays": primary.get("plays", 0),
            "thumb": primary.get("thumb") or bucket[-1].get("thumb", ""),
            "sources": [
                {"portal": item["portal"], "url": item["url"], "embed": bool(item.get("embed"))}
                for item in bucket
            ],
        })

    if do_verify:
        entries = verify(entries)

    def order_key(entry):
        # Tiles we know can render lead the wall.
        trusted = entry["sources"][0]["portal"] == "gamemonetize.com"
        return (0 if trusted else 1, -entry["plays"], entry["title"].lower())

    entries.sort(key=order_key)

    multi = sum(1 for e in entries if len(e["sources"]) > 1)
    lines = []
    lines.append("/* Classroom catalogue — generated by scripts/build-catalog.py.")
    lines.append("   %d tiles, %d of them with more than one source." % (len(entries), multi))
    lines.append("   Each row is [id, title, rating, plays, thumb, sources] and sources are")
    lines.append("   [portal, url, embeddable] triples tried in order until one loads;")
    lines.append("   embeddable 0 means the site refuses to be framed. */")
    lines.append("(function () {")
    lines.append('  "use strict";')
    lines.append("")
    lines.append("  var RAW = [")
    for index, entry in enumerate(entries):
        comma = "," if index < len(entries) - 1 else ""
        sources = ", ".join(
            "[%s, %s, %d]" % (js(src["portal"]), js(src["url"]), 1 if src["embed"] else 0)
            for src in entry["sources"]
        )
        lines.append("    [%s, %s, %.1f, %d, %s, [%s]]%s" % (
            js(entry["id"]), js(entry["title"]), entry["rating"], entry["plays"],
            js(entry["thumb"]), sources, comma,
        ))
    lines.append("  ];")
    lines.append("")
    lines.append("  window.CATALOG = RAW.map(function (row) {")
    lines.append("    return {")
    lines.append("      id: row[0],")
    lines.append("      title: row[1],")
    lines.append("      rating: row[2],")
    lines.append("      plays: row[3],")
    lines.append("      thumb: row[4],")
    lines.append("      sources: row[5].map(function (triple) {")
    lines.append("        return { portal: triple[0], url: triple[1], embed: triple[2] === 1 };")
    lines.append("      })")
    lines.append("    };")
    lines.append("  });")
    lines.append('  window.CATALOG_BUILT = "%s";' % "")
    lines.append("}());")
    lines.append("")

    # Guard: never shrink the wall by accident.
    playable_now = len(entries)
    if len(entries) < len(existing) * 0.6:
        print(
            "refusing to write: %d entries / %d playable is far below %d / %d"
            % (len(entries), playable_now, len(existing), playable_before),
            file=sys.stderr,
        )
        return 1

    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))

    report = {
        "tiles": len(entries),
        "routes": {},
        "sources": {},
        "verified": verify_stats,
    }
    for entry in entries:
        key = str(len(entry["sources"]))
        report["routes"][key] = report["routes"].get(key, 0) + 1
        for src in entry["sources"]:
            report["sources"][src["portal"]] = report["sources"].get(src["portal"], 0) + 1
    with open("catalog-report.json", "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)

    print("tiles: %d" % len(entries))
    print("with a fallback: %d" % multi)
    print("playable in page: %d" % sum(
        1 for e in entries if any(src["embed"] for src in e["sources"])
    ))
    print("sources total: %d" % sum(len(e["sources"]) for e in entries))
    return 0


if __name__ == "__main__":
    sys.exit(main())
