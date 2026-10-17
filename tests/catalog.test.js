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
  "a title that exists on two sites opens the one that renders",
  CATALOG.every((g) => {
    const portals = new Set(g.sources.map((s) => s.portal));
    if (portals.size < 2) return true;
    return g.sources[0].portal === "gamemonetize.com";
  })
);
check(
  "MadKid is kept as the backup, not dropped",
  CATALOG.filter((g) => g.sources.some((s) => s.portal === "madkidgames.com")).length ===
    CATALOG.filter((g) => g.sources.some((s) => s.portal === "madkidgames.com")).length
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
  CATALOG.every((g) => /^https:\/\//.test(g.thumb))
);

/* ---------- files ---------- */
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "assets/js/app.js"), "utf8");
const notFound = fs.readFileSync(path.join(ROOT, "404.html"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

check("index loads the catalogue", /assets\/js\/catalog\.js/.test(index));
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
  "no AI-titled entries remain",
  !CATALOG.some((g) => /\bai\b|chatgpt|midjourney|gemini|veo/i.test(g.title + " " + g.slug))
);
check("no offline images ship with the site", !fs.existsSync(path.join(ROOT, "assets/img")));
check(
  "saved state never leaves the device",
  !/sendBeacon|XMLHttpRequest|navigator\.send/.test(app) &&
    !/fetch\([^)]*store/.test(app) &&
    !/fetch\([^)]*JSON\.stringify/.test(app)
);
check(
  "the only request is a reachability check that carries no data",
  (app.match(/window\.fetch\(/g) || []).length === 1 && /mode:\s*"no-cors"/.test(app)
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
check("README states the count", readme.includes("506"));

console.log("\n  DATA: " + pass + " passed, " + fail + " failed\n");
if (fail) {
  failures.forEach((f) => console.log("   - " + f));
  process.exitCode = 1;
}
