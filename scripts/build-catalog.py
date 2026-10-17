#!/usr/bin/env python3
"""Rebuild assets/js/catalog.js from the MadKidGames sitemap.

Run by .github/workflows/catalog.yml (GitHub's runners can reach the site; the
dev sandbox cannot). Existing rows keep their real titles, ratings and play
counts; anything new in the sitemap is added with a title derived from its slug.
"""

import json
import re
import sys
import urllib.request

SITEMAP = "https://www.madkidgames.com/sitemap.xml"
OUT = "assets/js/catalog.js"
UA = "Mozilla/5.0 (compatible; gams-catalog/1.0)"

# Titles whose subject is generative AI; the site keeps these off the wall.
AI_TOKENS = (
    "artificial-intelligence", "chatgpt", "gpt-", "midjourney", "stable-diffusion",
    "gemini", "veo-3", "neural-network", "ai-image", "ai-art", "ai-chat",
)

SMALL = {"a", "an", "and", "the", "of", "for", "to", "in", "on", "vs", "with", "or", "at", "by"}
WORDS = {
    "3d": "3D", "2d": "2D", "4x4": "4x4", "f1": "F1", "gta": "GTA", "mmx": "MMX",
    "wcc": "WCC", "lol": "LOL", "rpg": "RPG", "td": "TD", "io": "IO", "iq": "IQ",
    "asmr": "ASMR", "usa": "USA", "eu": "EU", "hd": "HD", "pro": "PRO", "vr": "VR",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def title_from_slug(slug):
    parts = [p for p in slug.split("-") if p]
    out = []
    for i, part in enumerate(parts):
        low = part.lower()
        if low in WORDS:
            out.append(WORDS[low])
        elif i > 0 and low in SMALL:
            out.append(low)
        elif part.isdigit():
            out.append(part)
        else:
            out.append(part[0].upper() + part[1:])
    name = " ".join(out).strip()
    return name or slug


def is_ai(slug, title):
    key = (slug + " " + title).lower()
    if any(token in key for token in AI_TOKENS):
        return True
    return re.search(r"\bai\b", key) is not None


def existing_rows():
    """Read what is already in catalog.js so real metadata survives a sync."""
    try:
        with open(OUT, encoding="utf-8") as handle:
            text = handle.read()
    except FileNotFoundError:
        return {}
    rows = {}
    for match in re.finditer(r'\["([^"]+)",\s*"((?:[^"\\]|\\.)*)",\s*([0-9.]+),\s*(\d+)\]', text):
        title = match.group(2).replace('\\"', '"').replace("\\\\", "\\")
        rows[match.group(1)] = (title, float(match.group(3)), int(match.group(4)))
    return rows


def js(value):
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main():
    try:
        xml = fetch(SITEMAP)
    except Exception as err:  # noqa: BLE001 - surface the reason in the log
        print("sitemap fetch failed:", err, file=sys.stderr)
        return 1

    slugs = []
    seen = set()
    for slug in re.findall(r"https://www\.madkidgames\.com/game/([a-z0-9][a-z0-9-]*)", xml):
        slug = slug.rstrip("-")
        if slug and slug not in seen:
            seen.add(slug)
            slugs.append(slug)

    if len(slugs) < 100:
        print("sitemap returned only %d titles; refusing to rewrite" % len(slugs), file=sys.stderr)
        return 1

    old = existing_rows()
    rows = []
    dropped = 0
    for slug in slugs:
        title, rating, plays = old.get(slug) or (title_from_slug(slug), 0.0, 0)
        if is_ai(slug, title):
            dropped += 1
            continue
        rows.append((slug, title, rating, plays))

    # Known play counts first, most played at the top; the rest alphabetically.
    rows.sort(key=lambda r: (-r[3] if r[3] > 0 else 0, r[1].lower()))

    lines = []
    lines.append("/* G@M£$ catalogue — generated from madkidgames.com/sitemap.xml.")
    lines.append("   %d titles. Rows are [slug, title, rating, plays]; thumbnails and player" % len(rows))
    lines.append("   URLs are built from the slug. Edit scripts/build-catalog.py, not this file. */")
    lines.append("(function () {")
    lines.append('  "use strict";')
    lines.append("")
    lines.append("  var RAW = [")
    for index, (slug, title, rating, plays) in enumerate(rows):
        comma = "," if index < len(rows) - 1 else ""
        lines.append("    [%s, %s, %.1f, %d]%s" % (js(slug), js(title), rating, plays, comma))
    lines.append("  ];")
    lines.append("")
    lines.append("  window.CATALOG = RAW.map(function (row) {")
    lines.append("    return {")
    lines.append("      slug: row[0],")
    lines.append("      title: row[1],")
    lines.append("      rating: row[2],")
    lines.append("      plays: row[3],")
    lines.append('      thumb: "https://www.madkidgames.com/games/" + row[0] + "/thumb_2.jpg",')
    lines.append('      embed: "https://www.madkidgames.com/full/" + row[0]')
    lines.append("    };")
    lines.append("  });")
    lines.append('  window.CATALOG_SOURCE = "https://www.madkidgames.com/html5-games";')
    lines.append("}());")
    lines.append("")

    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))

    print("sitemap slugs: %d" % len(slugs))
    print("kept with metadata: %d" % sum(1 for s in rows if s[0] in old))
    print("added: %d" % sum(1 for s in rows if s[0] not in old))
    print("dropped as AI: %d" % dropped)
    print("written: %d" % len(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
