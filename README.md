# MadKid Classroom

A **self-contained HTML5 arcade** wearing a **Google Classroom disguise**.
One shortcut flips the whole page — tab title, favicon, layout and all —
between seven playable games and a convincing Classroom account.

No build step. No framework. No external requests at runtime — not even a
font CDN. Open `index.html` from `file://`, serve it from GitHub Pages, or
drop the folder on any static host.

---

## The two modes

|  | **Games mode** | **Classroom mode** |
|---|---|---|
| Looks like | A dark arcade library | Google Classroom on a student account |
| Tab title | `MadKid Games — Play free HTML5 games` | `Classes` → class → assignment |
| Favicon | Purple gamepad | Green Classroom cap |
| A game is | A card with its real title | An assignment in a class |

### Switching

| Control | Action |
|---|---|
| **Ctrl / ⌘ + Shift + K** | Toggle modes instantly, from anywhere |
| **`` ` ``** (backtick) | Same toggle, when not typing in a field |
| **Apps icon** in the Classroom header | Toggles to games without advertising it |
| **Games view** at the bottom of the drawer | Same toggle, deliberately labelled |
| **Classroom mode** in the games header | Toggle back |
| **Esc** | Close drawer → close activity → leave class → home |

Switching while a game is open **does not remount it**. The same stage element
is moved into the other skin, so the canvas, score and physics keep running.
Only one game is ever mounted at a time.

---

## The seven games

| Game | Genre | Controls | Classroom disguise |
|---|---|---|---|
| **Snake** | Arcade | Arrows / WASD · swipe | Biology — *Lab 7, Predator & Prey* |
| **Brick Breaker** | Arcade | Mouse / finger · ← → · click to serve | Physics — *Unit 4, Energy Transfer* |
| **Sky Dash** | Action | Space / click / tap | PE — *Fitness Log, Endurance Unit* |
| **2048** | Puzzle | Arrows / WASD · swipe | Maths — *Powers of Two Warm-Up* |
| **Minesweeper** | Puzzle | Click · right-click to flag | Chemistry — *Periodic Trends Review* |
| **Memory Match** | Puzzle | Click / tap | English — *Vocabulary Week 8* |
| **Paddle Duel** | Sports | Mouse / finger · ↑ ↓ | CS — *Event Loops & Collision* |

Everything is original code in this repo. Best scores are saved per game in
`localStorage` (`madkid.arcade.best.v1`) and shown on the cards and in the
games player. Times and move counts use lowest-is-best; everything else uses
highest-is-best.

### Classroom details that matter

- **Home** — seven class cards, Join class (asks for the code), Archived classes.
- **Class** — a coloured banner, Stream / Classwork / People tabs, a real
  assignment posted by the teacher, an announcement feed and an *Upcoming*
  sidebar.
- **Classwork** — the playable assignment plus filler rows that politely
  explain they have no attachment.
- **People** — the teacher and an eleven-student roster, with the signed-in
  student marked *(you)*.
- **Drawer** — Classes, Calendar, To-do; the calendar and to-do entries are
  empty because it is a demo.
- **Composer** — clicking “Announce something to your class” explains that
  only teachers can post. The account is a student, so it should refuse.
- **Disguise discipline** — Classroom mode names activities after the
  *assignment*, never after the game. Real game titles only appear once you
  are in Games mode or inside the activity itself.

---

## Run it

```bash
npm start          # python3 -m http.server 8000 --bind 0.0.0.0
# open http://localhost:8000
```

Or just open `index.html`. There is no build, no bundler and no server-side
anything.

### Tests

```bash
npm install
npm test
```

| Suite | Checks | Covers |
|---|---|---|
| `tests/ui.test.js` | 76 | First paint, all Classroom levels, player mount/teardown, live mode switching, title/favicon, search, chips, drawer, hotkeys, escaping, score cards |
| `tests/games.test.js` | 40 | Catalog integrity, registry wiring, high/low score records, every game mounting, DOM game interactions, animation loops for all four canvas games |

Both suites drive the real DOM through jsdom. That is 116 checks in total. jsdom has no canvas, so the
tests exercise both paths: the visible fallback when `getContext` is missing,
and the actual game loop with a stub 2D context. That is how a broken draw
call gets caught without a browser in CI.

---

## Deploy to GitHub Pages

1. Push the branch you want to serve.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Pick that branch and `/ (root)`.

`.nojekyll` is included so Pages serves the files untouched. If you make a
non-`main` branch the repository default, GitHub Pages does **not** follow
automatically — the Pages source is a separate setting and must be changed as
well.

---

## Adding a game

A game is a small file that registers an id, plus one catalog entry.

**1. Create `assets/js/games/my-game.js`:**

```js
Arcade.register({
  id: "my-game",
  mount: function (root) {
    const g = GameKit.canvas(root, 800, 520);   // fixed logical size
    if (!g.ctx) return { destroy() {} };        // jsdom / no-canvas fallback

    const stop = GameKit.loop((dt) => {
      // update(dt); draw(ctx);  dt is seconds, clamped to 0.05
    });

    return { destroy: stop };                   // called on close
  },
});
```

**2. Add `<script src="assets/js/games/my-game.js"></script>`** in
`index.html`, before `app.js`.

**3. Add an entry to `assets/js/catalog.js`:**

```js
{
  id: "my-game",
  title: "My Game",
  tagline: "One line for the card.",
  category: "Arcade",                 // All | Arcade | Action | Puzzle | Sports
  tags: ["search", "words"],
  ratio: 1.538,                       // width / height of the play surface
  controls: "Arrows · swipe",
  scoreType: "high",                  // "high" or "low"
  scoreLabel: "Best score",
  scoreFormat: "number",              // "number" | "time" | "moves"
  art: { bg: "linear-gradient(...)", fg: "#fff", glyph: "<svg ...>" },
  class: {
    subject: "Geography",
    section: "Period 2 · Room 118",
    teacher: "Mr. Bell",
    email: "dbell@northfield.edu",
    assignment: "Map Skills — Contour Practice",
    due: "Friday, 11:59 PM",
    points: 10,
    color: "#1967d2",
    instructions: ["First step.", "Second step.", "Third step."],
  },
}
```

The class card, Stream post, Classwork row, assignment page and tab titles all
come from that one object.

### GameKit

`assets/js/gamekit.js` is intentionally small:

| Helper | Does |
|---|---|
| `GameKit.canvas(root, W, H)` | DPR-aware canvas at a fixed logical size; returns `{ canvas, ctx, wrap, W, H }` |
| `GameKit.loop(fn)` | requestAnimationFrame loop, `dt` in seconds, capped at 50ms; returns `stop()` |
| `GameKit.keys({ down, up, prevent })` | Window key handling that ignores form fields; returns `off()` |
| `GameKit.swipe(el, fn)` | Swipe direction helper for touch; returns `off()` |
| `GameKit.overlay(root)` | Start / pause / game-over panel |
| `GameKit.getBest(id)` / `setBest(id, value, mode)` | Persistent records; `mode` is `"high"` or `"low"` |
| `GameKit.formatTime(seconds)` | `0:07`, `1:05` |
| `GameKit.roundedRect`, `point`, `clamp`, `randInt`, `announce` | The usual small stuff |

---

## What changed from v1

The first version of this site **did not contain any games**. It shipped
placeholder `madkidgames.com` URLs in an iframe catalog; every card opened a
blank frame, and external game portals commonly send `X-Frame-Options` or a
CSP `frame-ancestors` rule that will block an iframe no matter what the page
does.

This rebuild removes that whole approach:

- **No iframes.** Seven games are implemented in this repo, so they work on
  Pages, offline, on a school Chromebook, and behind a filter once the page
  has loaded.
- **No placeholder URLs.** Nothing to fill in before the site works.
- **No external assets.** Icons are an inline SVG sprite, favicons are data
  URIs, and the font stack is local. The page makes zero network requests
  after the HTML/CSS/JS is loaded.
- **No add-game modal.** The catalog is a plain array in `catalog.js`; the
  README shows the shape. Custom `localStorage` entries are gone because they
  cannot be shared between devices and half the old ones pointed at dead
  iframes.
- **The joke stays out of the disguise.** The old “a filter owes you money”
  notice sat in every Classroom Stream, which made the disguise look fake.
  It now lives once, in the games-mode footer, clearly marked as satire.
- **Rewritten tests.** 116 DOM checks including a live mode switch with a game
  running, hostile-input escaping, and all four canvas loops.

### A note on the satire

The games footer still contains the one-line “a filter owes you one (1)
unpaid debt” joke. It is satire, not legal advice, and it has no legal effect.
A page cannot create a debt, and network filters block by domain long before
this JavaScript runs. It is there because it is funny.

---

## File map

```
index.html                 both skins, icon sprite, drawer, player host
404.html                   Classroom-styled not-found page
assets/css/app.css         both skins, game surfaces, responsive rules
assets/js/gamekit.js       tiny toolkit + Arcade registry
assets/js/catalog.js       game catalog + Classroom cast/roster
assets/js/app.js           views, routing, player, mode switching, hotkeys
assets/js/games/snake.js
assets/js/games/breakout.js
assets/js/games/skydash.js
assets/js/games/g2048.js
assets/js/games/minesweeper.js
assets/js/games/memory.js
assets/js/games/pong.js
tests/ui.test.js
tests/games.test.js
```

---

## Browser support

Current Chrome, Edge, Firefox and Safari. Uses `aspect-ratio`, CSS custom
properties, `inert`, `localStorage`, pointer events and `requestFullscreen`
(with a graceful toast if it is unavailable). Keyboard focus rings and
`prefers-reduced-motion` are respected.
