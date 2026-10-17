# G@M£$

A wall of HTML5 titles. Click one and it plays in the page; close it and the
frame is destroyed.

**Live:** https://socks275.github.io/Classroom/

## What's in it

507 titles, scraped from the embeddable catalogue at
`madkidgames.com/html5-games` on 2026-10-17, with the publisher's own
thumbnails, star ratings and play counts.

- Search by title, sort by popular / top rated / A–Z
- Save titles (star on hover) and revisit the last eight you opened
- `#p=<slug>` deep links, `Esc` to close, `/` to search
- Fullscreen, plus an "open in a new tab" button if a title won't frame
- No build step, no framework, no backend, no tracking

## Files

```
index.html              the page
404.html                not-found page, same stylesheet
assets/css/app.css      all of the styling
assets/js/catalog.js    the 507 entries (slug, title, rating, plays)
assets/js/app.js        search, sort, saves, recents, player
tests/ui.test.js        DOM behaviour
tests/catalog.test.js   data and repository checks
```

### Adding or removing a title

Edit `RAW` in `assets/js/catalog.js`. One row per title:

```js
["new-slug", "New Title", 4.2, 12345],
```

The thumbnail (`…/games/<slug>/thumb_2.jpg`) and the player
(`…/full/<slug>`) are built from the slug.

## Running

```bash
npm start     # python3 -m http.server 8000 --bind 0.0.0.0
```

Open <http://localhost:8000>. Opening `index.html` from disk also works,
except that deep links need a real server.

```bash
npm install
npm test
```

## Deployment

Static files, served by GitHub Pages from the branch root
(`arena/22c34602-classroom`, folder `/`). Push and Pages rebuilds.

## Notes

- Titles stream from MadKidGames; nothing is copied or hosted here.
- A blank frame means the publisher declined that slug. The arrow in the
  player bar opens it in a new tab.
- The interface calls them titles. Title names are the publisher's.
