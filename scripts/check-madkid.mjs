/* Non-destructive browser audit of EVERY MadKid source. A canvas is only a
   rendering signal, not proof that an entire game works. Never prunes games. */
import { chromium } from 'playwright';
import fs from 'node:fs';

global.window = {};
await import('../assets/js/catalog.js');
const urls = [...new Set(window.CATALOG.flatMap(g => g.sources)
  .filter(s => s.portal === 'madkidgames.com').map(s => s.url))];
const origin = process.env.SITE_ORIGIN || 'https://funclassroom.github.io';
const browser = await chromium.launch();
const results = [];
const queue = [...urls];
try {
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const url = queue.shift();
      const page = await browser.newPage();
      const result = { url, status: null, outcome: 'unverified', frames: [] };
      page.on('response', r => { if (r.url() === url) result.status = r.status(); });
      page.on('requestfailed', r => {
        if (r.url() === url) result.networkError = r.failure()?.errorText;
      });
      try {
        // Browser uses the deployment origin/referrer, not about:blank.
        // Only this harness is mocked; publisher requests go to the real host.
        const harness = origin + '/__madkid_audit__';
        await page.route(harness, route => route.fulfill({
          contentType: 'text/html', body: '<!doctype html><title>Embed audit</title>'
        }));
        await page.goto(harness);
        await page.evaluate(src => {
          const frame = document.createElement('iframe');
          frame.src = src;
          frame.allow = 'autoplay; fullscreen; gamepad; pointer-lock';
          frame.width = '1000'; frame.height = '700';
          document.body.append(frame);
        }, url);
        await page.waitForTimeout(12000);
        for (const frame of page.frames().slice(1)) {
          try {
            result.frames.push(await frame.evaluate(() => ({
              url: location.href,
              canvas: document.querySelectorAll('canvas').length,
              text: (document.body?.innerText || '').slice(0, 2000)
            })));
          } catch { /* detached or inaccessible frame remains unverified */ }
        }
        const text = result.frames.map(f => f.text).join('\n');
        if (/embedding unavailable|access denied|just a moment|verify you are human/i.test(text)) {
          result.outcome = 'blocked-or-challenged';
        } else if (result.networkError || result.status >= 400) {
          result.outcome = 'request-failed';
        } else if (result.frames.some(f => f.canvas > 0)) {
          result.outcome = 'canvas-detected';
        }
      } catch (error) { result.error = String(error); }
      finally { await page.close(); }
      results.push(result);
      console.log(`${results.length}/${urls.length}: ${result.outcome} ${url}`);
    }
  }));
} finally { await browser.close(); }
const counts = {};
for (const result of results) counts[result.outcome] = (counts[result.outcome] || 0) + 1;
const report = { checkedAt: new Date().toISOString(), origin, checked: results.length,
  note: 'Automated render signals only; canvas-detected does not prove gameplay. No games removed.',
  counts, results: results.sort((a, b) => a.url.localeCompare(b.url)) };
fs.writeFileSync('madkid-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checked: report.checked, counts }));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  `## MadKid browser audit\nChecked ${report.checked} unique players from ${origin}.\n\n\`\`\`json\n${JSON.stringify(counts, null, 2)}\n\`\`\`\n\nCanvas detection is not gameplay verification. See the JSON artifact for every URL. No games were removed.\n`);
