# Classroom

**138 games that keep playing when the network does not.** They are single
HTML files served from this repository, so there is no embed, no player to
load and no third party that can refuse a frame — with the wi-fi off, they
still open. Behind that is a wall of 17,556 streamed publisher titles for when
the network is fine.

The tab reads **Classroom** with a chalkboard icon, and the page is a plain
grid of playable titles.

**Live:** https://socks275.github.io/ClassroomGames/

## Local HTML games and search

The main search includes publisher titles and the **138 local HTML games**.
Local versions have an **(HTML)** suffix and open the bundled file rather than
an external publisher. **100% Unblocked** links to `files.html`, whose search
only filters local games. Both pages use `assets/js/local-games.js` as their
shared list; add a game there, its file under `assets/games/`, and its card
screenshot under `assets/img/pack/`.

**Minecraft is no longer bundled.** It was a 76 MB single file — more than
every other local title put together — so it is streamed again from
[eaglercraft.com](https://eaglercraft.com/play) and pinned to the top of the
wall by `scripts/extras.py`. It needs the network, unlike anything under
`assets/games/`. Nothing is marked `featured` in the local list now; the flag
still works (it makes a title lead the local page and its own search) but no
title uses it.

The two heaviest titles, **Slope** (25 MB) and **Plants vs Zombies** (21 MB),
and Minecraft (76 MB) have been removed to buy back hosting headroom, so the
count is **138 local games** and Minecraft streams instead. The game files now
total **819,873,619 bytes**; the 900 MiB test budget leaves **123,844,781
bytes** — about **118 MiB** for another title. The analytics beacons that
shipped with some pack pages have been stripped; gameplay and assets remain
intact.

The latest batch is **6 more titles** from the same pack, at revision
`5dbfcd7a6e788101a8acab50a6cf1af209938641`: **Parking Fury 2**
and **3**, **Dadish 2**, **3D Free Kick**, **Idle Dice** and **Agar.io Lite**.
Two that were copied and then removed for the size ceiling are **Awesome
Tanks** and **Moto X3M 2**, and one for the ad rule: **12 Mini Battles** loads
an SDK from `ixl.com.net`, a look-alike domain, even though its page paints.

The latest large batch was **46 more titles** from the same pack, at revision
`5dbfcd7a6e788101a8acab50a6cf1af209938641`. The sequels and
series the folder was missing: **Fireboy & Watergirl 2, 3 and 4**, **Bloons TD
2, 3 and 4**, **World's Hardest Game** with **2** and **3**, **Riddle School**
and **2**, **Vex 4, 5, 6** and **Vex X3M**, **Duck Life**, **Snail Bob**, **Moto
X3M Winter**, **Run 2**, **Bob the Robber 2**, **Earn to Die**, **Flood Runner
2**, **Free Rider 3**, **Dadish 3**, **Learn to Fly** and **Papa's Pizzeria**.
The heavy names now bundled rather than streamed: **Angry Birds**,
**Happy Wheels**, **Among Us**, **Age of War**, **Super Mario 64** and
**Retro Bowl College**. **Plants vs Zombies** and **Slope** were bundled too and
then removed again for size. The rest are the small classics that fit what the size
budget leaves: **Bloxorz**, **Tag**, **Bad Ice Cream**, **Space is Key**, **This
is The Only Level**, **8 Ball Classic**, **1 on 1 Tennis**, **Basketball
Stars**, **Time Shooter 3**, **Helix Jump**, **Hill Climb Racing Lite**, **Pou**
and **Breaking the Bank**.

Earlier additions were **Basket Random** (one-button basketball), **Jumping
Shell** (puzzle platforming) and **Fireblob** (ice-melting platforming), all
three loaded in Chromium with external HTTP requests blocked and no JavaScript
page errors. The 46 new files were screened the way described under *Picking
which of the 352 to ship* — every one carries its own assets and none of them
asks a server for its engine — and the browser check runs in CI. Neither kind
of check guarantees that every level is bug-free or that a school's filter
permits this site's domain.

## The catalogue

Three feeds plus a short hand-written list, merged into one wall by title:

| source | titles | embed host |
| --- | --- | --- |
| GameMonetize's public feed | ~15,800 | `html5.gamemonetize.co` (+ `gamemonetize.com` wrapper) |
| HTMLGames' public embed index | 1,244 | `cdn.htmlgames.com` |
| MadKidGames sitemap | 508 | `www.madkidgames.com` |
| `scripts/extras.py`, by hand | 0 | — (currently empty) |

Routes are chosen **one per domain**, so a block on one host never takes the
backup with it. That is why `html5.gamemonetize.co` and `gamemonetize.com` are
not both listed for the same title unless a second domain exists.

The player learns from real attempts only: a portal that actually failed in the
frame moves to the back for that device. It never pre-judges a host from a
`fetch()` — a reachability ping is filtered differently from an iframe, so it
gave false "blocked" answers and hid sources that played fine. The one fact it
does trust is the builder's `embeddable` flag, which comes from the publisher's
own `X-Frame-Options` / `Content-Security-Policy` headers.

Every tile carries at least one route and most carry two, tried in order. A
source the builder marked non-embeddable is never mounted in the iframe: the
player shows the explanation panel and a prominent new-tab button straight
away, so a known wall cannot become a black screen. When the attempted routes
all fail, the player says so and offers the publisher in a new tab.

Every title appears once. A tile only carries more than one source when the
same game exists on more than one portal, and the extra sources are never shown
as separate tiles — the player offers the next one when the route above refuses
to load.

### MadKidGames embeds

All **508 MadKidGames sources** are enabled for in-page play using
`https://www.madkidgames.com/full/<slug>`, matching the count advertised on
[their HTML5 catalogue](https://www.madkidgames.com/html5-games). Existing games,
local files, metadata and alternate sources are preserved. The scheduled
catalogue builder continues importing the full MadKidGames sitemap and marks
these sources embeddable on future refreshes.

**Publisher setup required:** MadKidGames' game-page “Ads.txt Requirement” says
website owners must copy the supplied ads.txt entries to their site's root
`ads.txt`, then email their domain to **admin@madkidgames.com** for approval.
Use their current entries; do not invent publisher IDs or copy unrelated
entries from the portal's own ads.txt. This repository does not yet contain
those entries or evidence of domain approval. Their player may show
“Embedding unavailable” until setup is complete. Preview domains may need
separate approval. The existing new-tab fallback remains available.

The catalogue and player are tested locally; live playback of all 508 games
has not been verified from an approved deployment.

### Titles no feed carries

`scripts/extras.py` is a list of games added by hand. They go through the same
grouping and sorting as a feed, so an extra can never appear twice and a portal
that later starts carrying the same title just becomes a second route on the
same tile. Three keys are special: `id` names the tile slug, `pin` keeps it
above the most-played on every sort, and `exclusive` refuses a feed copy — a
different game that happens to own the same title is not a fallback.

There is one hand-added entry: **Minecraft**, streamed from
`https://eaglercraft.com/play` and pinned. It went local once to survive a
third-party host disappearing, but at 76 MB it was most of the repo's 1 GB and
one play cost more than a class's month of bandwidth, so it is streamed from
the project's own player again. If that frame is ever refused, set
`"embed": False` in `scripts/extras.py` and the tile opens in a new tab
instead. (The player's iframe still asks for `pointer-lock`, without which
mouse-look is dead in games like it.)

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

## Getting the link out

The pages carry `noindex,nofollow`, so search engines will not send anybody.
Every visit starts with a link somebody pasted, which means two things: the
link needs a preview worth clicking, and it needs to say where it came from.

### Link previews

Both `index.html` and `files.html` carry `og:title`, `og:description`,
`og:image`, `og:url` and a `twitter:card`, so a pasted link renders as a card
with the 1200×630 `assets/img/share/og-cover.png` instead of a bare URL. The pages
stay `noindex`; these tags only shape the preview. The image URLs are absolute
and point at `https://funclassroom.github.io/`, so **if the site is served from
another domain, change those three `og:image` / `og:url` values** or the
preview will 404.

### Telling the channels apart

Clarity counts sessions; it does not say where they came from. Add `?ref=` to
any link you post and `assets/js/attribution.js` reads it, hands it to Clarity
as a custom tag called `channel`, and keeps it in `sessionStorage` so a visit
that starts on the wall and moves on to `files.html` stays credited to the same
channel. In the Clarity dashboard, break the recording list down by the
`channel` tag.

Post these, not the bare URL:

| Where | Link |
| --- | --- |
| Discord | `https://funclassroom.github.io/?ref=discord` |
| TikTok | `https://funclassroom.github.io/?ref=tiktok` |
| YouTube (description) | `https://funclassroom.github.io/?ref=youtube` |
| Reddit | `https://funclassroom.github.io/?ref=reddit` |
| GitHub repo | `https://funclassroom.github.io/?ref=github` |
| QR code in a classroom | `https://funclassroom.github.io/?ref=qr` |
| A friend, one to one | `https://funclassroom.github.io/?ref=wordofmouth` |

`?utm_source=` works the same way if a tag is forced on you, and the value is
lowercased and stripped to `[a-z0-9_-]` before it is used. The offline games
page takes the same parameters:
`https://funclassroom.github.io/files.html?ref=tiktok`.

## Progress and saves

Two different kinds of progress exist, and it is worth knowing which is which.

**What this site stores** — in this browser, under `classroom.state.v1`:

- titles you saved
- the last eight you opened, with timestamps and visit counts
- your sort choice, display preferences, and how far down the wall you had scrolled
- a "Pick up where you left off" card built from that history

Saved picks, history and preferences are not uploaded and there is no account.
The site pages load Microsoft Clarity for visit and session analytics; the
bundled HTML game files carry no analytics tag. **Export my data** creates a
JSON file locally; **Import data** restores it in this browser. The footer has
a two-step **Clear saved data** button. The separate **Clear offline
downloads** action removes downloaded game files from Cache Storage.

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

- Search titles and descriptions (multi-word: "car park" finds "Car Parking"), plus Popular / Top rated / A–Z / Least played
- Availability filters for offline files, in-page titles, and new-tab-only titles; game-type filters for action, puzzle, racing, sports, strategy and arcade
- Display options for dark mode, larger text and high contrast; reduced-motion follows the operating system setting
- "More like what you played" — suggestions derived on the device from titles
  you already opened, with nothing sent anywhere
- Save straight from the player, not just the tile
- 120 tiles to a page, with a **Show more** button, so a 16,000-title wall
  still paints in one frame
- Save titles, and a row of the last eight you opened
- `#p=<slug>` deep links, `Esc` to close, `/` to search, `` ` `` for a panic exit
- Tab cloaks (Classroom, Google, Docs), a blank-tab launcher and a quick exit
- **100% Unblocked** in the header: 138 titles that are plain files,
  on their own page, with no embed to load — plus filter and Surprise me
- Fullscreen, and an "open in a new tab" fallback if a title refuses to frame
- If a route fails, **Try another source** walks to the next one; if every one
  fails, the player says so, apologises, and offers the portal in a new tab
- Loading stays on screen until the frame answers, so a slow game is never a
  silent black page; local files show the same card
- A short help section explains keyboard shortcuts, publisher availability and
  local storage; report links create GitHub issues with the selected title
- A static GitHub Pages PWA caches the site shell; on the local-files page,
  **Save offline** downloads only the selected standalone HTML game to this
  browser. Those files can be removed separately. Publisher-hosted games still
  need the internet.

No frameworks, no build step, no server-side backend. The site is static on
GitHub Pages, with a same-origin service worker for optional offline caching.
`localStorage` and Cache Storage remain in this browser; the only site-level
analytics integration is the Microsoft Clarity tag in the head of the site
pages. The optional Hanger 2 debug editor no longer injects its remote dat.GUI
CDN script; normal game play is unaffected.

## The files that cannot be blocked

`files.html`, reached from **100% Unblocked** in the header, lists 138 titles
that ship with the site as plain HTML under `assets/games/`. No embed, no
portal, no third party that can refuse a frame: the page opens a file from its
own folder, and a filter aimed at a game site has nothing to act on.

140 of them come from [CoolDude2349's Offline HTML Games Pack](https://github.com/CoolDude2349/Offline-HTML-Games-Pack),
which collects 352 single-file games. All 352 would be 5.3 GB, so this site
carries a hand-picked set that fits inside the size budget: the small classics,
the heavy legends (Slope, Retro Bowl, OvO, Bad Piggies, Fireboy & Watergirl and
more) and the sequels of both.
**Minecraft is not one of them.** It was bundled here for a while — the
Eaglercraft 26.2 (zeus) download, a single 76 MB HTML file — but it is
streamed again from [eaglercraft.com](https://eaglercraft.com/play) and pinned
on the main wall, so the folder holds only titles that work with the network
off. That is also what took the folder from 895 MB down to 782 MB, and the
headroom from 46 MiB to 118 MiB.

### Picking which of the 352 to ship

Two limits decide the list. GitHub Pages stops building past a **1 GB source
tree**, so `tests/catalog.test.js` holds `assets/games/` to **900 MiB**. The
folder is now within about **118 MiB** of that project-level ceiling; a new
title has to be worth the megabytes it costs. The other limit is honesty: a
file that fetches its engine from a CDN is not an offline game, so it is not
shipped no matter how good the title is.

Every candidate is therefore screened before it is copied, and the checks are
the ones a school network would notice:

- no `<script src>` or `<link href>` pointing at a URL — the same rule the
  test suite enforces;
- no remote build. Unity, Defold and Godot ports keep their `.unityweb`,
  `.wasm` or `resources.zip` beside the HTML; when the pack copy still points
  at `cdn.jsdelivr.net` for that build (`Run 3`, `Sprunki`, `Ducklings.io`,
  `Cluster Rush`, `Crazy Cars`, `Rooftop Snipers 2`, `Space Waves`,
  `Ages of Conflict`, `Car King Arena`, `Tunnel Rush`, `Ragdoll Archers`,
  `Monkey Mart`) it is left out, because it needs the network;
- no payload it does not carry. A game must have at least 90% of its own bytes
  inlined as base64 or in an embedded zip, measured per file;
- no boot step waiting on a missing script. Several pack copies start with
  `await load("poki.js")` and stop there when it 404s — that excluded
  `Bad Ice Cream 2` and `3`, `Stick Merge` and `Basketball Legends`;
- no ad or redirect injection. `12 Mini Battles` loads an ad SDK through a
  look-alike domain, and the Eaglercraft downloads (`Indev`, `Alpha 1.2.6`,
  `Beta 1.3`) ship a Cloudflare analytics beacon, so those four are out;
- no pure-multiplayer title that has nothing to do without a server
  (`Yohoho.io`, `Hole.io`, `Cleanup.io`, `Snowball.io`);
- and nothing that a school network should not be asked to explain
  (`Pico's School`).

The remaining gap is size, not judgement. 210 titles in the pack are still
not here and would add about 4.4 GB. `Slope` and `Plants vs Zombies` were
removed again to keep the folder well clear of the ceiling, which is the same
trade every future title makes. Every one was downloaded at that revision
and screened against the rules above; 147 carry no external script, stylesheet,
beacon, ad marker or CDN build. Of those, the six in this batch open in
Chromium with external requests blocked and never ask for the network, and
thirteen more were checked the same way and booted but did not fit the
remaining megabyte budget: `Slope 3`, `Vex 7`, `Vex 8`, `Awesome Tanks`,
`Awesome Tanks 2`, `Vex X3M 2`, `Ice Dodo`, `Moto X3M`,
`Moto X3M 2`, `Moto X3M 3`, `Polytrack`, `KittyToy` and `Funny Battle`. They
are first in line when room appears. Beyond them are most of the Papa's restaurant series, the Snail Bob
and Wheely sequels, `Bloons TD 5` and `Angry Birds Space`, plus the few whose
pack copy is not really offline (`Geometry Dash` still pulls its sounds,
`Jetpack Joyride` still fetches its build from a CDN). Adding more means
removing something first, and the size check in the test suite is what makes
that argument happen out loud instead of at 1 GB.

A number of the pack's newer exports wrap the game in a `player.load(...)`
bootstrap that did not initialise in the test browser (`Bloons TD 5`,
`Duck Life 2` to `5`, `Motherload`, `Wheely`, `Snail Bob 2`, `Run`,
`Space is Key 2`, `Flood Runner 3` and `4`, `Earn to Die 2`, `Papa's Burgeria`,
`This is The Only Level Too`). The same wrapper also failed on files this site
already ships, so those copies were set aside rather than declared broken.

Card art for a new title is a screenshot the probe takes, so a freshly added
game shows a plain title card until `local-files.yml` has run once and
committed its real screenshot.

That is also why the folder is committed in the open rather than hidden behind
a download: 138 files at 782 MB is the whole site, and cloning it once is the
point. Because a `git clone` of the folder and a **Save linked file** produce
the same thing, the pack is also usable offline straight from the repository:
clone it, or copy `assets/games/` onto a memory stick, and every file in there
opens on its own in a browser with the network off.

`scripts/probe-files.mjs` serves the repo and opens every one of them in
Chromium, checking each returns 200 and actually paints. It also takes the
512×384 card screenshots in `assets/img/pack/`.
`.github/workflows/local-files.yml` runs it when a game changes and commits any
new screenshots.

## Files

```
index.html               the page
files.html               the 138 titles that are plain files
404.html                 not-found page
assets/games/*.html      the games themselves, straight from the offline pack
assets/img/pack/*.jpg    one screenshot per game, taken by the probe
assets/img/share/og-cover.png  the 1200x630 card a shared link shows
assets/css/app.css       all styling
assets/js/catalog.js     generated catalogue (17,568 rows)
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
only artwork the repo holds is the hand-written SVG tab icon and the 1200x630
share card. The one remote thumbnail is Minecraft's, which points at
eaglercraft.com's own version image because a streamed tile needs some art and
the pack screenshot went with the bundle.

AI-titled titles are no longer filtered — the old blocklist was removed when it
turned out to be hiding the one Veo title the feeds still carried.
