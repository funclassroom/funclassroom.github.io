# Classroom

A wall of HTML5 titles behind an unremarkable tab. The tab reads **Classroom**
with a chalkboard icon; the page is a plain grid of 506 playable titles.

**Live:** https://socks275.github.io/ClassroomGames/

## The catalogue

506 titles, taken from MadKidGames' own sitemap — that is the whole site, not a
sample. Their marketing copy says "thousands", but the sitemap lists exactly 507
game URLs, one of which is an AI-video tie-in that has been filtered out.

Each entry keeps the publisher's real title, star rating and play count.
Thumbnails and players are built from the slug:

```
https://www.madkidgames.com/games/<slug>/thumb_2.jpg
https://www.madkidgames.com/full/<slug>
```

### Keeping it current

`.github/workflows/catalog.yml` re-reads the sitemap on GitHub's runners and
regenerates `assets/js/catalog.js`, keeping existing metadata and adding new
slugs with titles derived from their names. It runs when `scripts/build-catalog.py`
changes, or by hand from the Actions tab. The generator also drops
generative-AI-titled entries.

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
