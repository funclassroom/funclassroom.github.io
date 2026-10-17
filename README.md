# Classroom

A wall of HTML5 titles behind an unremarkable tab. The tab reads **Classroom**
with a chalkboard icon; the page is a plain grid of playable titles.

**Live:** https://socks275.github.io/ClassroomGames/

## The catalogue

Two sources, merged into one wall by title:

| source | titles | embed host |
| --- | --- | --- |
| GameMonetize's public feed | ~15,800 | `html5.gamemonetize.co` (+ `gamemonetize.com` wrapper) |
| HTMLGames' public embed index | 1,244 | `cdn.htmlgames.com` |
| MadKidGames sitemap | 506 | `www.madkidgames.com` |

Routes are chosen **one per domain**, so a block on one host never takes the
backup with it. That is why `html5.gamemonetize.co` and `gamemonetize.com` are
not both listed for the same title unless a second domain exists.

The player learns from real attempts only: a portal that actually failed in the
frame moves to the back for that device. It never pre-judges a host — a
`fetch()` is filtered differently from an iframe, so a reachability ping gave
false "blocked" answers and hid sources that played fine.

Every tile carries at least one route and most carry two, tried in order.
No source is marked unplayable ahead of time: the frame is attempted, and only
a real failure moves on to the next route. When all of them fail, the player
says the title would not load and offers the publisher in a new tab.

Every title appears once. A tile only carries more than one source when the
same game exists on more than one portal, and the extra sources are never shown
as separate tiles — the player walks down them only when the one above refuses
to load.

MadKidGames is the catalogue the site started from. `/full/<slug>` is the bare
player, but it only renders for pages on madkidgames.com — from anywhere else it
shows an empty frame. So when a title also exists on GameMonetize, that route
opens first and MadKid becomes the backup. Their pages sit behind a bot
wall that answers automated checks with a Cloudflare challenge, which is why
the build cannot verify them; the browser can.

### Why not hundreds of portals

Most portals do not publish a keyless embed feed, and the ones that do guard it
hard:

- **GameMonetize** — public JSON feed, embeddable. Used.
- **MadKidGames** — full sitemap; the pages sit behind a bot wall, so they are
  offered as routes but cannot be verified from CI.
- **KBH Games** — sitemap readable, pages behind Cloudflare's bot challenge.
- **HTMLGames** — public JSON index, free embedding, own CDN. Used.
- **GamePix** — `/embed/` answers 403 to a foreign referrer. Needs a key.
- **GameDistribution** — 19,000 games and a clean player, but it serves
  `blocked.html?unregistered=true` to any domain that has not registered with
  them. One free dashboard signup would unlock it.
- **GamePix, Gameflare, CrazyGames, Poki, Y8** — no keyless feed, or a 404
  sitemap; they need a partner key or an approved domain.

So the catalogue grows through the one portal that actually allows embedding,
not through a list of names that would each need an integration agreement.

### Keeping it current

`.github/workflows/catalog.yml` runs `scripts/build-catalog.py` on GitHub's
runners, which have real network access. It pages through the GameMonetize
feed (paced, because Cloudflare rate-limits at a thousand requests or so),
re-reads the MadKidGames sitemap, merges duplicates by a normalised title
(stop-words and punctuation stripped, `&` read as "and"), and rewrites
`assets/js/catalog.js`.

The builder refuses to write a catalogue that is smaller than the one already
in place, so a bad feed day cannot wipe the wall. It also drops generative-AI
titles and a short blocklist of gambling titles (casino, slots, poker). AI-titled
games are no longer excluded — an earlier rule did that, and it has been removed.

## Progress and saves

Two different kinds of progress exist, and it is worth knowing which is which.

**What this site stores** — in this browser, under `classroom.state.v1`:

- titles you saved
- the last eight you opened, with timestamps and visit counts
- your sort choice and how far down the wall you had scrolled
- a "Pick up where you left off" card built from that history

Nothing is uploaded: there is no analytics, no request carrying any of it, and
the only way it leaves the device is if you clear the site data. The footer has
a two-step **Clear saved data** button.

**What the titles store themselves** — each frame loads from
`madkidgames.com`, so its own save files (levels, coins, unlocked cars) live in
that publisher's storage, tied to this site. They survive a reload, a closed
tab and a new visit from the same browser. They do not follow you to another
device or another browser, and a private window throws them away when it closes.
If a title only keeps state in memory, nothing can save it — that is down to the
game.

## The page

- Search (multi-word: "car park" finds "Car Parking"), plus Popular / Top rated / A–Z
- Genre chips built from the catalogue itself, no hand-kept taxonomy
- "More like what you played" — suggestions derived on the device from titles
  you already opened, with nothing sent anywhere
- Save straight from the player, not just the tile
- 120 tiles to a page, with a **Show more** button, so a 16,000-title wall
  still paints in one frame
- Save titles, and a row of the last eight you opened
- `#p=<slug>` deep links, `Esc` to close, `/` to search
- Fullscreen, and an "open in a new tab" fallback if a title refuses to frame
- A fallback chain: if a route will not load, the next one for that game is
  tried automatically; if every one fails, the player says so, apologises, and
  offers the portal in a new tab

No frameworks, no build step, no backend. `localStorage` holds saves and
recents; nothing is sent anywhere.

## Files

```
index.html               the page
404.html                 not-found page
assets/css/app.css       all styling
assets/js/catalog.js     generated catalogue (506 rows)
assets/js/app.js         search, sort, saves, recents, player
scripts/build-catalog.py catalogue generator
tests/ui.test.js         DOM behaviour
tests/catalog.test.js    data and repository checks
```

## Running

```bash
npm start     # python3 -m http.server 8000 --bind 0.0.0.0
npm test      # jsdom, no network
```

## Deployment

Static files on GitHub Pages, branch `arena/22c34602-classroom`, folder `/`.
Push, and Pages rebuilds.

## On images and AI

No image is generated or hosted here: every thumbnail is the publisher's own
file, and the only artwork in the repo is the hand-written SVG tab icon. The
AI filter exists because one catalogue entry was a Veo 3 tie-in.
