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
import time
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
            "url": "https://www.madkidgames.com/game/" + slug,
            "thumb": "https://www.madkidgames.com/games/%s/thumb_2.jpg" % slug,
            "slug": slug,
            "rating": existing.get(slug, {}).get("rating", 0.0),
            "plays": existing.get(slug, {}).get("plays", 0),
            # Two ways in: the game page (the one with the player on it) and
            # the /full/ route. Both are tried in the frame before giving up.
            "embed": True,
            "alt": "https://www.madkidgames.com/full/" + slug,
        })
    return games


def gamemonetize(limit_pages=4, num=4000, pause=20):
    """GameMonetize publishes a paginated JSON feed meant for embedding.

    Every game is served from html5.gamemonetize.co/<id>/ which answers 200
    with no X-Frame-Options, so these are the tiles that actually play.
    The feed returns thousands per request and rate-limits hard (Cloudflare
    1015) after about five calls, so it asks for a big page and pauses.
    """
    games = []
    failures = 0

    for page in range(1, limit_pages + 1):
        url = "https://gamemonetize.com/feed.php?format=0&num=%d&page=%d" % (num, page)
        try:
            payload = get(url)
        except Exception:  # noqa: BLE001 - rate limit or flake
            payload = ""

        match = re.search(r"\[.*\]", payload, re.S)
        batch = None
        if match:
            try:
                batch = json.loads(match.group(0))
            except ValueError:
                batch = None

        if not batch:
            failures += 1
            if failures >= 3:
                break
            time.sleep(pause * 3)
            continue

        failures = 0
        for entry in batch:
            embed = (entry.get("url") or "").strip()
            title = (entry.get("title") or "").strip()
            if not embed or not title:
                continue
            games.append({
                "portal": "gamemonetize.com",
                "title": title,
                "url": embed,
                "thumb": (entry.get("thumb") or "").strip(),
                "slug": str(entry.get("id") or ""),
                "rating": 0.0,
                "plays": 0,
                "embed": True,
            })

        time.sleep(pause)

    return games


PORTALS = [madkidgames, gamemonetize]


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
