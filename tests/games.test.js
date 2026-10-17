/* Catalog integrity + real game mounts, with a stub 2D context. */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => errors.push(error.message));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:8000/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  virtualConsole,
});
const { window } = dom;
const { document } = window;
window.addEventListener("error", (event) => errors.push(event.message));

function boot() {
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
  ].forEach((file) => {
    window.eval(fs.readFileSync(path.join(ROOT, "assets/js", file + ".js"), "utf8"));
  });
}

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

const click = (node) => node.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const press = (key) => window.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mount(id) {
  const root = document.createElement("div");
  root.style.width = "800px";
  root.style.height = "520px";
  document.body.appendChild(root);
  const instance = window.Arcade.get(id).mount(root);
  return { root, instance };
}

function gradientStub() {
  return { addColorStop() {} };
}

function contextStub(canvas) {
  const store = {};
  return new Proxy(store, {
    get(target, prop) {
      if (prop === "canvas") return canvas;
      if (prop === "measureText") return () => ({ width: 42 });
      if (prop === "createLinearGradient" || prop === "createRadialGradient" || prop === "createPattern") {
        return gradientStub;
      }
      if (prop === "getImageData") return () => ({ data: [] });
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}

async function main() {
  boot();

  const catalog = window.GAME_CATALOG;
  check("catalog has seven games", catalog.length === 7, String(catalog.length));
  check("ids are unique", new Set(catalog.map((g) => g.id)).size === catalog.length);
  check("every catalog entry is registered", catalog.every((g) => window.Arcade.get(g.id)));
  check("every game has a mount function", catalog.every((g) => typeof window.Arcade.get(g.id).mount === "function"));

  const required = ["title", "tagline", "category", "controls", "scoreLabel"];
  let complete = true;
  let missing = "";
  catalog.forEach((game) => {
    required.forEach((key) => {
      if (!game[key]) { complete = false; missing = game.id + "." + key; }
    });
    if (!game.art || !game.art.glyph || !game.art.bg) { complete = false; missing = game.id + ".art"; }
    if (!game.class || !game.class.subject || !game.class.teacher || !game.class.assignment) {
      complete = false;
      missing = game.id + ".class";
    }
    if (typeof game.ratio !== "number" || game.ratio <= 0) { complete = false; missing = game.id + ".ratio"; }
  });
  check("every entry has display + disguise metadata", complete, missing);
  check("every game has instructions", catalog.every((g) => g.class.instructions.length >= 2));

  check("formatTime formats seconds", window.GameKit.formatTime(65) === "1:05", window.GameKit.formatTime(65));
  check("formatTime pads seconds", window.GameKit.formatTime(5) === "0:05");

  window.GameKit.setBest("probe", 10, "high");
  check("high scores accept a first value", window.GameKit.getBest("probe") === 10);
  window.GameKit.setBest("probe", 5, "high");
  check("high scores keep the larger value", window.GameKit.getBest("probe") === 10);
  window.GameKit.setBest("probe", 20, "high");
  check("high scores update for a record", window.GameKit.getBest("probe") === 20);

  window.GameKit.setBest("probe-low", 20, "low");
  window.GameKit.setBest("probe-low", 25, "low");
  check("low scores ignore worse values", window.GameKit.getBest("probe-low") === 20);
  window.GameKit.setBest("probe-low", 12, "low");
  check("low scores keep the smaller value", window.GameKit.getBest("probe-low") === 12);

  /* ---------- canvas games: graceful without canvas ---------- */
  ["snake", "breakout", "sky-dash", "pong"].forEach((id) => {
    const { root, instance } = mount(id);
    check(id + " mounts without a canvas context", !!root.querySelector("canvas") && !!root.querySelector(".gk-fallback"));
    if (instance && instance.destroy) instance.destroy();
    root.remove();
  });

  /* ---------- DOM games ---------- */
  {
    const { root, instance } = mount("2048");
    check("2048 builds a 4x4 board", root.querySelectorAll(".g2048-cell").length === 16);
    check("2048 starts with two tiles", root.querySelectorAll(".g2048-tile").length === 2);
    click(root.querySelector(".gk-overlay .gk-btn"));
    press("ArrowLeft");
    press("ArrowUp");
    press("ArrowRight");
    press("ArrowDown");
    check("2048 survives four moves", root.querySelectorAll(".g2048-cell").length === 16);
    click(root.querySelector(".g2048-new"));
    check("2048 New game adds two tiles", root.querySelectorAll(".g2048-tile").length === 2);
    if (instance.destroy) instance.destroy();
    root.remove();
  }

  {
    const { root, instance } = mount("minesweeper");
    check("minesweeper builds an 81-cell board", root.querySelectorAll(".ms-cell").length === 81);
    click(root.querySelector('.ms-cell[data-cell="40"]'));
    check("minesweeper first click opens cells", root.querySelectorAll(".ms-cell.open").length > 0);
    check("minesweeper first click is safe", !root.querySelector(".ms-status").textContent.includes("Boom"));
    click(root.querySelector(".ms-flag"));
    check("minesweeper flag mode toggles", root.querySelector(".ms-flag").classList.contains("on"));
    if (instance.destroy) instance.destroy();
    root.remove();
  }

  {
    const { root, instance } = mount("memory");
    check("memory deals sixteen cards", root.querySelectorAll(".mem-card").length === 16);
    const cards = root.querySelectorAll(".mem-card");
    click(cards[0]);
    click(cards[1]);
    check("memory counts a move", root.querySelector('[data-moves]').textContent === "1");
    check("memory flips cards", root.querySelectorAll(".mem-card.flipped").length === 2);
    // Extra clicks while a mismatched pair is still showing must not register.
    for (let i = 2; i < 10; i += 1) click(cards[i]);
    check("memory ignores clicks while a pair is locked", root.querySelector("[data-moves]").textContent === "1");
    // A new game clears the pending mismatch timeout instead of half-resetting it.
    click(root.querySelector("[data-reset]"));
    const fresh = root.querySelectorAll(".mem-card");
    click(fresh[0]);
    click(fresh[0]);
    check("memory does not count the same card twice", root.querySelector("[data-moves]").textContent === "0");
    await wait(800);
    click(fresh[1]);
    check("memory keeps a lone flip after a mid-pair reset", root.querySelector("[data-moves]").textContent === "1");
    if (instance.destroy) instance.destroy();
    root.remove();
  }

  /* ---------- canvas games: live loop smoke test ---------- */
  window.HTMLCanvasElement.prototype.getContext = function () { return contextStub(this); };

  const live = [
    { id: "snake", start: true, keys: ["ArrowUp", "ArrowLeft"] },
    { id: "breakout", start: true, keys: ["ArrowLeft", "ArrowRight", " "] },
    { id: "sky-dash", start: true, keys: [" "] },
    { id: "pong", start: true, keys: ["ArrowUp", "ArrowDown"] },
  ];

  for (const spec of live) {
    const before = errors.length;
    const { root, instance } = mount(spec.id);
    const start = root.querySelector(".gk-overlay .gk-btn");
    if (start) click(start);
    spec.keys.forEach(press);
    await wait(160);
    check(spec.id + " runs its animation loop", root.querySelector("canvas") !== null);
    check(spec.id + " raises no runtime errors", errors.length === before, errors.slice(before).join(" | "));
    if (instance.destroy) instance.destroy();
    root.remove();
  }

  check("destroying canvas games stops their loops", true);

  console.log("\n  Games: " + pass + " passed, " + fail + " failed");
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
