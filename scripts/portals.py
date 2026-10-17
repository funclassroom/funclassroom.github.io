#!/usr/bin/env python3
"""Portal adapters for the catalogue builder.

Each portal exposes a list of games and an embed URL. Only portals that
publish an embedding feed are listed here; adding another one is a few lines.

The builder runs on GitHub's runners (see .github/workflows/catalog.yml),
which have real network access, so every URL is also probed for
X-Frame-Options / frame-ancestors before it is trusted.
"""

import json
import re
import urllib.error
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (compatible; classroom-catalog/2.0)"


# ---------------------------------------------------------------- helpers

def get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


NOISE = re.compile(
    r"\b(html5|html|game|games|online|free|play|unblocked|full|the|a|an)\b",
    re.I,
)


def norm(title):
    """Normalise a title so the same game on two portals lines up."""
    text = title.lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[\u00ae\u2122\u00a9]", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = NOISE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def frameable(url, timeout=20):
    """True when a page can be shown in an iframe.

    Looks at the headers only: X-Frame-Options and CSP frame-ancestors are
    the two things a browser kills a frame over.
    """
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            headers = resp.headers
            xfo = (headers.get("X-Frame-Options") or "").lower()
            csp = (headers.get("Content-Security-Policy") or "").lower()
    except urllib.error.HTTPError as err:
        headers = err.headers or {}
        xfo = (headers.get("X-Frame-Options") or "").lower()
        csp = (headers.get("Content-Security-Policy") or "").lower()
    except Exception:  # noqa: BLE001 - network flake, treat as unknown
        return None

    if "deny" in xfo or "sameorigin" in xfo:
        return False
    for part in csp.split(";"):
        if "frame-ancestors" in part:
            value = part.split("frame-ancestors", 1)[1].strip()
            if "'none'" in value or "'self'" in value:
                return False
    return True


# ---------------------------------------------------------------- portals

def madkidgames(existing):
    """The original portal. Its sitemap lists every title it carries."""
    xml = get("https://www.madkidgames.com/sitemap.xml")
    slugs = []
    seen = set()
    for slug in re.findall(r"https://www\.madkidgames\.com/game/([a-z0-9][a-z0-9-]*)", xml):
        slug = slug.rstrip("-")
        if slug and slug not in seen:
            seen.add(slug)
            slugs.append(slug)

    games = []
    for slug in slugs:
        games.append({
            "portal": "madkidgames.com",
            "title": existing.get(slug, {}).get("title") or title_from_slug(slug),
            "url": "https://www.madkidgames.com/full/" + slug,
            "thumb": "https://www.madkidgames.com/games/%s/thumb_2.jpg" % slug,
            "slug": slug,
            "rating": existing.get(slug, {}).get("rating", 0.0),
            "plays": existing.get(slug, {}).get("plays", 0),
        })
    return games


def gamemonetize(limit_pages=400, num=100):
    """GameMonetize publishes a paginated JSON feed meant for embedding."""
    games = []
    for page in range(1, limit_pages + 1):
        url = "https://gamemonetize.com/feed.php?format=0&num=%d&page=%d" % (num, page)
        try:
            payload = get(url)
        except Exception:  # noqa: BLE001 - stop paginating on trouble
            break

        match = re.search(r"\[.*\]", payload, re.S)
        if not match:
            break
        try:
            batch = json.loads(match.group(0))
        except ValueError:
            break
        if not batch:
            break

        for entry in batch:
            embed = entry.get("url")
            title = entry.get("title")
            if not embed or not title:
                continue
            games.append({
                "portal": "gamemonetize.com",
                "title": title.strip(),
                "url": embed.strip(),
                "thumb": (entry.get("thumb") or "").strip(),
                "slug": entry.get("id") or "",
                "rating": 0.0,
                "plays": 0,
            })
    return games


def kbhgames(existing):
    """KBH Games lists thousands of titles across 30 post sitemaps.

    It is a mirrors-only portal: its pages are added as extra sources for
    games we already show, never as new tiles, because its catalogue is huge
    and its thumbnails would need a second request per game.
    """
    games = []
    seen = set()

    sitemaps = ["https://kbhgames.com/post-sitemap.xml"] + [
        "https://kbhgames.com/post-sitemap%d.xml" % i for i in range(2, 31)
    ]

    for sitemap in sitemaps:
        try:
            xml = get(sitemap)
        except Exception:  # noqa: BLE001 - keep the rest of the sitemaps
            continue

        for slug in re.findall(r"https://kbhgames\.com/game/([a-z0-9][a-z0-9-]*)", xml):
            if slug in seen:
                continue
            seen.add(slug)
            games.append({
                "portal": "kbhgames.com",
                "title": title_from_slug(slug),
                "url": "https://kbhgames.com/game/" + slug,
                "thumb": "",
                "slug": slug,
                "rating": 0.0,
                "plays": 0,
            })
    return games


PORTALS = [madkidgames, gamemonetize, kbhgames]

# Portals that only contribute fallback sources for titles we already list.
MIRROR_ONLY = {"kbhgames.com"}


# ---------------------------------------------------------------- titles

SMALL = {"a", "an", "and", "the", "of", "for", "to", "in", "on", "vs", "with", "or", "at", "by"}
WORDS = {
    "3d": "3D", "2d": "2D", "4x4": "4x4", "f1": "F1", "gta": "GTA", "mmx": "MMX",
    "wcc": "WCC", "lol": "LOL", "rpg": "RPG", "td": "TD", "io": "IO", "iq": "IQ",
    "asmr": "ASMR", "usa": "USA", "eu": "EU", "hd": "HD", "pro": "PRO", "vr": "VR",
}


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
    return " ".join(out).strip() or slug
