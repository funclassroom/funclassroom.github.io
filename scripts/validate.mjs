/* Load game embeds in a real Chromium and report which ones render nothing.
   Run by .github/workflows/validate.yml; writes data/dead-sources.json.

   Only portals that answer a clean, unauthenticated browser are checked.
   madkidgames.com sits behind a Cloudflare challenge, so it is skipped:
   from a browser that has passed the check it plays fine, and calling those
   titles dead because a robot could not get in would delete working games. */
import { chromium } from "playwright";
import fs from "node:fs";

const SAMPLE = Number(process.env.SAMPLE || 240);
const LANES = Number(process.env.LANES || 8);
const WAIT = Number(process.env.WAIT || 7000);
const ONLY = (process.env.ONLY || "gamemonetize.com").split(",");

global.window = {};
const { CATALOG } = await import("../assets/js/catalog.js").then(() => ({
  CATALOG: global.window.CATALOG,
}));

const pool = [];
const seen = new Set();
for (const game of CATALOG) {
  for (const source of game.sources) {
    if (!ONLY.includes(source.portal)) continue;
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    pool.push({ id: game.id, title: game.title, portal: source.portal, url: source.url });
  }
}

// Spread the sample across the whole catalogue, not just the first page.
const step = Math.max(1, Math.floor(pool.length / SAMPLE));
const targets = pool.filter((_, i) => i % step === 0).slice(0, SAMPLE);

const browser = await chromium.launch();
const results = [];

async function check(target) {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  let status = null;
  let failed = null;
  page.on("response", (r) => {
    if (r.url() === target.url && status === null) status = r.status();
  });
  page.on("requestfailed", (r) => {
    if (r.url() === target.url) failed = r.failure()?.errorText || "failed";
  });

  await page.setContent(
    `<body style="margin:0"><iframe src="${target.url}" style="width:900px;height:560px;border:0"></iframe></body>`
  ).catch(() => {});
  await page.waitForTimeout(WAIT);

  const look = await page.evaluate(() => {
    const frame = document.querySelector("iframe");
    let inner = null;
    try {
      const doc = frame.contentDocument;
      if (doc) {
        inner = {
          canvas: doc.querySelectorAll("canvas").length,
          bodyLen: (doc.body?.innerText || "").trim().length,
          text: (doc.body?.innerText || "").slice(0, 120),
        };
      }
    } catch (err) {
      inner = { blocked: true };
    }
    return inner;
  }).catch(() => null);

  // The publisher's own frame is cross-origin, so the outer document cannot
  // inspect it. Count its subframes and look for a canvas inside them.
  const frames = page.frames().filter((f) => f !== page.mainFrame());
  let sub = { frames: frames.length, canvas: 0, text: "" };
  for (const f of frames) {
    try {
      const info = await f.evaluate(() => ({
        canvas: document.querySelectorAll("canvas").length,
        text: (document.body?.innerText || "").trim().slice(0, 160),
      }));
      sub.canvas += info.canvas;
      if (!sub.text) sub.text = info.text;
    } catch (err) { /* cross-origin, ignore */ }
  }

  await page.close();

  const dead =
    failed !== null ||
    (status !== null && status >= 400) ||
    (sub.canvas === 0 && sub.frames <= 1) ||
    /404|not found|does not exist|unavailable/i.test(sub.text || "");

  return { ...target, status, failed, sub, dead };
}

const queue = targets.slice();
await Promise.all(
  Array.from({ length: LANES }, async () => {
    while (queue.length) {
      const t = queue.shift();
      try {
        results.push(await check(t));
      } catch (err) {
        results.push({ ...t, dead: false, error: String(err).slice(0, 120) });
      }
    }
  })
);

await browser.close();

const dead = results.filter((r) => r.dead);
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(
  "data/dead-sources.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      checked: results.length,
      dead: dead.length,
      urls: dead.map((d) => d.url),
      detail: dead.slice(0, 40),
    },
    null,
    2
  )
);

console.log(`checked ${results.length}, dead ${dead.length}`);
for (const d of dead.slice(0, 15)) console.log("dead:", d.url, d.status, d.failed || "");
