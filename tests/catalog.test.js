/* Catalogue + repository integrity. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, extra) {
  if (condition) {
    pass += 1;
    console.log("  \x1b[32mPASS\x1b[0m  " + name);
  } else {
    fail += 1;
    failures.push(name + (extra ? " -> " + extra : ""));
    console.log("  \x1b[31mFAIL\x1b[0m  " + name + (extra ? "  -> " + extra : ""));
  }
}

console.log("\nDATA — catalogue and repository\n");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/js/catalog.js"), "utf8"), sandbox);

const CATALOG = sandbox.window.CATALOG;
const slugs = CATALOG.map((g) => g.id);
const titles = CATALOG.map((g) => g.title);

check("catalogue is not empty", CATALOG.length > 100, String(CATALOG.length));
check("the old 506-title wall survived", CATALOG.length >= 506, String(CATALOG.length));
check("slugs are unique", new Set(slugs).size === slugs.length);
check("titles are unique", new Set(titles).size === titles.length);
check(
  "slugs are url-safe",
  slugs.every((s) => /^[a-z0-9-]+$/.test(s)),
  slugs.filter((s) => !/^[a-z0-9-]+$/.test(s)).join(", ")
);
check("every title is named", titles.every((t) => t.trim().length > 0));
check(
  "ratings sit between zero and five",
  CATALOG.every((g) => typeof g.rating === "number" && g.rating >= 0 && g.rating <= 5)
);
check(
  "play counts are whole numbers",
  CATALOG.every((g) => Number.isInteger(g.plays) && g.plays >= 0)
);
check(
  "routes never repeat a domain",
  CATALOG.every((g) => {
    const domains = new Set(g.sources.map((s) => new URL(s.url).hostname.split(".").slice(-2).join(".")));
    return domains.size === g.sources.length;
  })
);
check(
  "at most three routes per title",
  CATALOG.every((g) => g.sources.length <= 3)
);
check(
  "several independent embed hosts are in use",
  new Set(CATALOG.flatMap((g) => g.sources.map((s) => new URL(s.url).hostname))).size >= 3
);
check(
  "all 508 MadKid games are available as in-page sources",
  (() => {
    const mad = CATALOG.flatMap((g) => g.sources).filter((s) => s.portal === "madkidgames.com");
    return new Set(mad.map((s) => s.url)).size >= 508 && mad.every((s) =>
      s.embed === true && /^https:\/\/www\.madkidgames\.com\/full\/[a-z0-9-]+$/.test(s.url));
  })(),
  CATALOG.flatMap((g) => g.sources).filter((s) => s.portal === "madkidgames.com" && !s.embed).length + " not enabled"
);
check(
  "only MadKid routes are marked unembeddable",
  CATALOG.flatMap((g) => g.sources).every((s) => s.embed || s.portal === "madkidgames.com")
);
check(
  "every tile has at least one source",
  CATALOG.every((g) => Array.isArray(g.sources) && g.sources.length > 0)
);
check(
  "every source has a portal and an https url",
  CATALOG.every((g) =>
    g.sources.every((s) => typeof s.portal === "string" && /^https:\/\//.test(s.url))
  )
);
check(
  "sources say whether they can be framed",
  CATALOG.every((g) => g.sources.every((s) => typeof s.embed === "boolean"))
);
check(
  "frameable sources come before walled ones",
  CATALOG.every((g) => {
    const first = g.sources.findIndex((s) => s.embed === false);
    return first === -1 || g.sources.slice(first).every((s) => s.embed === false);
  })
);
check(
  "the wall starts with games that play in the page",
  (() => {
    const firstWalled = CATALOG.findIndex((g) => g.sources.every((s) => !s.embed));
    if (firstWalled === -1) return true;
    return CATALOG.slice(firstWalled).every((g) => g.sources.every((s) => !s.embed));
  })()
);
check(
  "no tile repeats a source url",
  CATALOG.every((g) => new Set(g.sources.map((s) => s.url)).size === g.sources.length)
);
check(
  "titles are not duplicated on the wall",
  new Set(CATALOG.map((g) => g.title.toLowerCase())).size === CATALOG.length
);
check(
  "every tile has a thumbnail",
  CATALOG.every((g) => /^https:\/\//.test(g.thumb) || /^assets\/img\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(g.thumb))
);
check(
  "the streamed Minecraft tile has been removed from the catalogue",
  !CATALOG.some((g) => g.id === "minecraft") &&
    CATALOG.every((g) => g.sources.every((s) => !/eymenwsmc|workers\.dev/.test(s.url))) &&
    CATALOG.every((g) => !g.pinned)
);
check(
  "Minecraft lives with the local files instead",
  /assets\/games\/minecraft\.html/.test(fs.readFileSync(path.join(ROOT, "assets/js/local-games.js"), "utf8")) &&
    fs.existsSync(path.join(ROOT, "assets/games/minecraft.html"))
);
check(
  "Minecraft is the one local title that leads the wall",
  (() => {
    const list = fs.readFileSync(path.join(ROOT, "assets/js/local-games.js"), "utf8");
    const featured = list.match(/featured: true/g) || [];
    return featured.length === 1 &&
      /file: "assets\/games\/minecraft\.html", title: "Minecraft", featured: true/.test(list);
  })()
);

/* ---------- files ---------- */
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "assets/js/app.js"), "utf8");
const notFound = fs.readFileSync(path.join(ROOT, "404.html"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

check("index loads the catalogue", /assets\/js\/catalog\.js/.test(index));
check(
  "the wall links to the local files",
  /<a[^>]+class="btn btn-local"[^>]+href="files\.html"/.test(index) &&
    fs.existsSync(path.join(ROOT, "files.html"))
);

/* ---------- the local games ---------- */
const filesPage = fs.readFileSync(path.join(ROOT, "files.html"), "utf8");
const localGames = fs.readFileSync(path.join(ROOT, "assets/js/local-games.js"), "utf8");
const listed = Array.from(localGames.matchAll(/(assets\/games\/[A-Za-z0-9._-]+\.html?)/g)).map((m) => m[1]);
const unique = Array.from(new Set(listed));

check("the local page lists more than a dozen files", unique.length >= 12, String(unique.length));
check("every listed file is in the folder", unique.every((rel) => fs.existsSync(path.join(ROOT, rel))));
check(
  "the folder holds nothing the page hides",
  fs.readdirSync(path.join(ROOT, "assets/games")).filter((n) => /\.html?$/.test(n)).length === unique.length
);
check(
  "every local game has a card title",
  (localGames.match(/title: "/g) || []).length === unique.length
);
check(
  "every local game says what it is in one line",
  (() => {
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(localGames, sandbox);
    return sandbox.window.LOCAL_GAMES.every(
      (game) => typeof game.line === "string" && game.line.length > 20 && /[.!?]$/.test(game.line.trim())
    );
  })()
);
check(
  "the local games do not need this site to be online",
  unique.every((rel) => {
    const file = fs
      .readFileSync(path.join(ROOT, rel), "utf8")
      .replace(/<!-- Cloudflare Web Analytics -->[\s\S]*?<!-- End Cloudflare Web Analytics -->/g, "");
    return !/<script[^>]+src=["']https?:/i.test(file) && !/<link[^>]+href=["']https?:[^"']*\.css/i.test(file);
  })
);
check(
  "every local game has a screenshot and nothing extra",
  (() => {
    const shots = fs.readdirSync(path.join(ROOT, "assets/img/pack")).filter((n) => n.endsWith(".jpg")).sort();
    const want = unique.map((rel) => path.basename(rel).replace(/\.html?$/, "") + ".jpg").sort();
    return shots.join(",") === want.join(",");
  })()
);
check(
  "each local game is a complete page",
  unique.every((rel) => {
    const file = fs.readFileSync(path.join(ROOT, rel), "utf8");
    return /<html|<head|<body/i.test(file) && /<canvas|<div|<body/i.test(file) && file.length > 20000;
  })
);
check(
  "the Wordle page's scripts parse",
  (() => {
    const rel = unique.find((file) => /wordle-unlimited\.html$/.test(file));
    if (!rel) return false;
    const file = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const scripts = Array.from(file.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
      .filter((m) => !/\bsrc\s*=/i.test(m[1] || ""))
      .map((m) => m[2]);
    return (
      scripts.length === 2 &&
      scripts.some((body) => body.includes('customElements.define("game-app"')) &&
      scripts.every((body) => {
        try {
          new vm.Script(body);
          return true;
        } catch (err) {
          return false;
        }
      })
    );
  })(),
  "a literal </script> in the bundle ends the script early and leaves a blank page"
);
check(
  "the local page credits where the files came from",
  /github\.com\/CoolDude2349\/Offline-HTML-Games-Pack/.test(filesPage)
);
// The whole site is served as a plain GitHub Pages source tree, and a
// published site may be no larger than 1 GB. The bundled games take most of
// that budget, so the folder is held to 900 MiB. That leaves roughly 48 MB
// under the published-site limit for the rest of the current site and a
// modest safety margin.
check(
  "the local files stay small enough to ship",
  unique.reduce((sum, rel) => sum + fs.statSync(path.join(ROOT, rel)).size, 0) < 900 * 1024 * 1024
);

check("index loads the app", /assets\/js\/app\.js/.test(index));
check("index loads the one stylesheet", /assets\/css\/app\.css/.test(index));
check("index has no old dual-skin leftovers", !/gamekit|data-mode|mode-classroom/i.test(index));
check("index has no hero wordmark", !/class="hero"|class="wordmark"/.test(index));
check(
  "every local asset referenced exists",
  Array.from(index.matchAll(/(?:src|href)="((?!https?:|data:|#)[^"]+)"/g))
    .map((m) => m[1].split("?")[0])
    .every((rel) => fs.existsSync(path.join(ROOT, rel)))
);
check(
  "AI titles are no longer filtered out",
  !/ai-token|AI_TOKENS|is_ai/.test(fs.readFileSync(path.join(ROOT, "scripts/build-catalog.py"), "utf8"))
);
check(
  "no loose photographs sit beside the pack screenshots",
  fs.readdirSync(path.join(ROOT, "assets/img")).filter((f) => /\.(png|jpe?g|webp)$/.test(f)).length === 0
);
check(
  "saved state never leaves the device",
  !/sendBeacon|XMLHttpRequest|navigator\.send/.test(app) &&
    !/fetch\([\s\S]{0,200}body:/.test(app) &&
    !/fetch\([\s\S]{0,200}JSON\.stringify/.test(app)
);
check(
  "the page makes no network requests of its own",
  (app.match(/window\.fetch\(/g) || []).length === 0
);
check("all persistence uses one namespaced key", (app.match(/localStorage/g) || []).length > 0 && app.includes("classroom.state.v1"));
check("the page offers a way to wipe its own data", /data-reset/.test(index));
check("the old game files are gone", !fs.existsSync(path.join(ROOT, "assets/js/games")));
check("portal adapters exist", fs.existsSync(path.join(ROOT, "scripts/portals.py")));
check(
  "the builder groups by title so duplicates collapse",
  /groups\[key\]/.test(fs.readFileSync(path.join(ROOT, "scripts/build-catalog.py"), "utf8"))
);
check(
  "the builder refuses to shrink the wall",
  /refusing to write/.test(fs.readFileSync(path.join(ROOT, "scripts/build-catalog.py"), "utf8"))
);
check("the old toolkit is gone", !fs.existsSync(path.join(ROOT, "assets/js/gamekit.js")));
check("the 404 page links home", /href="\.\/"/.test(notFound));
check("the 404 page wears the same skin", /assets\/css\/app\.css/.test(notFound));
check("the 404 page keeps the wordmark", notFound.includes("G@M£$"));
check("package version is 4.x", /^4\./.test(pkg.version), pkg.version);
check("npm test runs both suites", /ui\.test\.js/.test(pkg.scripts.test) && /catalog\.test\.js/.test(pkg.scripts.test));
check("no build step is required", !pkg.scripts.build);
check("README explains the disguise", /tab reads \*\*Classroom\*\*/i.test(readme));
check("README states the MadKid count", readme.includes("508"));

console.log("\n  DATA: " + pass + " passed, " + fail + " failed\n");
if (fail) {
  failures.forEach((f) => console.log("   - " + f));
  process.exitCode = 1;
}
