import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..');
fs.mkdirSync(OUT, { recursive: true });

const assets = JSON.parse(fs.readFileSync(path.join(HERE, 'bassets.json'), 'utf8'));
let html = fs.readFileSync(path.join(HERE, 'boards.html'), 'utf8');
for (const [k, v] of Object.entries(assets.fonts)) html = html.split(`{{FONT:${k}}}`).join(v);
for (const [k, v] of Object.entries(assets.shots)) html = html.split(`{{SHOT:${k}}}`).join(v);
const missing = [...html.matchAll(/\{\{[A-Z]+:([^}]+)\}\}/g)].map((m) => m[0]);
if (missing.length) { console.log('UNSUBSTITUTED:', [...new Set(missing)]); process.exit(1); }
const tmp = path.join(HERE, '_boards.full.html');
fs.writeFileSync(tmp, html);

const NAMES = {
  bcover: '00-behance-cover',
  b01: '01-cover', b02: '02-the-counter', b03: '03-scope', b04: '04-principles',
  b05: '05-colour', b06: '06-money', b07: '07-two-scripts', b08: '08-the-billing-screen',
  b09: '09-one-sale', b10: '10-loose-goods', b11: '11-the-credit-book', b12: '12-the-bill',
  b13: '13-reports', b14: '14-offline', b15: '15-dark', b16: '16-first-run',
  b17: '17-what-broke', b18: '18-close',
};

const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 });
await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

const report = [];
for (const [id, name] of Object.entries(NAMES)) {
  const el = page.locator('#' + id);
  const box = await el.boundingBox();
  await el.screenshot({ path: `${OUT}/${name}.png` });
  const bytes = fs.statSync(`${OUT}/${name}.png`).size;
  report.push({ name, w: Math.round(box.width), h: Math.round(box.height), kb: Math.round(bytes / 1024) });
}
console.table(report);

// horizontal overflow anywhere?
const over = await page.evaluate(() =>
  [...document.querySelectorAll('.board')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.id));
console.log('boards overflowing horizontally:', over.length ? over : 'none');
// did the display face actually load?
console.log('display font:', await page.evaluate(() => {
  const h = document.querySelector('h1');
  return document.fonts.check(getComputedStyle(h).font) ? getComputedStyle(h).fontFamily : 'FALLBACK IN USE';
}));
await browser.close();
