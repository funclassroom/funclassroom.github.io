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

Empty for now: Minecraft used to live here as a streamed Eaglercraft embed
from a third-party host. It is now bundled as a plain local file
(assets/games/minecraft.html, the Eaglercraft 26.2 zeus offline download from
https://eaglercraft.com/downloads) and listed in assets/js/local-games.js, so
it only appears on the 100% Unblocked page and as a local (HTML) result.
"""

EXTRAS = []
