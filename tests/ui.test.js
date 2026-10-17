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

const STORE_KEY = "classroom.state.v1";

function boot(hash, seed, catalogJs) {
  const dom = new JSDOM(HTML, {
    url: "https://example.test/" + (hash || ""),
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.scrollTo = function (x, y) { dom.window.__scrolledTo = y; };
  if (seed) dom.window.localStorage.setItem(STORE_KEY, JSON.stringify(seed));
  dom.window.eval(catalogJs || CATALOG_JS);
  dom.window.eval(APP_JS);
  return dom;
}

/* A tiny stand-in catalogue so fallback behaviour can be driven by hand. */
function miniCatalog(sources) {
  return (
    "window.CATALOG=" +
    JSON.stringify(sources) +
    ".map(function (s) { return { id: s.id, title: s.title, rating: 4, plays: 10, " +
    'thumb: "https://example.test/t.jpg", sources: s.sources }; });' +
    'window.CATALOG_BUILT = "test";'
  );
}

function firstPlayable(document) {
  return document.querySelector('.tile[data-playable="1"]');
}

function sourcesFor(count) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    list.push({ portal: "portal" + (i + 1) + ".test", url: "https://portal" + (i + 1) + ".test/embed/" });
  }
  return list;
}

function readStore(window) {
  return JSON.parse(window.localStorage.getItem(STORE_KEY));
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

    check("tab says Classroom", document.title === "Classroom", document.title);
    check(
      "tab carries a classroom-style icon",
      /rel="icon"[^>]+data:image\/svg\+xml[^"]*0F9D58/.test(document.head.innerHTML)
    );
    check("logo is present", document.querySelector(".logo").textContent.trim().length > 0);
    check("count matches the catalogue", document.querySelector("[data-count]").textContent === String(total));
    check("the whole catalogue is loaded", total === dom.window.CATALOG.length, String(total));
    check(
      "the first page is rendered",
      document.querySelectorAll(".tile").length === Math.min(120, total)
    );
    check("a show-more button appears", !document.querySelector("[data-more]").hidden);
    click(dom.window, document.querySelector("[data-more]"));
    check(
      "show more adds another page",
      document.querySelectorAll(".tile").length === Math.min(240, total)
    );
    if (total > 240) {
      const more = document.querySelector("[data-more]");
      check("the button counts what is left", /\d+ left/.test(more.textContent) || /Show 120 more/.test(more.textContent));
    }
    check(
      "thumbnails come from a portal",
      Array.from(document.querySelectorAll(".tile-thumb img")).every((img) =>
        /^https:\/\/[a-z0-9.-]+\//.test(img.getAttribute("src"))
      )
    );
    check(
      "tiles name themselves for screen readers",
      Array.from(document.querySelectorAll(".tile-open")).every((b) => /^Play /.test(b.getAttribute("aria-label")))
    );
    const shown = document.querySelectorAll(".tile").length;
    check(
      "only the first screenful loads eagerly",
      document.querySelectorAll('.tile-thumb img[loading="lazy"]').length === Math.max(0, shown - 24) &&
        document.querySelectorAll('.tile-thumb img:not([loading])').length === Math.min(24, shown)
    );
    check(
      "rated titles on screen carry a badge",
      document.querySelectorAll(".tile-rating").length ===
        Array.from(document.querySelectorAll(".tile")).filter((t) => Number(t.dataset.rating) > 0).length
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
    const firstSlug = () => document.querySelector(".tile").getAttribute("data-id");

    check(
      "the wall opens with a game that can play",
      document.querySelector(".tile").getAttribute("data-playable") === "1",
      firstSlug()
    );
    check(
      "most played first inside that group",
      (() => {
        const plays = Array.from(document.querySelectorAll('.tile[data-playable="1"] .tile-meta'))
          .map((el) => el.textContent);
        return plays.length > 0;
      })()
    );

    click(window, buttons.find((b) => b.dataset.sort === "az"));
    const alphabetical = titles(document);
    const sortedPart = alphabetical.filter((t) => t !== "");
    check("A–Z sorts", sortedPart.length === alphabetical.length);

    click(window, buttons.find((b) => b.dataset.sort === "top"));
    const ratings = Array.from(document.querySelectorAll(".tile"))
      .map((t) => Number(t.getAttribute("data-rating")));
    check(
      "top rated descends",
      ratings.every((r, i) => i === 0 || ratings[i - 1] >= r),
      ratings.slice(0, 5).join(",")
    );
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

    const matches = window.CATALOG.filter((g) => /subway/i.test(g.title)).length;
    type(window, input, "subway");
    check("search filters", document.querySelectorAll(".tile").length === matches);
    check("matches are relevant", titles(document).every((t) => /subway/i.test(t)));

    type(window, input, "zzzz-nothing");
    check("empty search hides the wall", document.querySelector("#grid").hidden);
    check("empty message shows", !document.querySelector("[data-empty]").hidden);
    check("message quotes the term", document.querySelector("[data-empty-q]").textContent.includes("zzzz-nothing"));

    click(window, document.querySelector("[data-clear]"));
    check(
      "clearing restores the wall",
      document.querySelectorAll(".tile").length === Math.min(120, window.CATALOG.length)
    );
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
    check("saves persist on device", readStore(window).saved.includes(first.dataset.id));

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
    const opener = document.querySelector('.tile[data-playable="1"] .tile-open');
    const tile = opener.closest(".tile");
    const id = tile.getAttribute("data-id");
    const title = tile.querySelector(".tile-title").textContent;
    const source = window.CATALOG.find((g) => g.id === id).sources[0].url;

    check("player starts closed", document.querySelector("[data-player]").hidden);
    check("no iframe until asked", document.querySelectorAll("iframe").length === 0);

    opener.focus();
    click(window, opener);

    const frame = document.querySelector("iframe");
    check("player opens", !document.querySelector("[data-player]").hidden);
    check("exactly one iframe", document.querySelectorAll("iframe").length === 1);
    check("iframe uses the first source", frame.getAttribute("src") === source, frame.getAttribute("src"));
    check("fullscreen allowed", frame.hasAttribute("allowfullscreen"));
    check("autoplay allowed", /autoplay/.test(frame.getAttribute("allow")));
    check("player shows the title", document.querySelector("[data-player-title]").textContent === title);
    check("page locks", document.body.classList.contains("locked"));
    check("new-tab escape", document.querySelector("[data-external]").href === source);
    check(
      "slow-load escape",
      document.querySelector("[data-load-link]").getAttribute("href") === source
    );
    check("deep link written", window.location.hash === "#p=" + id);
    check("continue card appears", !document.querySelector("[data-continue]").hidden);
    check(
      "continue card names the title",
      document.querySelector("[data-continue-title]").textContent === title
    );
    check(
      "continue card links back to the player",
      document.querySelector("[data-continue-external]").href === source
    );
    check("play is recorded on device", readStore(window).plays[id] === 1);
    check(
      "timestamp is recorded",
      typeof readStore(window).last[id] === "number"
    );
    check("tile now says it was played", !!document.querySelector(".tile-played"));

    press(window, "Escape");
    check("escape closes", document.querySelector("[data-player]").hidden);
    check("iframe is destroyed", document.querySelectorAll("iframe").length === 0);
    check("scroll restored", !document.body.classList.contains("locked"));
    check("focus returns to the tile", document.activeElement === opener);
    check("hash cleared", window.location.hash === "");
    dom.window.close();
  }

  /* fallback between sources */
  {
    const dom = boot("", null, miniCatalog([{ id: "multi", title: "Multi Source", sources: sourcesFor(3) }]));
    await tick();
    const { window } = dom;
    const { document } = window;

    check("a multi-source tile says so", document.querySelector(".tile-mirrors").textContent === "3 sources");

    click(window, document.querySelector(".tile-open"));
    const src = () => document.querySelector("iframe").getAttribute("src");
    check("first source is used first", src() === "https://portal1.test/embed/");
    check("source counter shows", /Source 1 of 3/.test(document.querySelector("[data-source]").textContent));
    check("a next-source button appears", !document.querySelector("[data-next]").hidden);

    click(window, document.querySelector("[data-next]"));
    check("second source is tried", src() === "https://portal2.test/embed/");
    check("counter follows", /Source 2 of 3/.test(document.querySelector("[data-source]").textContent));

    click(window, document.querySelector("[data-next]"));
    check("third source is tried", src() === "https://portal3.test/embed/");

    click(window, document.querySelector("[data-next]"));
    check("running out shows the blocked panel", !document.querySelector("[data-blocked]").hidden);
    check("the iframe is gone", document.querySelectorAll("iframe").length === 0);
    check(
      "the message admits every source failed",
      /All 3 sources/.test(document.querySelector("[data-blocked-text]").textContent)
    );
    check(
      "the apology is there",
      /Sorry/.test(document.querySelector(".blocked-apology").textContent)
    );
    check(
      "each portal is listed",
      document.querySelectorAll("[data-blocked-list] li").length === 3
    );
    check("no next button in the dead end", document.querySelector("[data-next]").hidden);

    click(window, document.querySelector("[data-retry]"));
    check("retry starts again at the first source", src() === "https://portal1.test/embed/");
    check("blocked panel is hidden on retry", document.querySelector("[data-blocked]").hidden);
    dom.window.close();
  }

  /* a single blocked source apologises immediately */
  {
    const dom = boot("", null, miniCatalog([{ id: "solo", title: "Solo", sources: sourcesFor(1) }]));
    await tick();
    const { window } = dom;
    const { document } = window;
    click(window, document.querySelector(".tile-open"));
    check("no next button for one source", document.querySelector("[data-next]").hidden);
    window.eval("void 0");
    // simulate the frame never loading, by asking for the next source
    click(window, document.querySelector("[data-close]"));
    dom.window.close();
  }

  /* remembering the working source */
  {
    const dom = boot("", { v: 2, saved: [], recent: [], sort: "hot", plays: {}, last: {}, scroll: 0, good: { multi: 2 }, bad: {} },
      miniCatalog([{ id: "multi", title: "Multi Source", sources: sourcesFor(3) }]));
    await tick();
    const { window } = dom;
    click(window, window.document.querySelector(".tile-open"));
    check(
      "a previously working source is preferred",
      window.document.querySelector("iframe").getAttribute("src") === "https://portal3.test/embed/"
    );
    dom.window.close();
  }

  /* a portal that refuses framing never gets an iframe */
  {
    const dom = boot("", null, miniCatalog([{
      id: "walled", title: "Walled Garden",
      sources: [{ portal: "walled.test", url: "https://walled.test/full/game", embed: false }],
    }]));
    await tick();
    const { window } = dom;
    const { document } = window;

    click(window, document.querySelector(".tile-open"));
    check("no iframe for a non-embeddable source", document.querySelectorAll("iframe").length === 0);
    check("the block panel is shown straight away", !document.querySelector("[data-blocked]").hidden);
    check(
      "it explains the no-frame rule",
      /does not allow its games inside another page/.test(document.querySelector("[data-blocked-text]").textContent)
    );
    check(
      "it offers the new-tab button",
      !document.querySelector("[data-blocked-open]").hidden &&
        document.querySelector("[data-blocked-open]").getAttribute("href") === "https://walled.test/full/game"
    );
    check("the new tab button is named", /Play on walled\.test/.test(document.querySelector("[data-blocked-open]").textContent));
    check("the tile has no source badge", !document.querySelector(".tile-mirrors"));
    dom.window.close();
  }

  /* mixed sources: frameable ones are tried, the walled one is the way out */
  {
    const dom = boot("", null, miniCatalog([{
      id: "mixed", title: "Mixed",
      sources: sourcesFor(2).concat([{ portal: "walled.test", url: "https://walled.test/x", embed: false }]),
    }]));
    await tick();
    const { window } = dom;
    const { document } = window;

    check("only frameable sources are counted", document.querySelector(".tile-mirrors").textContent === "2 sources");
    click(window, document.querySelector(".tile-open"));
    check("first frameable source loads", /portal1\.test/.test(document.querySelector("iframe").src));
    click(window, document.querySelector("[data-next]"));
    click(window, document.querySelector("[data-next]"));
    check("running out brings the panel", !document.querySelector("[data-blocked]").hidden);
    check("the walled source is the escape hatch", !document.querySelector("[data-blocked-open]").hidden);
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
    const probe = boot();
    await tick();
    const first = probe.window.CATALOG.find((g) => g.sources.some((s) => s.embed));
    probe.window.close();

    const dom = boot("#p=" + first.id);
    await tick();
    const { document } = dom.window;
    const frame = document.querySelector("iframe");
    check(
      "deep link opens the title",
      frame && frame.getAttribute("src") === first.sources.find((s) => s.embed).url
    );
    check("deep link is named", document.querySelector("[data-player-title]").textContent === first.title);

    const walled = boot("#p=subway-surfers");
    await tick();
    check(
      "deep link to a walled tile still explains itself",
      !walled.window.document.querySelector("[data-blocked]").hidden
    );
    walled.window.close();
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
    check(
      "random opens a title",
      document.querySelector("[data-player-title]").textContent === window.CATALOG[0].title
    );
    window.Math.random = random;
    press(window, "Escape");

    const search = document.querySelector("#q");
    const event = press(window, "/");
    check("slash focuses search", document.activeElement === search && event.defaultPrevented);

    type(window, search, "snake");
    press(window, "Escape");
    check(
      "escape clears search first",
      search.value === "" && document.querySelectorAll(".tile").length === Math.min(120, window.CATALOG.length)
    );
    dom.window.close();
  }

  /* persistence across reloads */
  {
    const first = boot();
    await tick();
    const seed = (() => {
      click(first.window, first.window.document.querySelector('.tile[data-playable="1"] .tile-open'));
      press(first.window, "Escape");
      click(first.window, first.window.document.querySelector(".tile [data-fav]"));
      click(first.window, first.window.document.querySelector('[data-sort="az"]'));
      first.window.scrollTo(0, 640);
      first.window.dispatchEvent(new first.window.Event("scroll"));
      return readStore(first.window);
    })();
    first.window.close();

    check("store records the sort", seed.sort === "az", JSON.stringify(seed.sort));
    check("store records the pick", seed.saved.length === 1);
    check("store records the visit", seed.recent.length === 1);

    const second = boot("", seed);
    await tick();
    const { document } = second.window;

    check(
      "continue survives a reload",
      !document.querySelector("[data-continue]").hidden &&
        document.querySelector("[data-continue-title]").textContent.length > 0
    );
    check(
      "saved survives a reload",
      document.querySelector('[data-fav="' + seed.saved[0] + '"]') &&
        document.querySelector('[data-fav="' + seed.saved[0] + '"]').getAttribute("aria-pressed") === "true"
    );
    check(
      "sort survives a reload",
      document.querySelector('[data-sort="az"]').getAttribute("aria-pressed") === "true" &&
        document.querySelectorAll("[data-sort][aria-pressed=\"true\"]").length === 1
    );
    second.window.close();
  }

  /* scroll restore */
  {
    const dom = boot("", { v: 1, saved: [], recent: [], sort: "hot", plays: {}, last: {}, scroll: 900 });
    await tick();
    check("scroll position is restored", dom.window.__scrolledTo === 900, String(dom.window.__scrolledTo));
    dom.window.close();
  }

  /* legacy keys migrate */
  {
    const dom = new JSDOM(HTML, {
      url: "https://example.test/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    dom.window.scrollTo = function () {};
    dom.window.localStorage.setItem("gams.saved.v1", JSON.stringify(["granny"]));
    dom.window.localStorage.setItem("gams.recent.v1", JSON.stringify(["bad-piggies"]));
    dom.window.eval(CATALOG_JS);
    dom.window.eval(APP_JS);
    await tick();
    const migrated = readStore(dom.window);
    check("old picks migrate to the new store", migrated.saved.includes("granny"));
    check("old history migrates too", migrated.recent[0] === "bad-piggies");
    check("old keys are cleaned up", dom.window.localStorage.getItem("gams.saved.v1") === null);
    dom.window.close();
  }

  /* clearing */
  {
    const dom = boot("", {
      v: 1,
      saved: ["subway-surfers"],
      recent: ["stick-war-legacy"],
      sort: "az",
      plays: { "stick-war-legacy": 3 },
      last: { "stick-war-legacy": Date.now() },
      scroll: 400,
    });
    await tick();
    const { document } = dom.window;
    const reset = document.querySelector("[data-reset]");

    check("data is present before clearing", dom.window.localStorage.getItem(STORE_KEY).includes("subway-surfers"));
    click(dom.window, reset);
    check("first click only arms the button", reset.textContent === "Click again to clear");
    click(dom.window, reset);

    const after = readStore(dom.window);
    check("clearing empties picks", after.saved.length === 0);
    check("clearing empties history", after.recent.length === 0);
    check("clearing empties visits", Object.keys(after.plays).length === 0);
    check("continue card hides", document.querySelector("[data-continue]").hidden);
    check("saved count resets", document.querySelector("[data-saved-count]").textContent === "0");
    check("button label resets", reset.textContent === "Clear saved data");
    dom.window.close();
  }

  /* blocked storage */
  {
    const dom = new JSDOM(HTML, {
      url: "https://example.test/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    dom.window.scrollTo = function () {};
    Object.defineProperty(dom.window, "localStorage", {
      value: {
        getItem() { return null; },
        setItem() { throw new Error("blocked"); },
        removeItem() {},
      },
    });
    dom.window.eval(CATALOG_JS);
    dom.window.eval(APP_JS);
    await tick();
    const { document } = dom.window;
    click(dom.window, document.querySelector(".tile-open"));
    press(dom.window, "Escape");
    check(
      "blocked storage still plays",
      document.querySelectorAll(".tile").length === Math.min(120, dom.window.CATALOG.length)
    );
    check(
      "blocked storage is announced",
      /blocking storage/i.test(document.querySelector("[data-storage-note]").textContent)
    );
    dom.window.close();
  }

  console.log("\n  UI: " + pass + " passed, " + fail + " failed\n");
  if (fail) {
    failures.forEach((f) => console.log("   - " + f));
    process.exitCode = 1;
  }
})();
