/* One-off probe: does the Eaglercraft build load, and will it sit in a frame?
   Writes probe/eagler.json and two screenshots, then the workflow commits them
   so the sandbox can read the answer back over git. */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = "https://eymenwsmc.site/262/index.html?v=u2";
const OUT = "probe";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--enable-webgl"],
});

async function run(label, target) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on("console", (m) => {
    if (logs.length < 120) logs.push(m.type() + ": " + m.text().slice(0, 400));
  });
  page.on("pageerror", (e) => {
    if (logs.length < 120) logs.push("pageerror: " + String(e.message).slice(0, 400));
  });
  let status = null;
  try {
    const res = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
    status = res ? res.status() : null;
  } catch (err) {
    logs.push("goto: " + String(err.message).slice(0, 400));
  }
  await page.waitForTimeout(35000);
  const info = {};
  try {
    info.url = page.url();
    info.title = await page.title();
    info.frames = page.frames().map((f) => f.url());
    info.canvas = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      return c ? { w: c.width, h: c.height, visible: !!(c.offsetWidth || c.offsetHeight) } : null;
    });
    info.bodyText = (await page.evaluate(() => (document.body ? document.body.innerText : ""))).slice(0, 800);
    await page.setViewportSize({ width: 512, height: 384 });
    await page.screenshot({ path: path.join(OUT, label + "-small.png") });
    await page.setViewportSize({ width: 1280, height: 800 });
  } catch (err) {
    logs.push("inspect: " + String(err.message).slice(0, 400));
  }
  await page.screenshot({ path: path.join(OUT, label + ".png") }).catch(() => {});
  await page.close();
  return { status, info, logs };
}

const direct = await run("eagler-direct", URL);

// Our own page shaping up around it: a bare iframe, exactly like the player.
const harness = `<!doctype html><meta charset="utf-8">
<title>embed harness</title>
<style>html,body{margin:0;background:#111;height:100%}iframe{width:100%;height:100vh;border:0}</style>
<iframe src="${URL}" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>`;
fs.writeFileSync(path.join(OUT, "harness.html"), harness);
const embedded = await run("eagler-embedded", "file://" + path.resolve(OUT, "harness.html"));

// Headers and page head, straight from the network stack.
const request = await browser.newContext();
const got = {};
try {
  const res = await request.request.get(URL, { timeout: 60000, maxRedirects: 5 });
  got.status = res.status();
  got.url = res.url();
  got.headers = res.headers();
  const html = (await res.text()).slice(0, 200000);
  got.htmlBytes = html.length;
  got.metas = Array.from(html.matchAll(/<meta[^>]+(?:og:image|twitter:image|og:title)[^>]*>/gi)).map((m) => m[0]);
  got.icons = Array.from(html.matchAll(/<link[^>]+rel=["'](?:icon|apple-touch-icon)[^>]*>/gi)).map((m) => m[0]);
  got.images = Array.from(new Set(Array.from(html.matchAll(/["']([^"']+\.(?:png|jpe?g|webp|gif|svg))["']/gi)).map((m) => m[1]))).slice(0, 40);
  got.head = html.slice(0, 1200);
} catch (err) {
  got.error = String(err.message).slice(0, 400);
}
await request.close();
await browser.close();

fs.writeFileSync(
  path.join(OUT, "eagler.json"),
  JSON.stringify({ url: URL, direct, embedded, network: got }, null, 2)
);
console.log("probe done");
