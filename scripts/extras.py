#!/usr/bin/env python3
"""Titles no feed carries, added by hand.

A game here is the same dict a portal returns, plus two optional keys:

  pin   keep the tile at the top of the wall, above the most-played
  id    the slug for the tile; without it the title is slugged

The builder merges these in before it groups by title, so an extra can never
be counted twice and a feed that later carries the same game simply becomes a
second route on the same tile. Rebuilding never drops them.
"""

EXTRAS = [
    {
        "portal": "eymenwsmc.site",
        "id": "minecraft",
        "title": "Minecraft",
        "url": "https://eymenwsmc.site/262/index.html?v=u2",
        # The launcher forwards to this standalone client build; it is the
        # same game one hop earlier, on a different domain, so it works as
        # the fallback when the launcher itself will not load.
        "alt": "https://eaglercraft-26-2-u1-cdn.u2471966200.workers.dev/"
        "eaglercraft-26.2-u2.html?v=u2-20261017",
        "thumb": "assets/img/minecraft.png",
        "rating": 0.0,
        "plays": 0,
        # Eaglercraft runs entirely in WebAssembly inside the frame. The
        # launcher page for 26.2 forwards to the client build; it was probed
        # in a real browser, both directly and inside an iframe.
        "embed": True,
        "pin": True,
    },
]
