/* Smoke test: drives the real DOM the way a user would. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const dom = new JSDOM(html, {
  url: "http://localhost:8000/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;

let pass = 0, fail = 0;

// jsdom does not fetch <script src>, so evaluate them in order ourselves,
// then run the assertions once the document has finished loading.
function boot() {
  window.eval(fs.readFileSync(path.join(ROOT, "assets/js/games.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(ROOT, "assets/js/app.js"), "utf8"));
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { boot(); main(); });
} else {
  boot();
  if (document.readyState !== "complete") window.addEventListener("load", main);
  else main();
}

function main() {
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  \x1b[32mPASS\x1b[0m  " + name); }
  else { fail++; console.log("  \x1b[31mFAIL\x1b[0m  " + name + (extra ? "  -> " + extra : "")); }
}
const click = (n) => n.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const key = (k, opts = {}) =>
  document.dispatchEvent(new window.KeyboardEvent("keydown", Object.assign({ key: k, bubbles: true, cancelable: true }, opts)));

console.log("\n=== 1. First paint (should be the Classroom disguise) ===");
ok("body starts in classroom mode", document.body.dataset.mode === "classroom", document.body.dataset.mode);
ok("tab title is 'Classes'", document.title === "Classes", document.title);
ok("classroom view visible", !document.getElementById("mode-classroom").hidden);
ok("games view hidden by CSS mode switch", document.getElementById("mode-games").style.display !== "block");
ok("favicon swapped to the green Classroom mark",
   (document.querySelector("link[rel=icon]") || {}).href?.includes("1e8e3e"),
   (document.querySelector("link[rel=icon]") || {}).href);

const cards = document.querySelectorAll("#class-grid .class-card");
ok("8 class cards rendered from the catalog", cards.length === 8, "got " + cards.length);
ok("cards show the SUBJECT, not the game name",
   cards[0].querySelector(".class-title").textContent === "Mathematics",
   cards[0].querySelector(".class-title").textContent);
ok("no real game title leaks into classroom mode",
   !document.getElementById("view-classes").textContent.includes("Example Arcade Game"));
ok("each card has a teacher + section", !!cards[0].querySelector(".class-teacher").textContent);

console.log("\n=== 2. Open a class -> Stream tab ===");
click(cards[0]);
ok("class page shown", !document.getElementById("view-class").hidden);
ok("classes grid hidden", document.getElementById("view-classes").hidden);
ok("hero shows the subject", document.querySelector("#class-hero h1").textContent === "Mathematics");
ok("title becomes the subject", document.title === "Mathematics", document.title);
ok("Stream tab active", document.querySelector('.gc-tab[data-tab="stream"]').classList.contains("active"));
ok("announcement composer rendered", !!document.querySelector(".composer"));
ok("assignment post rendered with an Open button", !!document.querySelector("[data-open-game]"));
ok("Securly notice present in the stream",
   document.getElementById("stream-feed").textContent.includes("Securly"));
ok("notice is labelled as satire",
   document.querySelector(".notice-post").textContent.toLowerCase().includes("satire"));
ok("Upcoming sidebar rendered", document.querySelectorAll("#stream-side .side-item").length >= 2);
ok("decorative announcements rendered",
   document.querySelectorAll("#stream-feed .post").length >= 3,
   document.querySelectorAll("#stream-feed .post").length);

console.log("\n=== 3. Open the assignment -> game iframe ===");
click(document.querySelector('[data-open-game][data-open-game]') || document.querySelector(".post-assignment [data-open-game]"));
const shell = document.querySelector("#player-classroom .frame-shell");
const frame = shell && shell.querySelector("iframe");
ok("player root shown", !document.getElementById("player-classroom").hidden);
ok("class page hidden while playing", document.getElementById("view-class").hidden);
ok("iframe mounted", !!frame);
ok("iframe points at the game URL",
   frame && frame.src === "https://www.madkidgames.com/html5-games/example-arcade-1/",
   frame && frame.src);
ok("assignment banner shown above the frame",
   document.querySelector("#player-classroom .asg-banner h2").textContent.includes("Unit 4"));
ok("exactly ONE live iframe in the document", document.querySelectorAll("iframe").length === 1,
   document.querySelectorAll("iframe").length);
ok("title now reads like an assignment", document.title.includes("Unit 4"), document.title);

console.log("\n=== 4. Back out, then Classwork + People tabs ===");
click(document.querySelector("#player-classroom [data-act=back]"));
ok("returned to the class page", !document.getElementById("view-class").hidden);
ok("iframe torn down", document.querySelectorAll("iframe").length === 0);

click(document.querySelector('.gc-tab[data-tab="classwork"]'));
ok("Classwork tab active", document.querySelector('.gc-tab[data-tab="classwork"]').classList.contains("active"));
const cwRows = document.querySelectorAll("#classwork-rows .cw-row");
ok("classwork lists the assignment + 3 decorative rows", cwRows.length === 4, "got " + cwRows.length);
click(cwRows[0]);
ok("clicking a classwork row launches the game",
   !!document.querySelector("#player-classroom .frame-shell iframe"));
click(document.querySelector("#player-classroom [data-act=back]"));

click(document.querySelector('.gc-tab[data-tab="people"]'));
ok("People tab renders a teacher + students",
   document.querySelectorAll("#people-rows .cw-row").length === 9,
   document.querySelectorAll("#people-rows .cw-row").length);

console.log("\n=== 5. Panic switch -> Games mode (with a game running) ===");
// open a game in the classroom skin first, so we can prove the switch
// carries the running game across and re-skins it
click(document.querySelectorAll("#class-grid .class-card")[2]);
click(document.querySelector("#stream-feed .post-assignment [data-open-game]"));
ok("game is running in the classroom skin",
   !!document.querySelector("#player-classroom .frame-shell iframe"));
const carriedSrc = document.querySelector("#player-classroom .frame-shell iframe").src;

click(document.querySelector("#mode-classroom [data-toggle-mode]"));
ok("now in games mode", document.body.dataset.mode === "games");
ok("title changed to the games brand", document.title.includes("MadKid"), document.title);
ok("favicon changed to the purple gamepad",
   document.querySelector("link[rel=icon]").href.includes("7c5cff"));
const gameCards = document.querySelectorAll("#game-grid .game-card");
ok("8 game cards rendered", gameCards.length === 8, "got " + gameCards.length);
ok("REAL game names are visible here",
   gameCards[0].querySelector(".game-info strong").textContent === "Example Arcade Game",
   gameCards[0].querySelector(".game-info strong").textContent);
ok("category chips rendered", document.querySelectorAll("#chips .chip").length >= 6);
ok("notice banner present in games mode too",
   document.querySelector(".mk-notice").textContent.includes("Securly"));
const carried = document.querySelector("#player-games .frame-shell iframe");
ok("the running game carried across into the games skin", !!carried);
ok("...and kept the SAME game URL", carried && carried.src === carriedSrc,
   carried && carried.src);
ok("games skin shows the real game name",
   document.querySelector("#player-games .mk-player-head strong").textContent === "Example Racing Game");
ok("games skin has its own Hide button",
   !!document.querySelector('#player-games [data-act="panic"]'));
ok("old classroom player host was cleared (only ONE live iframe)",
   document.querySelectorAll("iframe").length === 1, document.querySelectorAll("iframe").length);

console.log("\n=== 6. Library -> back -> search -> filter ===");
click(document.querySelector("#player-games [data-act=back]"));
ok("library visible again", !document.getElementById("games-browse").hidden);

const search = document.getElementById("mk-search");
search.value = "racing";
search.dispatchEvent(new window.Event("input", { bubbles: true }));
ok("search filters the grid", document.querySelectorAll("#game-grid .game-card").length === 1,
   document.querySelectorAll("#game-grid .game-card").length);
search.value = "";
search.dispatchEvent(new window.Event("input", { bubbles: true }));

const chips = document.querySelectorAll("#chips .chip");
let puzzleChip;
chips.forEach((c) => { if (c.textContent === "Puzzle") puzzleChip = c; });
click(puzzleChip);
ok("category chip filters the grid", document.querySelectorAll("#game-grid .game-card").length === 1);
click(chips[0]);
ok("'All' chip restores the full grid", document.querySelectorAll("#game-grid .game-card").length === 8);

click(document.querySelectorAll("#game-grid .game-card")[2]);
ok("clicking a game card mounts its iframe",
   document.querySelector("#player-games .frame-shell iframe").src.includes("example-racing-1"));

console.log("\n=== 7. Hotkeys ===");
key("K", { ctrlKey: true, shiftKey: true });
ok("Ctrl+Shift+K flips to classroom", document.body.dataset.mode === "classroom");
key("K", { ctrlKey: true, shiftKey: true });
ok("Ctrl+Shift+K flips back to games", document.body.dataset.mode === "games");
key("`");
ok("backtick also flips mode", document.body.dataset.mode === "classroom");
key("Escape");
ok("Escape closes the open game", document.querySelectorAll("iframe").length === 0);
key("Escape");
ok("Escape again returns to the classes grid", !document.getElementById("view-classes").hidden);

console.log("\n=== 8. Add your own game (localStorage) ===");
click(document.getElementById("gc-add"));
ok("modal opens", document.getElementById("modal-back").classList.contains("open"));
document.getElementById("f-url").value = "https://www.madkidgames.com/html5-games/real-game/";
document.getElementById("f-title").value = "Real Game";
document.getElementById("f-cat").value = "Action";
document.getElementById("f-subject").value = "Physics";
document.getElementById("f-teacher").value = "Dr. Nova";
click(document.getElementById("modal-save"));
ok("modal closed after save", !document.getElementById("modal-back").classList.contains("open"));
ok("custom game persisted to localStorage",
   window.localStorage.getItem("mk.customGames.v1").includes("real-game"));
ok("grid now has 9 classes", document.querySelectorAll("#class-grid .class-card").length === 9);
ok("custom game shows its disguise name in classroom mode",
   document.getElementById("view-classes").textContent.includes("Physics"));
ok("custom game does NOT leak its real name in classroom mode",
   !document.getElementById("view-classes").textContent.includes("Real Game"));

key("K", { ctrlKey: true, shiftKey: true });
ok("custom game appears in the games library",
   document.querySelectorAll("#game-grid .game-card").length === 9);
ok("real name visible in games mode",
   document.getElementById("games-browse").textContent.includes("Real Game"));

console.log("\n=== 8b. Blank disguise fields must NOT leak the real name ===");
click(document.getElementById("mk-add"));
document.getElementById("f-url").value = "https://www.madkidgames.com/html5-games/secret-game/";
document.getElementById("f-title").value = "SuperSecretGameName";
document.getElementById("f-cat").value = "Racing";
// subject / teacher / section deliberately left blank
click(document.getElementById("modal-save"));
key("K", { ctrlKey: true, shiftKey: true });
const gridText = document.getElementById("view-classes").textContent;
ok("auto-disguise did NOT print the real game name",
   !gridText.includes("SuperSecretGameName"));
ok("auto-disguise assigned a plausible subject",
   gridText.includes("Physical Education"));
ok("auto-disguise assigned a teacher", /Mr\.|Ms\.|Dr\.|Mrs\.|Coach/.test(gridText));
ok("grid now has 10 classes",
   document.querySelectorAll("#class-grid .class-card").length === 10,
   document.querySelectorAll("#class-grid .class-card").length);
ok("real name still shows in games mode",
   (key("K", { ctrlKey: true, shiftKey: true }),
    document.getElementById("games-browse").textContent.includes("SuperSecretGameName")));

console.log("\n=== 9. Input validation ===");
click(document.getElementById("mk-add"));
document.getElementById("f-url").value = "not-a-url";
click(document.getElementById("modal-save"));
ok("rejects a URL without a scheme",
   document.getElementById("modal-back").classList.contains("open"));
ok("nothing was saved", window.localStorage.getItem("mk.customGames.v1").split("real-game").length === 2);
click(document.getElementById("modal-cancel"));
ok("cancel closes the modal", !document.getElementById("modal-back").classList.contains("open"));

console.log("\n=== 10. XSS safety ===");
const before = window.localStorage.getItem("mk.customGames.v1");
const evil = JSON.parse(before);
evil.push({
  id: "evil", title: "<img src=x onerror=alert(1)>", url: "https://example.com/",
  category: "Arcade", "class": { subject: "<script>window.__pwned=1</script>", teacher: "X", color: "#000" }
});
window.localStorage.setItem("mk.customGames.v1", JSON.stringify(evil));
key("K", { ctrlKey: true, shiftKey: true });
ok("hostile title is escaped, not executed", window.__pwned === undefined);
ok("no injected <script> reached the DOM", !document.querySelector("#class-grid script"));
ok("no injected <img onerror> reached the DOM",
   !document.querySelector('#class-grid img[src="x"]'));
ok("hostile entry rendered as escaped TEXT, one card per game",
   document.querySelectorAll("#class-grid .class-card").length ===
     window.GAME_CATALOG.length + JSON.parse(window.localStorage.getItem("mk.customGames.v1")).length);
// the hostile SUBJECT is what renders in classroom mode; the hostile TITLE
// renders in games mode. Both must appear as literal escaped text.
ok("hostile subject renders as literal text in Classroom mode",
   document.getElementById("view-classes").textContent.includes("<script>window.__pwned=1</script>"));
key("K", { ctrlKey: true, shiftKey: true });
ok("hostile title renders as literal text in Games mode",
   document.getElementById("games-browse").textContent.includes("<img src=x onerror=alert(1)>"));
ok("and still did not execute", window.__pwned === undefined);

console.log("\n" + "=".repeat(46));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(46) + "\n");
process.exit(fail ? 1 : 0);
}
