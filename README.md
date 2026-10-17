# MadKid Classroom

A static HTML5 game library that doubles as a **Google Classroom clone**.
One keyboard shortcut flips the whole page — tab title, favicon, layout and
all — between the real games view and a convincing Classroom disguise.

No build step, no dependencies to serve, no framework. Plain HTML/CSS/JS that
runs from GitHub Pages, Netlify, or `file://`.

---

## The two modes

| | **Games mode** | **Classroom mode** |
|---|---|---|
| What you see | Real game names, thumbnails, categories, search | Subjects, teachers, periods, announcements |
| Tab title | `MadKid Games — Play HTML5 Games` | `Classes` → the subject → the assignment |
| Favicon | Purple gamepad | Green Classroom cap |
| A game appears as | Its actual title | A class card, then an "assignment" |

### Switching

| Control | Action |
|---|---|
| **Ctrl + Shift + K** | Instantly toggle between modes |
| **`` ` ``** (backtick) | Same toggle, when not typing in a field |
| **Esc** | Close the open game → then back out of the class |
| Header **Apps** button | Toggles mode (labelled to match Google Workspace) |
| Games-mode **Hide** button | Jumps straight to Classroom mode |

A running game survives the switch: it stays open and is simply re-skinned,
so you do not lose your place. Only one iframe is ever live at a time.

### Classroom navigation

Mirrors the real product's depth so it reads as genuine at a glance:

```
Classes grid  →  Class page (Stream / Classwork / People)  →  Assignment (the game)
```

- **Stream** — announcement composer, an "assignment posted" card, the pinned
  notice below, decorative teacher announcements, and an *Upcoming* sidebar.
- **Classwork** — the real assignment (opens the game) plus filler rows.
- **People** — teacher and a roster of students.
- **Hamburger menu** — Classes / Calendar / To-do drawer.

---

## ⚠️ Before it works: add your real game URLs

`assets/js/games.js` ships with **placeholder URLs** — the build sandbox had
no access to `madkidgames.com`, so nothing could be scraped. Replace the
`url` field on each entry:

```js
{
  id: "slope",                                   // unique slug
  title: "Slope",                                // shown in Games mode
  url: "https://www.madkidgames.com/html5-games/slope/",   // <-- your real URL
  thumb: "https://www.madkidgames.com/…/slope.jpg",        // optional
  category: "Arcade",
  tags: ["slope", "3d", "running"],
  class: {                                       // the disguise, Classroom mode only
    subject: "Mathematics",
    section: "Period 3 · Room 204",
    teacher: "Mr. Anderson",
    assignment: "Unit 4 — Practice Set (Due Friday)",
    color: "#1e8e3e"
  }
}
```

Prefer not to touch code? Use **+ Add game** in the header. Paste a URL and
it is saved to `localStorage` in that browser. Leave the disguise fields blank
and a plausible subject, teacher and period are generated from the category —
**never** from the game's real title, so a blank form cannot leak what it is
hiding.

> `localStorage` entries are per-browser. Anything you want on every device
> belongs in `games.js`.

### If a game shows up blank

Some hosts send `X-Frame-Options: DENY` or a CSP `frame-ancestors` directive,
which makes an iframe render empty. Cross-origin blocking cannot be detected
from JavaScript, so after 8 seconds the player shows an explanation. Two ways
out:

1. Click **Open in a new tab** (present in both player skins).
2. Point the entry at the game's direct embed URL instead of the page that
   wraps it — usually something ending in `index.html`, or an `/embed/` path.

Games served from your own domain will not have this problem.

---

## Embedding a single game on another site

`embed.html` exists for this. From any page on `madkidgames.com` or elsewhere:

```html
<iframe
  src="https://<your-username>.github.io/Classroom/embed.html?game=slope"
  style="width: 100%; aspect-ratio: 16 / 9; border: 0;"
  allow="autoplay; fullscreen; gamepad"
  allowfullscreen
  loading="lazy">
</iframe>
```

| Parameter | Meaning |
|---|---|
| `?game=<id>` | An `id` from `games.js`, or a browser-saved custom game |
| `?src=<url>` | A direct URL — **must** be on an allowed host |
| `?title=<text>` | Override the tab title when using `?src` |
| `?chrome=1` | Keep the fullscreen button always visible |

`?src=` is checked against `ALLOWED_HOSTS` at the top of `embed.html`
(`www.madkidgames.com`, `madkidgames.com` by default). Anything else —
including `javascript:` URLs — is refused with a visible error. Add your own
domains to that array. This stops your embed page from becoming an open
proxy for arbitrary third-party content.

---

## The "Securly" notice

You asked for a line saying a filter that blocks the site owes you money or
can be sued. It appears in two places:

- as a **pinned announcement** in every Classroom Stream, and
- as a **banner** at the top of the Games library.

Both are written as obvious satire and both carry a visible disclaimer
(`Satire · not legal advice · do your homework anyway`).

Straight answer on that: it is a joke and it works as a joke. It has **zero**
legal effect. A page cannot create a debt or a cause of action by declaring
one, and a real dispute with a school's filtering vendor would need an actual
lawyer — and, for a minor, a parent or guardian to sign anything. Worth
knowing too that a UI disguise does not defeat a network filter at all:
Securly blocks by domain and DNS, which happens long before your page's
JavaScript runs. If the domain is blocked, this page never loads in the first
place, notice included. Keep it for the laugh, not as a strategy.

---

## Deploy to GitHub Pages

```bash
git push origin main
```

Then **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Your site lands at `https://<your-username>.github.io/Classroom/`.

`.nojekyll` is included so Pages serves the files as-is.

Run it locally instead:

```bash
npm start          # python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Tests

Both suites drive the real DOM through jsdom — they click, type and press
keys rather than calling functions directly.

```bash
npm install
npm test
```

| Suite | Covers |
|---|---|
| `tests/app.test.js` | **79 checks** — first paint, all three Classroom levels, iframe mount/teardown, mode switching with a game running, search, filters, hotkeys, the add-game modal, validation, and XSS escaping |
| `tests/embed.test.js` | **9 checks** — catalog lookup, host allowlist, `javascript:` refusal, unknown-id and missing-param errors |

Two of those checks matter more than they look. Every value that reaches the
DOM passes through an `esc()` helper, and a hostile `title` or `subject`
containing `<script>` or `<img onerror=…>` is asserted to render as literal
text. That is worth keeping, because game titles and thumbnails are exactly
the kind of data that eventually comes from somewhere you do not control.

---

## File map

```
index.html              app shell: both modes, drawer, add-game modal
embed.html              single-game embeddable widget with a host allowlist
assets/js/games.js      ← EDIT THIS: the game catalog + Classroom metadata
assets/js/app.js        state, rendering, mode switching, hotkeys
assets/css/style.css    both skins (Google Classroom clone + games library)
tests/                  jsdom smoke suites
.nojekyll               disables Jekyll processing on GitHub Pages
```

Fonts and Material Icons load from Google's CDN with system fallbacks, so the
page still works if that request is blocked.
