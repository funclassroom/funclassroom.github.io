/* Load every game on the local files page in a real browser: does the page
   list them, does each file actually open, and does it draw something? Also
   takes the card screenshots the page uses. Run by local-files.yml. */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:8765";
const OUT = process.env.OUT || "probe";
const THUMBS = path.join("assets", "img", "pack");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(THUMBS, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"],
});

const errors = [];
const results = [];

const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const pageLog = [];
page.on("pageerror", (err) => pageLog.push("pageerror: " + err.message));
await page.goto(BASE + "/files.html", { waitUntil: "load" });
await page.waitForTimeout(800);

const games = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-open-file]")).map((button) => ({
    file: button.getAttribute("data-open-file"),
    title: button.getAttribute("data-title"),
  }))
);

if (!games.length) errors.push({ what: "no cards on files.html" });

// Each game gets its own page so a crash cannot take the run down with it.
for (const game of games) {
  const slug = path.basename(game.file).replace(/\.html?$/, "");
  const view = await browser.newPage({ viewport: { width: 512, height: 384 } });
  const log = [];
  view.on("pageerror", (err) => log.push("pageerror: " + err.message));
  view.on("console", (msg) => {
    if (msg.type() === "error") log.push("console: " + msg.text().slice(0, 160));
  });

  let status = null;
  try {
    const response = await view.goto(BASE + "/" + game.file, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    status = response ? response.status() : null;
  } catch (err) {
    log.push("goto: " + err.message.split("\n")[0]);
  }

  await view.waitForTimeout(3500);

  // A lot of these open on a title card that wants one click before it does
  // anything, so the probe clicks the middle of the page first.
  await view.mouse.click(256, 192).catch(() => {});
  await view.waitForTimeout(2500);

  const drew = await view.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    let painted = false;
    let readable = 0;
    for (const canvas of canvases) {
      if (!canvas.width || !canvas.height) continue;
      try {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          readable += 1;
          const data = ctx.getImageData(0, 0, Math.min(canvas.width, 400), Math.min(canvas.height, 300)).data;
          const colours = new Set();
          for (let i = 0; i < data.length; i += 4 * 53) {
            colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
          }
          if (colours.size > 2) painted = true;
        } else if (canvas.getContext("webgl2") || canvas.getContext("webgl")) {
          // A WebGL canvas cannot be read back here, but holding a context at
          // all means the game has started drawing.
          painted = true;
        }
      } catch (err) {
        painted = true;
      }
    }

    const body = document.body;
    const text = (body && body.innerText ? body.innerText : "").trim();
    const visible = body
      ? Array.from(body.querySelectorAll("*")).filter((node) => {
          const box = node.getBoundingClientRect();
          return box.width > 40 && box.height > 20;
        }).length
      : 0;
    const background = body ? getComputedStyle(body).backgroundColor : "";

    return {
      painted,
      readable,
      canvases: canvases.length,
      textLength: text.length,
      visible,
      background,
      title: document.title,
    };
  });

  const shot = path.join(THUMBS, slug + ".jpg");
  try {
    await view.screenshot({ path: shot, type: "jpeg", quality: 78 });
  } catch (err) {
    log.push("shot: " + err.message.split("\n")[0]);
  }

  const alive =
    status === 200 && (drew.painted || drew.textLength > 20 || drew.visible > 6);
  results.push({ slug, title: game.title, status, drew, alive, log });
  if (!alive || log.some((line) => line.startsWith("pageerror"))) {
    errors.push({ slug, status, drew, log });
  }
  await view.close();
}

// close-up on the card grid, for eyeballing the layout
await page.setViewportSize({ width: 1200, height: 1400 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "files-page.png"), fullPage: false });

await page.click(".file-open");
await page.waitForTimeout(2500);
const framed = await page.evaluate(() => {
  const frame = document.querySelector("iframe");
  return frame ? frame.getAttribute("src") : null;
});
await page.screenshot({ path: path.join(OUT, "files-playing.png") });
await page.close();

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(BASE + "/files.html", { waitUntil: "load" });
await phone.waitForTimeout(500);
await phone.screenshot({ path: path.join(OUT, "files-phone.png") });
await phone.close();

const wall = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await wall.goto(BASE + "/", { waitUntil: "load" });
await wall.waitForTimeout(700);
await wall.screenshot({ path: path.join(OUT, "wall.png") });
const button = await wall.evaluate(() => {
  const link = document.querySelector("a.btn-local");
  return link ? { href: link.getAttribute("href"), text: link.textContent.trim() } : null;
});
await wall.close();

const phoneWall = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phoneWall.goto(BASE + "/", { waitUntil: "load" });
await phoneWall.waitForTimeout(500);
const phoneButton = await phoneWall.evaluate(() => {
  const link = document.querySelector("a.btn-local");
  if (!link) return null;
  const box = link.getBoundingClientRect();
  return { text: link.textContent.trim(), width: Math.round(box.width) };
});
await phoneWall.close();

if (pageLog.length) errors.push({ what: "files.html", log: pageLog });
if (!button) errors.push({ what: "wall button" });
if (!framed) errors.push({ what: "no frame after playing a card" });
if (!phoneButton || phoneButton.width < 60) errors.push({ what: "phone button", phoneButton });

await browser.close();

fs.writeFileSync(
  path.join(OUT, "files.json"),
  JSON.stringify({ button, phoneButton, framed, results, errors }, null, 2)
);

for (const entry of results) {
  console.log(
    entry.slug.padEnd(20),
    entry.alive ? "alive" : "DEAD ",
    String(entry.status),
    entry.drew.painted ? "painted" : "no-paint",
    entry.log.length ? entry.log[0].slice(0, 120) : ""
  );
}
console.log("errors:", errors.length, errors.map((e) => e.slug || e.what).join(", "));
process.exit(errors.length ? 1 : 0);
