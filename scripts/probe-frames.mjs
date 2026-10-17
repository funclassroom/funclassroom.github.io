// Ground truth about framing: load each candidate in a real Chromium iframe
// and record what the browser says, not what curl says.
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = {};
const TARGETS = [
  ["madkid-subway", "https://www.madkidgames.com/full/subway-surfers"],
  ["madkid-stickwar", "https://www.madkidgames.com/full/stick-war-legacy"],
  ["madkid-moto", "https://www.madkidgames.com/full/moto-x3m"],
  ["gamemonetize", "https://html5.gamemonetize.co/aafq217bqi3jbg0q7yacv2lj8i0av6i4/"],
  ["gameflare-game", "https://www.gameflare.com/online-game/subway-surfers/"],
  ["gameflare-embed", "https://www.gameflare.com/embed/subway-surfers/"],
  ["kbh-game", "https://kbhgames.com/game/stick-war-legacy"],
  ["y8-embed", "https://www.y8.com/embed/stick_war_legacy"],
  ["gamepix-embed", "https://www.gamepix.com/embed/subway-surfers"],
  ["htmlgames", "https://www.htmlgames.com/embed/subway-surfers"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });

for (const [name, url] of TARGETS) {
  const result = { url, events: [], status: null, headers: {}, failed: null };
  const onFailed = (req) => {
    if (req.url().startsWith(url.slice(0, 60))) result.failed = req.failure()?.errorText || "failed";
  };
  const onResponse = async (res) => {
    if (!res.url().startsWith(url.slice(0, 60))) return;
    result.status = res.status();
    const h = res.headers();
    if (h["x-frame-options"]) result.headers.xfo = h["x-frame-options"];
    if (h["content-security-policy"]) result.headers.csp = h["content-security-policy"].slice(0, 200);
  };
  page.on("requestfailed", onFailed);
  page.on("response", onResponse);

  await page.setContent(
    `<body style="margin:0;background:#111"><iframe src="${url}" style="width:1080px;height:760px;border:0"></iframe></body>`
  ).catch(() => {});
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `probe-${name}.png` }).catch(() => {});

  page.off("requestfailed", onFailed);
  page.off("response", onResponse);
  OUT[name] = result;
  console.log(name, JSON.stringify(result).slice(0, 400));
}

// Now the real thing: our own site, with a MadKid tile deep-linked.
for (const [name, hash] of [["site-madkid", "subway-surfers"], ["site-gm", "https://socks275.github.io/ClassroomGames/" + "#p=aafq217bqi3jbg0q7yacv2lj8i0av6i4"]]) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const logs = [];
  p.on("console", (m) => logs.push(m.type() + ": " + m.text().slice(0, 160)));
  p.on("pageerror", (e) => logs.push("pageerror: " + String(e).slice(0, 160)));
  const url = name === "site-madkid"
    ? "https://socks275.github.io/ClassroomGames/#p=" + hash
    : hash;
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => logs.push("goto: " + e.message));
  await p.waitForTimeout(14000);
  await p.screenshot({ path: `probe-${name}.png` }).catch(() => {});
  const info = await p.evaluate(() => ({
    iframes: document.querySelectorAll("iframe").length,
    blocked: !document.querySelector("[data-blocked]")?.hidden,
    source: document.querySelector("[data-source]")?.textContent,
    title: document.querySelector("[data-player-title]")?.textContent,
  })).catch((e) => ({ err: String(e) }));
  OUT[name] = { info, logs: logs.slice(0, 12) };
  console.log(name, JSON.stringify(OUT[name]).slice(0, 500));
  await p.close();
}

await browser.close();
fs.writeFileSync("probe-frames.json", JSON.stringify(OUT, null, 2));
