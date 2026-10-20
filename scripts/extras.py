#!/usr/bin/env python3
"""Titles no feed carries, added by hand.

A game here is the same dict a portal returns, plus two optional keys:

  pin        keep the tile at the top of the wall, above the most-played
  id         the slug for the tile; without it the title is slugged
  exclusive  a feed copy of this title is a different game, so do not merge it
             in as a fallback route

The builder merges these in before it groups by title, so an extra can never
be counted twice and a feed that later carries the same game simply becomes a
second route on the same tile. Rebuilding never drops them.

Minecraft is the one entry. It used to be bundled as a 72 MB local file
(assets/games/minecraft.html, the Eaglercraft 26.2 zeus download); that was
most of the repo's 1 GB and one play cost more than a month of a class's
bandwidth, so it is streamed from the Eaglercraft project's own player again.
It is not pinned: the wall ranks by plays, and a tile with no play count should
not sit above titles that earned their place.

The URL is deliberately the upstream .com rather than a mirror: it is the
project that actually ships the game, it is not a `.dev` host, and a random
third-party mirror is more likely to be blocked than a site people already
use. If the frame is refused, set `embed` to False and the tile opens in a new
tab instead of trying to play inside the page.
"""

EXTRAS = [
    {
        "id": "minecraft",
        "title": "Minecraft",
        "portal": "eaglercraft.com",
        "url": "https://eaglercraft.com/play",
        "embed": True,
        "thumb": "https://eaglercraft.com/_next/image?url=%2Fversions%2F1_8.png&w=512&q=75",
        "exclusive": True,
    },
]
