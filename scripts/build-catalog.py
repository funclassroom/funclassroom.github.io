#!/usr/bin/env python3
"""Build assets/js/catalog.js from every portal in scripts/portals.py.

One tile per game. When the same title exists on more than one portal the
others become fallbacks: the player tries them in order until one loads.

Run by .github/workflows/catalog.yml, on runners with real network access.
"""

import html
import json
import os
import re
import sys
import urllib.parse
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import extras
import portals

OUT = "assets/js/catalog.js"


def read_existing():
    """Keep real titles, ratings and play counts between rebuilds.

    Each catalogue row is a JSON array with a trailing comma, so it parses
    as-is once that comma is gone. No regex to get wrong.
    """
    try:
        with open(OUT, encoding="utf-8") as handle:
            lines = handle.read().splitlines()
    except FileNotFoundError:
        return {}

    rows = {}
    for line in lines:
        line = line.strip()
        if not line.startswith('["'):
            continue
        line = line.rstrip(",")
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if len(row) < 5 or not isinstance(row[0], str):
            continue
        sources = []
        for triple in row[5] if len(row) > 5 else []:
            if isinstance(triple, list) and len(triple) >= 2:
                sources.append({
                    "portal": triple[0],
                    "url": triple[1],
                    "embed": len(triple) > 2 and bool(triple[2]),
                })
        rows[row[0]] = {
            "title": row[1],
            "rating": float(row[2] or 0),
            "plays": int(row[3] or 0),
            "thumb": row[4],
            "sources": sources,
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
    # A range request, not HEAD: the CDN answers HEAD with 403 but serves the
    # first byte happily, so HEAD would call every game dead.
    request = urllib.request.Request(
        url, headers={"User-Agent": UA_CHECK, "Range": "bytes=0-0"}
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response.read(1)
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


def load_dead():
    """URLs a real browser found empty, from scripts/validate.mjs."""
    try:
        with open("data/dead-sources.json", encoding="utf-8") as handle:
            return set(json.load(handle).get("urls") or [])
    except (FileNotFoundError, ValueError):
        return set()


def domain_of(url):
    """The domain a block would have to name: gamemonetize.co, htmlgames.com."""
    host = urllib.parse.urlparse(url).netloc.lower()
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def pick(sources, limit=3):
    """Keep the routes that are actually different, one per domain.

    Two URLs on the same domain are not a fallback: a block that kills one
    kills both. The list is taken in priority order, but a second copy on a
    domain already used is skipped.
    """
    chosen = []
    used = set()
    for source in sources:
        key = domain_of(source["url"])
        if key in used:
            continue
        used.add(key)
        chosen.append(source)
        if len(chosen) >= limit:
            break
    if not chosen and sources:
        chosen = sources[:1]
    return chosen


def js(value):
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


verify_stats = {}


def main():
    do_verify = "--verify" in sys.argv
    existing = read_existing()
    playable_before = count_playable(OUT)

    collected = []
    fetched = {}
    for portal in portals.PORTALS:
        try:
            games = portal(existing) if portal is portals.madkidgames else portal()
        except Exception as err:  # noqa: BLE001 - one portal must not sink the build
            print("portal %s failed: %s" % (portal.__name__, err), file=sys.stderr)
            continue
        print("%-14s %d games" % (portal.__name__, len(games)))
        fetched[portal.__name__] = len(games)
        collected.extend(games)

    # Hand-picked titles that no feed carries. They go through the same
    # grouping and sorting as everything else, so they cannot be counted
    # twice and a portal carrying one later just adds a route.
    collected.extend(dict(game) for game in getattr(extras, "EXTRAS", []))
    if extras.EXTRAS:
        print("%-14s %d games" % ("by hand", len(extras.EXTRAS)))
        fetched["by hand"] = len(extras.EXTRAS)

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
    def play_rank(game):
        # What the tile opens first. MadKid's embed renders black anywhere
        # outside madkidgames.com, so a title we also have on a feed we can
        # frame opens that one and keeps MadKid as the backup.
        return (
            0 if game.get("pin") else 1,
            0 if game["portal"] == "gamemonetize.com" else 1,
            0 if game.get("embed") else 1,
            game["portal"],
        )

    def meta_rank(game):
        # Where the name, art and stats come from. MadKid has real ratings and
        # play counts; its titles are also the cleaner ones ("Geometry Dash"
        # rather than "Geometry Dash Unblocked").
        return (
            0 if game.get("pin") else 1,
            0 if game["portal"] == "madkidgames.com" else 1,
            0 if game.get("thumb") else 1,
            len(game["title"]),
        )

    pin_ids = {game.get("id") for game in getattr(extras, "EXTRAS", []) if game.get("pin")}

    entries = []
    for key in order:
        bucket = groups[key]
        meta = sorted(bucket, key=meta_rank)[0]
        sources = pick(sorted(bucket, key=play_rank))
        primary = meta
        entries.append({
            "id": primary.get("slug") or primary.get("id") or key.replace(" ", "-"),
            "title": primary["title"],
            "rating": primary.get("rating", 0.0),
            "plays": primary.get("plays", 0),
            "thumb": primary.get("thumb") or bucket[-1].get("thumb", ""),
            "sources": [
                {"portal": item["portal"], "url": item["url"], "embed": bool(item.get("embed"))}
                for item in sources
            ],
            "pinned": (primary.get("slug") or primary.get("id") or key.replace(" ", "-")) in pin_ids,
        })

    # A feed that rate-limits for a day must not empty a chunk of the wall.
    # Keep any tile we already had, with its old routes, unless a browser has
    # actually found those routes dead. Genuine removals still happen through
    # data/dead-sources.json.
    have = {entry["id"] for entry in entries}
    routed = {src["url"] for entry in entries for src in entry["sources"]}
    titles = {portals.norm(entry["title"]) for entry in entries}
    carried = 0
    for slug, old in existing.items():
        if slug in have or not old.get("sources"):
            continue
        # If the feeds returned this game under another id, it is already on
        # the wall; adding it again would show the same title twice.
        if any(src["url"] in routed for src in old["sources"]):
            continue
        if portals.norm(old["title"]) in titles:
            continue
        entries.append({
            "id": slug,
            "title": old["title"],
            "rating": old["rating"],
            "plays": old["plays"],
            "thumb": old["thumb"],
            "sources": old["sources"],
            "carried": True,
        })
        titles.add(portals.norm(old["title"]))
        routed.update(src["url"] for src in old["sources"])
        carried += 1
    if carried:
        print("kept %d earlier tiles the feeds did not return today" % carried)

    dead = load_dead()
    if dead:
        before = sum(len(e["sources"]) for e in entries)
        for entry in entries:
            entry["sources"] = [s for s in entry["sources"] if s["url"] not in dead]
        entries = [e for e in entries if e["sources"]]
        print("dropped %d sources a browser found empty" % (before - sum(len(e["sources"]) for e in entries)))

    if do_verify:
        entries = verify(entries)

    def order_key(entry):
        return (0 if entry["id"] in pin_ids else 1, -entry["plays"], entry["title"].lower())

    entries.sort(key=order_key)

    multi = sum(1 for e in entries if len(e["sources"]) > 1)
    lines = []
    lines.append("/* Classroom catalogue — generated by scripts/build-catalog.py.")
    lines.append("   %d tiles, %d of them with more than one source." % (len(entries), multi))
    lines.append("   Each row is [id, title, rating, plays, thumb, sources, pinned] and sources are")
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
        pin = ", 1" if entry.get("pinned") else ""
        lines.append("    [%s, %s, %.1f, %d, %s, [%s]%s]%s" % (
            js(entry["id"]), js(entry["title"]), entry["rating"], entry["plays"],
            js(entry["thumb"]), sources, pin, comma,
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
    lines.append("      pinned: row[6] === 1,")
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
        "fetched": fetched,
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
