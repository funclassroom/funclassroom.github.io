/* Drives the real DOM the way a student would: clicks, keys, typing. */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => errors.push(error.message));

const dom = new JSDOM(html, {
  url: "http://localhost:8000/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  virtualConsole,
});

const { window } = dom;
const { document } = window;

// jsdom has no canvas implementation; the games are expected to degrade
// to a readable message rather than throw.
window.HTMLCanvasElement.prototype.getContext = function () { return null; };
window.addEventListener("error", (event) => errors.push(event.message));

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

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const click = (node) => node.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const key = (k, opts = {}) => document.dispatchEvent(new window.KeyboardEvent("keydown", Object.assign({ key: k, bubbles: true, cancelable: true }, opts)));
const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function bootScripts() {
  [
    "gamekit",
    "catalog",
    "games/snake",
    "games/breakout",
    "games/skydash",
    "games/g2048",
    "games/minesweeper",
    "games/memory",
    "games/pong",
    "app",
  ].forEach((file) => {
    window.eval(fs.readFileSync(path.join(ROOT, "assets/js", file + ".js"), "utf8"));
  });
}

async function main() {
  if (document.readyState !== "complete") {
    await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  }
  bootScripts();

  /* ---------- first paint ---------- */
  check("starts in Classroom mode", document.body.dataset.mode === "classroom");
  check("starts with a Classroom tab title", document.title === "Classes", document.title);
  check("home heading is present", $("#gc-view h1") && $("#gc-view h1").textContent === "Your classes");
  check("renders every class card", $$(".gc-card").length === 7, String($$(".gc-card").length));
  check("renders the Join class tile", !!$(".gc-join[data-action='join']"));
  check("games mode is hidden", $("#mode-games").hidden === true);

  /* ---------- class page ---------- */
  click($('.gc-card[data-id="snake"]'));
  check("class banner shows the subject", $(".gc-banner h1").textContent === "Biology");
  check("class page has three tabs", $$(".gc-tab").length === 3);
  check("tab title follows the class", document.title === "Biology", document.title);
  check("stream has the assignment attachment", !!$(".gc-attach[data-action='open-game']"));
  check("stream has multiple posts", $$(".gc-post").length >= 3, String($$(".gc-post").length));

  click($('[data-tab="people"]'));
  check("people tab lists the teacher and students", $$(".gc-person").length === 12, String($$(".gc-person").length));
  check("people tab marks the signed-in student", $(".gc-people").textContent.includes("(you)"));

  click($('[data-tab="classwork"]'));
  check("classwork tab lists assignments", $$(".gc-cw-row").length >= 2, String($$(".gc-cw-row").length));
  check("classwork row points at the real activity", $(".gc-cw-row").getAttribute("data-id") === "snake");

  click($('[data-tab="stream"]'));
  check("stream tab can be reopened", $(".gc-tab.active").getAttribute("data-tab") === "stream");

  /* ---------- assignment / player ---------- */
  click($(".gc-attach"));
  check("assignment opens the player", $("#player").hidden === false);
  const snakeEntry = window.GAME_CATALOG.find((game) => game.id === "snake");
  check("player shows the disguised assignment", $(".assignment-title h1").textContent === snakeEntry.class.assignment, $(".assignment-title h1").textContent);
  check("assignment title is in the tab", document.title.indexOf("Biology") !== -1, document.title);
  check("game stage exists", !!$("#game-stage"));
  check("game stage is mounted in the assignment", !!$(".material-stage #game-stage"));
  check("canvas games degrade without canvas", !!$("#game-stage .gk-fallback"));
  check("page is locked while playing", document.body.classList.contains("playing"));
  check("classroom activity does not leak the game name", !$(".material-head").textContent.includes(snakeEntry.title));
  const ids = $$("[id]").map((node) => node.id);
  check("no duplicate ids while playing", new Set(ids).size === ids.length, ids.join(","));
  check("no undefined text is rendered", !document.body.textContent.includes("undefined"));

  click($('[data-action="mark-done"]'));
  check("Mark as done updates the status", $("[data-turnin-status]").textContent === "Done");
  click($('[data-action="mark-done"]'));
  check("Mark as done can be undone", $("[data-turnin-status]").textContent === "Assigned");

  key("Escape");
  check("Escape closes the assignment", $("#player").hidden === true);
  check("Escape returns to the class page", document.title === "Biology", document.title);

  /* ---------- live mode switch while a game is open ---------- */
  click($(".gc-attach"));
  const stageBefore = $("#game-stage");
  const canvasBefore = stageBefore.querySelector("canvas");

  key("K", { ctrlKey: true, shiftKey: true });
  check("Ctrl+Shift+K switches to games with a game open", document.body.dataset.mode === "games");
  check("the player stays open across the switch", $("#player").hidden === false);
  check("games player chrome is used", !!$(".mk-playbar"));
  check("games mode layer is visible", $("#mode-games").hidden === false);
  check("classroom layer is hidden", $("#mode-classroom").hidden === true);
  check("the same stage element survives", $("#game-stage") === stageBefore);
  check("the same canvas survives", $("#game-stage canvas") === canvasBefore);
  check("tab title switches to the game", document.title === "Snake — MadKid Games", document.title);

  key("`");
  check("backtick switches back to Classroom", document.body.dataset.mode === "classroom");
  check("assignment chrome is back", !!$(".assignment-title"));
  check("tab title returns to the assignment", document.title.includes("Biology"), document.title);

  click($('#player [data-action="close-player"]'));
  check("closing the player hides it", $("#player").hidden === true);
  check("closing returns to the class", document.title === "Biology", document.title);

  key("Escape");
  check("Escape leaves the class", $("#gc-view h1") && $("#gc-view h1").textContent === "Your classes");
  check("home title is restored", document.title === "Classes", document.title);

  /* ---------- games mode ---------- */
  key("`");
  check("backtick opens games mode", document.body.dataset.mode === "games");
  check("games grid shows all seven games", $$(".mk-card").length === 7, String($$(".mk-card").length));
  check("games tab title is set", document.title.indexOf("MadKid Games") !== -1, document.title);

  const search = $("#mk-search");
  type(search, "snake");
  check("search narrows the grid", $$(".mk-card").length === 1, String($$(".mk-card").length));

  type(search, '<img src=x onerror="window.__xss=1">');
  check("no results state is escaped", $(".mk-empty") && $(".mk-empty").innerHTML.includes("&lt;img"));
  check("hostile search input is not executed", window.__xss === undefined);
  check("hostile search input creates no element", !$(".mk-empty img"));

  click($('[data-action="clear-filters"]'));
  check("clear filters restores the grid", $$(".mk-card").length === 7);

  click($('[data-action="category"][data-cat="Puzzle"]'));
  check("category chips filter the grid", $$(".mk-card").length === 3, String($$(".mk-card").length));
  check("category count is rendered", $(".mk-count").textContent === "3 games", $(".mk-count").textContent);

  click($('[data-action="category"][data-cat="All"]'));
  window.GameKit.setBest("snake", 321, "high");
  click($('[data-action="category"][data-cat="All"]'));
  check("best scores appear on cards", $('.mk-card[data-id="snake"]').textContent.includes("321"));

  click($('.mk-card[data-id="2048"]'));
  check("dom game opens in the games player", !!$(".mk-playbar") && !!$("#game-stage .g2048"));
  check("2048 renders sixteen cells", $$("#game-stage .g2048-cell").length === 16, String($$("#game-stage .g2048-cell").length));
  check("game title is in the tab", document.title === "2048 — MadKid Games", document.title);
  click($("#game-stage .gk-btn"));
  click($("#game-stage .g2048-new"));
  check("New game keeps the board alive", $$("#game-stage .g2048-cell").length === 16);

  click($('#player [data-action="close-player"]'));
  check("closing a games-player returns to browse", $("#player").hidden === true && document.title.indexOf("MadKid Games") !== -1);

  /* ---------- drawer, toast, search keys ---------- */
  key("`");
  check("classroom remembers the last class", $(".gc-banner h1").textContent === "Mathematics");
  key("Escape");

  click($('[data-action="drawer"]'));
  check("drawer opens", $("#drawer-scrim").hidden === false);
  click($(".gc-drawer"));
  check("clicking the drawer body keeps it open", $("#drawer-scrim").hidden === false);
  key("Escape");
  check("Escape closes the drawer", $("#drawer-scrim").hidden === true);

  click($('[data-action="drawer"]'));
  click($('.gc-drawer-item[data-action="home"]'));
  check("drawer navigation closes the drawer", $("#drawer-scrim").hidden === true);
  check("drawer navigation returns home", $("#gc-view h1").textContent === "Your classes");

  click($('.gc-card[data-id="snake"]'));
  click($(".gc-compose"));
  check("composer explains the permission model", $("#toast").textContent.includes("Only teachers"));
  check("toast becomes visible", $("#toast").classList.contains("show"));

  key("`");
  key("/");
  check("slash focuses search", document.activeElement === search);
  search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "`", bubbles: true, cancelable: true }));
  check("backtick is ignored while typing", document.body.dataset.mode === "games");

  type(search, "pong");
  key("Escape");
  check("Escape clears the search", search.value === "" && $$(".mk-card").length === 7);
  click($(".mk-brand"));
  check("brand link resets filters", $$(".mk-card").length === 7 && search.value === "");

  check("GameKit is exposed for the app", typeof window.GameKit.setBest === "function");
  check("Arcade registered every game", window.Arcade.ids().length === 7, String(window.Arcade.ids().length));

  await tick(30);

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));

  console.log("\n  UI: " + pass + " passed, " + fail + " failed");
  if (fail) {
    console.log("  Failures:\n    " + failures.join("\n    "));
    process.exitCode = 1;
  }

  dom.window.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
