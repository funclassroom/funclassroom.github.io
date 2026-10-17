# Classroom

A wall of HTML5 titles behind an unremarkable tab. The tab reads **Classroom**
with a chalkboard icon; the page is a plain grid of playable titles.

**Live:** https://socks275.github.io/ClassroomGames/

## The catalogue

Two sources, merged into one wall by title:

| source | titles | plays inside the page? |
| --- | --- | --- |
| GameMonetize's public embed feed | up to ~13,000 | yes — `html5.gamemonetize.co/<id>/` answers 200 with no frame rule |
| MadKidGames sitemap | 506 | no — the site sends `X-Frame-Options: SAMEORIGIN` and says "Embedding unavailable" |

Every title appears once. A tile only carries more than one source when the
same game exists on more than one portal, and the extra sources are never shown
as separate tiles — the player walks down them only when the one above refuses
to load.

MadKidGames is kept because it is the catalogue the site started from, but it
cannot be framed by anyone. Those tiles are still listed, at the end of the
wall, and open in a new tab with a one-line explanation rather than an
apologetic blank frame.

### Why not hundreds of portals

Most portals do not publish a keyless embed feed, and the ones that do guard it
hard:

- **GameMonetize** — public JSON feed, embeddable. Used.
- **MadKidGames** — full sitemap, but framing is forbidden. Listed, not framed.
- **KBH Games** — sitemap readable, pages behind Cloudflare's bot challenge.
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
titles.

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

- Search, plus Popular / Top rated / A–Z
- Save titles, and a row of the last eight you opened
- `#p=<slug>` deep links, `Esc` to close, `/` to search
- Fullscreen, and an "open in a new tab" fallback if a title refuses to frame
- A fallback chain: if a source will not load, the next one for that game is
  tried automatically; if every one refuses, the player says so, apologises,
  and offers the portal in a new tab

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
