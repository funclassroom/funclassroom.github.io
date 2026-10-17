/* UI behaviour for the G@M£$ wall. jsdom only — no network, no canvas. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs
  .readFileSync(path.join(ROOT, "index.html"), "utf8")
  .replace(/<script src="[^"]+"><\/script>/g, "");

const CATALOG_JS = fs.readFileSync(path.join(ROOT, "assets/js/catalog.js"), "utf8");
const APP_JS = fs.readFileSync(path.join(ROOT, "assets/js/app.js"), "utf8");

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

function boot(hash) {
  const dom = new JSDOM(HTML, {
    url: "https://example.test/" + (hash || ""),
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.eval(CATALOG_JS);
  dom.window.eval(APP_JS);
  return dom;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function click(window, node) {
  node.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function type(window, input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function press(window, key) {
  const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  window.document.body.dispatchEvent(event);
  return event;
}

function visibleTitles(document) {
  return Array.from(document.querySelectorAll(".tile-title")).map((n) => n.textContent);
}

(async function run() {
  console.log("\nUI — chrome, search, sort, player\n");
  await tick();

  /* ---------- first paint ---------- */
  {
    const dom = boot();
    await tick();
    const { document } = dom.window;

    check("page title is the wordmark", document.title === "G@M£$", document.title);
    check("header carries the wordmark", document.querySelector(".brand-word").textContent === "G@M£$");
    check("hero carries the wordmark", document.querySelector(".wordmark").textContent === "G@M£$");
    check(
      "hero count matches the catalogue",
      document.querySelector("[data-count]").textContent === String(dom.window.CATALOG.length)
    );
    check("every title is on the wall", document.querySelectorAll(".tile").length === dom.window.CATALOG.length);
    check(
      "tiles use publisher thumbnails",
      Array.from(document.querySelectorAll(".tile-thumb img")).every((img) =>
        /^https:\/\/www\.madkidgames\.com\/games\/[a-z0-9-]+\/thumb_2\.jpg$/.test(img.getAttribute("src"))
      )
    );
    check(
      "each tile is a play button with a name",
      Array.from(document.querySelectorAll(".tile-open")).every((b) =>
        /^Play /.test(b.getAttribute("aria-label"))
      )
    );
    check(
      "unrated titles are labelled new",
      document.querySelectorAll(".tile-rating[data-new]").length ===
        dom.window.CATALOG.filter((t) => t.rating === 0).length
    );
    check(
      "tile images declare their box",
      Array.from(document.querySelectorAll(".tile-thumb img")).every(
        (img) => img.getAttribute("width") === "512" && img.getAttribute("height") === "384"
      )
    );

    const chrome = [".bar", ".hero", ".toolbar", ".foot"]
      .map((sel) => document.querySelector(sel).textContent)
      .join(" ");
    check("chrome avoids the G-word", !/\bgames?\b/i.test(chrome), chrome.match(/\bgames?\b/i)?.[0]);

    check(
      "no duplicate ids",
      (() => {
        const ids = Array.from(document.querySelectorAll("[id]")).map((n) => n.id);
        return ids.length === new Set(ids).size;
      })()
    );
    check(
      "every sprite reference resolves",
      Array.from(document.querySelectorAll("use")).every((use) =>
        document.querySelector(use.getAttribute("href"))
      )
    );
    dom.window.close();
  }

  /* ---------- sorting ---------- */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const buttons = Array.from(document.querySelectorAll("[data-sort]"));
    const firstSlug = () => document.querySelector(".tile").getAttribute("data-slug");
    const firstRating = () => document.querySelector(".tile-rating").textContent;

    check("default order is most played", firstSlug() === "stick-war-legacy", firstSlug());

    click(window, buttons.find((b) => b.dataset.sort === "az"));
    const alphabetical = visibleTitles(document);
    check(
      "A–Z is actually alphabetical",
      alphabetical.join("|") === alphabetical.slice().sort((a, b) => a.localeCompare(b)).join("|")
    );

    click(window, buttons.find((b) => b.dataset.sort === "top"));
    check("top rated leads with five stars", firstRating() === "5.0", firstRating());

    check(
      "only one sort is pressed at a time",
      document.querySelectorAll('[data-sort][aria-pressed="true"]').length === 1
    );
    dom.window.close();
  }

  /* ---------- search + empty state ---------- */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const input = document.querySelector("#q");

    type(window, input, "subway");
    const titles = visibleTitles(document);
    check("search narrows the wall", titles.length === 2, String(titles.length));
    check("search matches titles", titles.every((t) => /subway/i.test(t)), titles.join(", "));

    type(window, input, "zzzz-nothing");
    check("no matches hides the wall", document.querySelector("#grid").hidden);
    check("empty state is announced", !document.querySelector("[data-empty]").hidden);
    check(
      "empty state quotes the query",
      document.querySelector("[data-empty-q]").textContent.includes("zzzz-nothing")
    );

    click(window, document.querySelector("[data-clear]"));
    check("clear restores every tile", document.querySelectorAll(".tile").length === window.CATALOG.length);
    dom.window.close();
  }

  /* ---------- saved ---------- */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const first = document.querySelector(".tile");

    click(window, first.querySelector("[data-fav]"));
    check("saving lights the star", first.querySelector("[data-fav]").getAttribute("aria-pressed") === "true");
    check("saved count updates", document.querySelector("[data-saved-count]").textContent === "1");
    check(
      "saved titles persist",
      JSON.parse(window.localStorage.getItem("gams.saved.v1")).includes(first.dataset.slug)
    );

    click(window, document.querySelector("[data-saved-toggle]"));
    check("saved view shows only saves", document.querySelectorAll(".tile").length === 1);

    click(window, document.querySelector("[data-fav]"));
    check("unsaving empties the view", document.querySelectorAll(".tile").length === 0);
    check("empty state covers a blank filter", document.querySelector("[data-empty-q]").textContent === "this filter");
    check("saved count returns to zero", document.querySelector("[data-saved-count]").textContent === "0");
    check(
      "the saved filter stays on until it is switched off",
      document.querySelector("[data-saved-toggle]").getAttribute("aria-pressed") === "true"
    );
    dom.window.close();
  }

  /* ---------- player ---------- */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const first = document.querySelector(".tile");
    const opener = first.querySelector(".tile-open");

    check("player starts closed", document.querySelector("[data-player]").hidden);
    check("no iframe before opening", document.querySelectorAll("iframe").length === 0);

    opener.focus();
    click(window, opener);
    const frame = document.querySelector("iframe");
    const player = document.querySelector("[data-player]");

    check("clicking a tile opens the player", !player.hidden);
    check("exactly one player loads", document.querySelectorAll("iframe").length === 1);
    check(
      "iframe points at the publisher's player",
      frame.getAttribute("src") === "https://www.madkidgames.com/full/stick-war-legacy",
      frame.getAttribute("src")
    );
    check("iframe can go fullscreen", frame.hasAttribute("allowfullscreen"));
    check("iframe allows autoplay", /autoplay/.test(frame.getAttribute("allow")));
    check("player titles the title", document.querySelector("[data-player-title]").textContent === "Stick War Legacy");
    check("page locks behind the player", document.body.classList.contains("playing"));
    check("new-tab link matches the embed", document.querySelector("[data-external]").href.endsWith("/full/stick-war-legacy"));
    check(
      "a stalled player can be opened elsewhere",
      document.querySelector("[data-load-link]").getAttribute("href").endsWith("/full/stick-war-legacy")
    );
    check("deep link is written to the url", window.location.hash === "#p=stick-war-legacy");
    check("recent row appears", !document.querySelector("[data-recent]").hidden);
    check(
      "recent row names the title",
      document.querySelector("[data-recent-list]").textContent.includes("Stick War Legacy")
    );

    press(window, "Escape");
    check("escape closes the player", player.hidden);
    check("escape unloads the iframe", document.querySelectorAll("iframe").length === 0);
    check("body scroll is restored", !document.body.classList.contains("playing"));
    check("focus returns to the tile", document.activeElement === opener);
    check("hash is cleared on close", window.location.hash === "");
    dom.window.close();
  }

  /* ---------- close button + fullscreen wiring ---------- */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const opener = document.querySelector(".tile-open");

    opener.focus();
    click(window, opener);
    click(window, document.querySelector("[data-close]"));
    check("close button also unloads", document.querySelectorAll("iframe").length === 0);
    check("close button restores focus", document.activeElement === opener);
    dom.window.close();
  }

  /* ---------- deep links ---------- */
  {
    const dom = boot("#p=subway-surfers");
    await tick();
    const { document } = dom.window;
    const frame = document.querySelector("iframe");
    check("a deep link opens that title", frame && frame.getAttribute("src").endsWith("/full/subway-surfers"));
    check("the deep-linked title is named", document.querySelector("[data-player-title]").textContent === "Subway Surfers");
    dom.window.close();
  }

  {
    const dom = boot("#p=not-a-real-slug");
    await tick();
    check("a bad deep link is ignored", dom.window.document.querySelector("[data-player]").hidden);
    dom.window.close();
  }

  /* ---------- shuffle, keys, shortcuts ---------- */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;

    const original = window.Math.random;
    window.Math.random = () => 0;
    click(window, document.querySelector("[data-shuffle]"));
    check(
      "shuffle plays the first title when the dice say so",
      document.querySelector("[data-player-title]").textContent === "Stick War Legacy"
    );
    window.Math.random = original;
    press(window, "Escape");

    click(window, document.querySelector(".tile-open"));
    check("player is open before the shortcut test", !document.querySelector("[data-player]").hidden);
    // Opening from a tile while a tile is focused keeps focus predictable.
    check("shortcut does not disturb the iframe", document.querySelectorAll("iframe").length === 1);
    press(window, "Escape");

    const search = document.querySelector("#q");
    const event = press(window, "/");
    check("slash focuses search", document.activeElement === search && event.defaultPrevented);

    type(window, search, "snake");
    press(window, "Escape");
    check("escape clears a search first", search.value === "" && document.querySelectorAll(".tile").length === window.CATALOG.length);
    dom.window.close();
  }

  console.log("\n  UI: " + pass + " passed, " + fail + " failed\n");
  if (fail) {
    failures.forEach((f) => console.log("   - " + f));
    process.exitCode = 1;
  }
})();
