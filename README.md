# G@M£$

A single-page wall of instant-play titles. No sign-up, no installs, no build
step — every tile opens the publisher's own HTML5 player in a full-screen
overlay right on the page.

**Live:** <https://socks275.github.io/Classroom/> (once Pages points at this
branch).

---

## What it is

- **168 titles**, harvested from the MadKidGames embeddable catalogue and
  ordered by popularity.
- **One click to play.** Tiles are lazy — an iframe is only created when you
  open a title, and it is torn down when you close, so audio and network stop.
- **Search, three sorts, saves, and a “jump back in” row.** Saves and recents
  live in `localStorage`.
- **A player that behaves.** Full-screen overlay, `Esc` to leave, focus returns
  to the tile you came from, `#p=<slug>` deep links, and a “new tab” escape
  hatch if the publisher ever refuses to frame.
- **No build step.** Three files and a stylesheet, served statically.

## Layout

```
index.html               shell: header, hero, wall, player overlay
404.html                 same skin, links home
assets/css/app.css       the whole skin (dark, lime, one stylesheet)
assets/js/catalog.js     data: [slug, title, rating, plays] × 168
assets/js/app.js         search/sort/saves/recents/player/url state
tests/ui.test.js         jsdom checks for the wall and the player
tests/catalog.test.js    data + repository integrity
```

### Adding a title

Append one row to `RAW` in `assets/js/catalog.js`:

```js
["new-slug", "New Title", 4.2, 12345],
```

Thumbnails (`…/games/<slug>/thumb_2.jpg`) and player URLs
(`…/full/<slug>`) are derived from the slug, so that is the only edit.

## Running it

```bash
npm start          # python3 -m http.server 8000 --bind 0.0.0.0
# open http://localhost:8000
```

Or open `index.html` directly. (Deep links rely on `history.replaceState`,
which some browsers restrict on `file://`; the site itself still works.)

### Tests

```bash
npm install
npm test
```

Two jsdom suites, 83 checks total. They drive the real DOM: first paint, sort
order, search and empty states, saves and persistence, the player lifecycle
(only one iframe, correct `src`, teardown on `Esc`, focus return), deep links,
shuffle, shortcuts, and the catalogue’s shape.

## Embedding notes

Titles are iframed from `https://www.madkidgames.com/full/<slug>` — the URL the
publisher’s own “New Window” button uses, and the one their embed guide
supports. Nothing is copied, proxied, or hosted here.

If a title shows a blank frame, the publisher is refusing to be framed for that
slug; the arrow in the player bar opens it in a new tab instead. Everything else
on the wall keeps working.

## Deploying

The site is plain static files, so GitHub Pages serves it straight from the
branch root:

1. **Settings → Pages** → branch `arena/22c34602-classroom`, folder `/ (root)`.
2. If this branch is also the repository’s default branch, pushes go live with
   no pull request.

## A note on the copy

The brand is **G@M£$**. The interface deliberately avoids the obvious word for
the things it lists — it says *titles*, *the wall*, *the arcade* — and title
names are the only place the publisher’s own wording shows through.

## History

This is the third build of the repository: a Google-Classroom disguise, then a
self-contained seven-game arcade, and now a thin, fast front-end over a real
embeddable catalogue. The classroom mode and the hand-written titles are gone;
the current tree is what the site actually is.
