# Classroom

A wall of HTML5 titles behind an unremarkable tab. The tab reads **Classroom**
with a chalkboard icon; the page is a plain grid of 506 playable titles.

**Live:** https://socks275.github.io/Classroom/

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
