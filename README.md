# Classroom

A wall of HTML5 titles behind an unremarkable tab. The tab reads **Classroom**
with a chalkboard icon; the page is a plain grid of playable titles.

**Live:** https://socks275.github.io/ClassroomGames/

## Local HTML games and search

The main search includes publisher titles and the **64 local HTML games**.
Local versions have an **(HTML)** suffix and open the bundled file rather than
an external publisher. **100% Unblocked** links to `files.html`, whose search
only filters local games. Both pages use `assets/js/local-games.js` as their
shared list; add a game there, its file under `assets/games/`, and its card
screenshot under `assets/img/pack/`.

**Minecraft** is the one local title marked `featured` in that list, and it is
the only one treated specially. It leads the local page, it is the first tile
on the top row of the home page, and it is the first result whenever somebody
searches for it — on either page, in any sort order. Every other local game
keeps the order of the shared list and is ranked like any other title.

New additions: **Basket Random** (one-button basketball), **Jumping Shell**
(puzzle platforming), and **Fireblob** (ice-melting platforming). These files
come from [CoolDude2349/Offline-HTML-Games-Pack](https://github.com/CoolDude2349/Offline-HTML-Games-Pack/tree/5dbfcd7a6e788101a8acab50a6cf1af209938641/offline),
revision `5dbfcd7a6e788101a8acab50a6cf1af209938641`, and are kept unmodified.
All three loaded in Chromium with external HTTP requests blocked and no
JavaScript page errors. Browser checks do not guarantee that every level is
bug-free or that a school's filter permits this site's domain.

## The catalogue

Three feeds plus a short hand-written list, merged into one wall by title:

| source | titles | embed host |
| --- | --- | --- |
| GameMonetize's public feed | ~15,800 | `html5.gamemonetize.co` (+ `gamemonetize.com` wrapper) |
| HTMLGames' public embed index | 1,244 | `cdn.htmlgames.com` |
| MadKidGames sitemap | 506 | `www.madkidgames.com` |
| `scripts/extras.py`, by hand | 0 | — (currently empty) |

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

### Titles no feed carries

`scripts/extras.py` is a list of games added by hand. They go through the same
grouping and sorting as a feed, so an extra can never appear twice and a portal
that later starts carrying the same title just becomes a second route on the
same tile. Three keys are special: `id` names the tile slug, `pin` keeps it
above the most-played on every sort, and `exclusive` refuses a feed copy — a
different game that happens to own the same title is not a fallback.

There are currently no hand-added entries. **Minecraft** used to be the one
entry, streamed as Eaglercraft from a third-party host; it is now bundled as a
plain local file instead (see *The files that cannot be blocked* below), so it
no longer appears as a streamed tile on the main wall. (The player's iframe
still asks for `pointer-lock`, without which mouse-look is dead in games like
it.)

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

**The local files** save wherever their own code decides, which for most of
them is this browser's `localStorage` under the site's own origin. They are not
wrapped in anything that sends data anywhere.

**What the titles store themselves** — each frame loads from its publisher, so
its own save files (levels, coins, unlocked cars) live in
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
- `#p=<slug>` deep links, `Esc` to close, `/` to search, `` ` `` for a panic exit
- Tab cloaks (Classroom, Google, Docs), a blank-tab launcher and a quick exit
- **100% Unblocked** in the header: sixty-four titles that are plain files,
  on their own page, with no embed to load — plus filter and Surprise me
- Fullscreen, and an "open in a new tab" fallback if a title refuses to frame
- A fallback chain: if a route will not load, the next one for that game is
  tried automatically; if every one fails, the player says so, apologises, and
  offers the portal in a new tab

No frameworks, no build step, no backend. `localStorage` holds saves and
recents; nothing is sent anywhere.

## The files that cannot be blocked

`files.html`, reached from **100% Unblocked** in the header, lists sixty-four
titles that ship with the site as plain HTML under `assets/games/`. No embed,
no portal, no third party that can refuse a frame: the page opens a file from
its own folder, and a filter aimed at a game site has nothing to act on.

They come from [CoolDude2349's Offline HTML Games Pack](https://github.com/CoolDude2349/Offline-HTML-Games-Pack),
which collects 352 single-file games. That pack is several gigabytes, so this
site carries sixty-three hand-picked ones: the small classics plus the heavy
legends (Slope, Retro Bowl, OvO, Bad Piggies, Fireboy & Watergirl and more).
On top of those, **Minecraft** is bundled as `assets/games/minecraft.html` —
the **Eaglercraft 26.2 (zeus)** offline download from
[eaglercraft.com/downloads](https://eaglercraft.com/downloads), one
self-contained HTML file (SHA-256
`3cbcc8f3193006bf1c231de8df1f6a59c5ff2b8458571282ce0b68ff51589ffe`, about
76 MB, no external scripts) that replaced the old streamed Eaglercraft embed.
It is the largest file in the folder and the whole folder is about 197 MB, so
its first load takes a while. A few are
left out: `Indev.html`
pulls a Cloudflare analytics beacon and would not have been offline at all, and
`agar-io-lite.html` asks for an image that is not in the pack.

`scripts/probe-files.mjs` serves the repo and opens every one of them in
Chromium, checking each returns 200 and actually paints. It also takes the
512×384 card screenshots in `assets/img/pack/`.
`.github/workflows/local-files.yml` runs it when a game changes and commits any
new screenshots.

## Files

```
index.html               the page
files.html               the thirty-seven titles that are plain files
404.html                 not-found page
assets/games/*.html      the games themselves, straight from the offline pack
assets/img/pack/*.jpg    one screenshot per game, taken by the probe
assets/css/app.css       all styling
assets/js/catalog.js     generated catalogue (17,556 rows)
assets/js/app.js         search, sort, saves, recents, player
scripts/build-catalog.py catalogue generator
scripts/extras.py        titles added by hand (currently none)
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

No image is generated here: every thumbnail is the publisher's own file. The
only file of artwork in the repo is the hand-written SVG tab icon. The
Minecraft card on the local page (`assets/img/pack/minecraft.jpg`) is converted
from the screenshot of the Eaglercraft title screen taken while checking that
the old embed actually boots — the game has no artwork of its own to point a
thumbnail at.

AI-titled titles are no longer filtered — the old blocklist was removed when it
turned out to be hiding the one Veo title the feeds still carried.
