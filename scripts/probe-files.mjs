/* Load every local file game in a real browser, start it, and say whether it
   actually drew something. Run by .github/workflows/local-files.yml. */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:8765";
const OUT = process.env.OUT || "probe";
fs.mkdirSync(OUT, { recursive: true });
const COMMIT_SHOTS = process.env.COMMIT_SHOTS === "1";


process.on("exit", () => { if (COMMIT_SHOTS) console.log("shots in " + OUT); });

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"],
});

const errors = [];
const results = [];

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png") });
}

/* A canvas that has been painted has more than one colour in it. Games drawn
   with DOM nodes are checked by what they put on screen instead. */
async function paintScore(page, selector) {
  return page.evaluate((sel) => {
    const canvas = document.querySelector(sel);
    if (!canvas) {
      const cells = document.querySelectorAll(".cell");
      const filled = Array.from(cells).filter((c) => c.textContent.trim() || c.dataset.v).length;
      const text = document.body.innerText.trim().length;
      return { found: false, dom: { cells: cells.length, filled, text } };
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return { found: true, ctx: false };
    const { width, height } = canvas;
    if (!width || !height) return { found: true, ctx: true, blank: true };
    const data = ctx.getImageData(0, 0, width, height).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 97) {
      seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      if (seen.size > 6) break;
    }
    return { found: true, ctx: true, colours: seen.size };
  }, selector);
}

async function run(slug, steps, settle = 1800) {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  const log = [];
  page.on("pageerror", (err) => log.push("pageerror: " + err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") log.push("console: " + msg.text());
  });
  await page.goto(BASE + "/assets/games/" + slug + ".html", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const before = await paintScore(page, "canvas#game");
  let stepError = null;
  try {
    await steps(page);
  } catch (err) {
    stepError = err.message.split("\n")[0];
  }
  await page.waitForTimeout(settle);
  const after = await paintScore(page, "canvas#game");
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 120));
  await shot(page, slug);
  const drew = after.found ? after.colours >= 3 : (after.dom && after.dom.cells > 0 && after.dom.filled > 0);
  const entry = { slug, before, after, drew, text, log, stepError };
  results.push(entry);
  if (log.length || stepError || !drew) {
    errors.push(entry);
  }
  await page.close();
}

const click = (page, selector) => page.click(selector);
const key = (page, k) => page.keyboard.press(k);

await run(
  "snake",
  async (page) => {
    await click(page, "[data-go]");
    await page.waitForTimeout(320);
    // turn once, so the shot catches it mid-slither rather than in a wall
    await key(page, "ArrowDown");
    await page.waitForTimeout(320);
  },
  500
);

await run("2048", async (page) => {
  await key(page, "ArrowLeft");
  await key(page, "ArrowDown");
  await key(page, "ArrowRight");
});

await run("tetris", async (page) => {
  await click(page, "[data-go]");
  await page.waitForTimeout(700);
  await key(page, "ArrowLeft");
  await key(page, "ArrowUp");
  await key(page, " ");
});

await run("breakout", async (page) => {
  await click(page, "[data-go]");
  await page.waitForTimeout(300);
  await click(page, "canvas#game");
});

await run("pong", async (page) => {
  await click(page, "[data-go]");
  await page.waitForTimeout(1200);
});

await run("flap", async (page) => {
  await click(page, "[data-go]");
  await page.waitForTimeout(500);
  await click(page, "canvas#game");
  await page.waitForTimeout(500);
  await click(page, "canvas#game");
});

await run("minesweeper", async (page) => {
  const cells = await page.$$(".cell");
  await cells[20].click();
  await page.waitForTimeout(300);
  if (cells[31]) await cells[31].click({ button: "right" });
});

// and the page that lists them
const index = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const indexLog = [];
index.on("pageerror", (err) => indexLog.push(String(err.message)));
await index.goto(BASE + "/files.html", { waitUntil: "load" });
await index.waitForTimeout(600);
await shot(index, "files-page");
const cards = await index.$$(".file-card");
await index.click(".file-open");
await index.waitForTimeout(900);
const framed = await index.evaluate(() => {
  const frame = document.querySelector("iframe");
  return frame ? frame.getAttribute("src") : null;
});
await shot(index, "files-playing");
await index.close();
if (indexLog.length || cards.length !== 7 || !framed) {
  errors.push({ slug: "files-page", log: indexLog, cards: cards.length, framed });
}

// the wall's button
const wall = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await wall.goto(BASE + "/", { waitUntil: "load" });
await wall.waitForTimeout(700);
await shot(wall, "wall");
const button = await wall.evaluate(() => {
  const link = document.querySelector("a.btn-local");
  return link ? { href: link.getAttribute("href"), text: link.textContent.trim() } : null;
});
await wall.close();
if (!button) errors.push({ slug: "wall", button });

await browser.close();

fs.writeFileSync(
  path.join(OUT, "files.json"),
  JSON.stringify({ base: BASE, button, results, errors }, null, 2)
);

console.log(JSON.stringify({ button, errors: errors.length }, null, 2));
for (const entry of results) {
  console.log(
    entry.slug.padEnd(13),
    "drew:",
    String(entry.drew).padEnd(5),
    entry.log.length ? "LOG " + entry.log.join(" | ").slice(0, 200) : "clean",
    entry.stepError ? "STEP " + entry.stepError : ""
  );
}
process.exit(errors.length ? 1 : 0);
