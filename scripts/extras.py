#!/usr/bin/env python3
"""Titles no feed carries, added by hand.

A game here is the same dict a portal returns, plus a few optional keys:

  pin        keep the tile at the top of the wall, above the most-played
  id         the slug for the tile; without it the title is slugged
  priority   which route to try first when several entries share a title
             (lower wins; feeds count as 9, so a hand-added route leads)
  exclusive  a feed copy of this title is a different game, so do not merge it
             in as a fallback route

The builder merges these in before it groups by title, so an extra can never
be counted twice and a feed that later carries the same game simply becomes a
second route on the same tile. Rebuilding never drops them.

Minecraft is the one title here, and it has two routes because the obvious
host does not work. It used to be bundled as a 72 MB local file
(assets/games/minecraft.html, the Eaglercraft 26.2 zeus download); that was
most of the repo's 1 GB and one play cost more than a month of a class's
bandwidth, so it was pulled out and pointed at the project's own player at
eaglercraft.com/play instead. That player refuses to be framed — the server
answers `x-frame-options: DENY` (checked 20 October 2026) and only its owner
can lift it, so the tile could never play inside this page.

So the routes are two places that actually do serve the game and do not send
X-Frame-Options:

  1. johntherriiiippper.github.io — a self-contained single-file EaglercraftX
     build (Resent Client 1.8, 17.9 MB). GitHub Pages cannot set
     X-Frame-Options at all, and github.io is the one host we know the school
     does not block, which makes it the least likely route to be filtered.
  2. eaglercraft.q13x.com — a maintained community distribution, EaglercraftX
     1.8.8 u53 (July 2025), in case the personal page above ever disappears.

Both are ordinary web hosts, not `.dev` (the school blocks those) and not
homoglyph copies of anything. The tile is not pinned: the wall ranks by plays,
and a tile with no play count should not sit above titles that earned their
place. Its thumbnail is local catalogue art (assets/img/catalog/minecraft.jpg)
so the tile still draws when every game host is unreachable.

If both frames are refused, set `embed` to False and the tile opens in a new
tab instead of trying to play inside the page.
"""

EXTRAS = [
    {
        "id": "minecraft",
        "title": "Minecraft",
        "priority": 0,
        "portal": "johntherriiiippper.github.io",
        "url": "https://johntherriiiippper.github.io/eaglercraftx.html",
        "embed": True,
        "thumb": "assets/img/catalog/minecraft.jpg",
        "exclusive": True,
    },
    {
        "id": "minecraft-q13x",
        "title": "Minecraft",
        "priority": 1,
        "portal": "eaglercraft.q13x.com",
        "url": "https://eaglercraft.q13x.com/1.8.8_2/js/?retina=true",
        "embed": True,
        "exclusive": True,
    },
]
