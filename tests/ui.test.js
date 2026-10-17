/* Wall + player behaviour. jsdom, no network. */
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

function titles(document) {
  return Array.from(document.querySelectorAll(".tile-title")).map((n) => n.textContent);
}

(async function run() {
  console.log("\nUI\n");
  await tick();

  /* first paint */
  {
    const dom = boot();
    await tick();
    const { document } = dom.window;
    const total = dom.window.CATALOG.length;

    check("tab title is the wordmark", document.title === "G@M£$", document.title);
    check("logo is the wordmark", document.querySelector(".logo").textContent === "G@M£$");
    check("count matches the catalogue", document.querySelector("[data-count]").textContent === String(total));
    check("count is 507", total === 507, String(total));
    check("every title is rendered", document.querySelectorAll(".tile").length === total);
    check(
      "thumbnails come from the publisher",
      Array.from(document.querySelectorAll(".tile-thumb img")).every((img) =>
        /^https:\/\/www\.madkidgames\.com\/games\/[a-z0-9-]+\/thumb_2\.jpg$/.test(img.getAttribute("src"))
      )
    );
    check(
      "tiles name themselves for screen readers",
      Array.from(document.querySelectorAll(".tile-open")).every((b) => /^Play /.test(b.getAttribute("aria-label")))
    );
    check(
      "only the first screenful loads eagerly",
      document.querySelectorAll('.tile-thumb img[loading="lazy"]').length === total - 24 &&
        document.querySelectorAll('.tile-thumb img:not([loading])').length === 24
    );
    check(
      "rated titles carry a badge",
      document.querySelectorAll(".tile-rating").length ===
        dom.window.CATALOG.filter((t) => t.rating > 0).length
    );

    const chrome = Array.from(document.querySelectorAll(".bar, .toolbar, .foot"))
      .map((n) => n.textContent)
      .join(" ");
    check("chrome never says the word", !/\bgames?\b/i.test(chrome), chrome.match(/\bgames?\b/i)?.[0]);

    check(
      "no duplicate ids",
      (() => {
        const ids = Array.from(document.querySelectorAll("[id]")).map((n) => n.id);
        return ids.length === new Set(ids).size;
      })()
    );
    check(
      "sprite references resolve",
      Array.from(document.querySelectorAll("use")).every((u) => document.querySelector(u.getAttribute("href")))
    );
    dom.window.close();
  }

  /* sorting */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const buttons = Array.from(document.querySelectorAll("[data-sort]"));
    const firstSlug = () => document.querySelector(".tile").getAttribute("data-slug");

    check("default order is most played", firstSlug() === "stick-war-legacy", firstSlug());

    click(window, buttons.find((b) => b.dataset.sort === "az"));
    const alphabetical = titles(document);
    check(
      "A–Z sorts",
      alphabetical.join("|") === alphabetical.slice().sort((a, b) => a.localeCompare(b)).join("|")
    );

    click(window, buttons.find((b) => b.dataset.sort === "top"));
    check("top rated starts at five", document.querySelector(".tile-rating").textContent === "5.0");
    check("one sort at a time", document.querySelectorAll('[data-sort][aria-pressed="true"]').length === 1);
    dom.window.close();
  }

  /* search */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const input = document.querySelector("#q");

    type(window, input, "subway");
    check("search filters", document.querySelectorAll(".tile").length === 2);
    check("matches are relevant", titles(document).every((t) => /subway/i.test(t)));

    type(window, input, "zzzz-nothing");
    check("empty search hides the wall", document.querySelector("#grid").hidden);
    check("empty message shows", !document.querySelector("[data-empty]").hidden);
    check("message quotes the term", document.querySelector("[data-empty-q]").textContent.includes("zzzz-nothing"));

    click(window, document.querySelector("[data-clear]"));
    check("clearing restores the wall", document.querySelectorAll(".tile").length === window.CATALOG.length);
    check("clear button hides when empty", document.querySelector("[data-search-clear]").hidden);
    dom.window.close();
  }

  /* saves */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const first = document.querySelector(".tile");

    click(window, first.querySelector("[data-fav]"));
    check("star fills", first.querySelector("[data-fav]").getAttribute("aria-pressed") === "true");
    check("counter updates", document.querySelector("[data-saved-count]").textContent === "1");
    check(
      "saves persist",
      JSON.parse(window.localStorage.getItem("gams.saved.v1")).includes(first.dataset.slug)
    );

    click(window, document.querySelector("[data-saved-toggle]"));
    check("saved view filters", document.querySelectorAll(".tile").length === 1);

    click(window, document.querySelector("[data-fav]"));
    check("unsaving clears it", document.querySelectorAll(".tile").length === 0);
    check("empty filter wording", document.querySelector("[data-empty-q]").textContent === "this filter");
    check("counter returns to zero", document.querySelector("[data-saved-count]").textContent === "0");
    dom.window.close();
  }

  /* player */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const opener = document.querySelector(".tile-open");

    check("player starts closed", document.querySelector("[data-player]").hidden);
    check("no iframe until asked", document.querySelectorAll("iframe").length === 0);

    opener.focus();
    click(window, opener);

    const frame = document.querySelector("iframe");
    check("player opens", !document.querySelector("[data-player]").hidden);
    check("exactly one iframe", document.querySelectorAll("iframe").length === 1);
    check(
      "iframe uses the publisher player",
      frame.getAttribute("src") === "https://www.madkidgames.com/full/stick-war-legacy",
      frame.getAttribute("src")
    );
    check("fullscreen allowed", frame.hasAttribute("allowfullscreen"));
    check("autoplay allowed", /autoplay/.test(frame.getAttribute("allow")));
    check("player shows the title", document.querySelector("[data-player-title]").textContent === "Stick War Legacy");
    check("page locks", document.body.classList.contains("locked"));
    check("new-tab escape", document.querySelector("[data-external]").href.endsWith("/full/stick-war-legacy"));
    check(
      "slow-load escape",
      document.querySelector("[data-load-link]").getAttribute("href").endsWith("/full/stick-war-legacy")
    );
    check("deep link written", window.location.hash === "#p=stick-war-legacy");
    check("recent row appears", !document.querySelector("[data-recent]").hidden);
    check(
      "recent row names it",
      document.querySelector("[data-recent-list]").textContent.includes("Stick War Legacy")
    );

    press(window, "Escape");
    check("escape closes", document.querySelector("[data-player]").hidden);
    check("iframe is destroyed", document.querySelectorAll("iframe").length === 0);
    check("scroll restored", !document.body.classList.contains("locked"));
    check("focus returns to the tile", document.activeElement === opener);
    check("hash cleared", window.location.hash === "");
    dom.window.close();
  }

  /* close button */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const opener = document.querySelector(".tile-open");
    opener.focus();
    click(window, opener);
    click(window, document.querySelector("[data-close]"));
    check("close button unloads", document.querySelectorAll("iframe").length === 0);
    check("close button restores focus", document.activeElement === opener);
    dom.window.close();
  }

  /* deep links */
  {
    const dom = boot("#p=subway-surfers");
    await tick();
    const { document } = dom.window;
    const frame = document.querySelector("iframe");
    check("deep link opens the title", frame && frame.getAttribute("src").endsWith("/full/subway-surfers"));
    check("deep link is named", document.querySelector("[data-player-title]").textContent === "Subway Surfers");
    dom.window.close();
  }

  {
    const dom = boot("#p=not-a-real-slug");
    await tick();
    check("bad deep link ignored", dom.window.document.querySelector("[data-player]").hidden);
    dom.window.close();
  }

  /* keys + shuffle */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;

    const random = window.Math.random;
    window.Math.random = () => 0;
    click(window, document.querySelector("[data-shuffle]"));
    check("random opens a title", document.querySelector("[data-player-title]").textContent === "Stick War Legacy");
    window.Math.random = random;
    press(window, "Escape");

    const search = document.querySelector("#q");
    const event = press(window, "/");
    check("slash focuses search", document.activeElement === search && event.defaultPrevented);

    type(window, search, "snake");
    press(window, "Escape");
    check(
      "escape clears search first",
      search.value === "" && document.querySelectorAll(".tile").length === window.CATALOG.length
    );
    dom.window.close();
  }

  console.log("\n  UI: " + pass + " passed, " + fail + " failed\n");
  if (fail) {
    failures.forEach((f) => console.log("   - " + f));
    process.exitCode = 1;
  }
})();
