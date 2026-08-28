/**
 * Drive the built app through a real session and capture every screen the
 * case study uses.
 *
 *   npm run preview          # in another shell, serving dist/ on 4173
 *   node docs/behance/src/capture.mjs
 *
 * Nothing here is a mockup. The reports, the outstanding balance and the bill
 * numbers on the boards are whatever this session actually produced.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.CAPS_DIR || path.join(HERE, '../../../.caps');
fs.mkdirSync(OUT, { recursive: true });

const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.APP_URL || 'http://127.0.0.1:4173/';

const L = {
  en: {
    next: 'Next', finish: 'Start billing', bill: 'BILL', cash: 'Cash', add: 'Add',
    complete: /Complete sale/, newSale: 'New sale', reports: 'Reports',
    rice: 'Idli Rice', milk: 'Aavin Milk', biscuit: 'Biscuit Pack',
  },
  ta: {
    next: 'அடுத்து', finish: 'பில் போடத் தொடங்கு', bill: 'பில் போடு', cash: 'ரொக்கம்',
    add: 'சேர்', complete: /விற்பனை முடி/, newSale: /புதிய/, reports: 'அறிக்கை',
    rice: 'இட்லி அரிசி', milk: 'ஆவின் பால்', biscuit: 'பிஸ்கட்',
  },
};

async function open({ lang, dark }) {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    colorScheme: dark ? 'dark' : 'light',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const wait = (ms = 500) => page.waitForTimeout(ms);
  // The theme comes from stored settings, so dark has to be re-forced after
  // each navigation rather than set once.
  const force = async () => {
    if (dark) {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await wait(650);
    }
  };
  const shot = async (n) => {
    await force();
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    console.log('  ', n);
  };
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (lang === 'en') await page.getByRole('button', { name: 'English' }).click();
  return { browser, page, wait, shot, errs };
}

const sheetOf = (page) => page.getByRole('dialog');
const tileOf = (page, n) => page.locator('main button', { hasText: n }).first();
const navOf = (page, n) => page.locator('nav button', { hasText: n }).first();

/** ── the full English walkthrough, plus the onboarding boards ──────────── */
async function main() {
  const t = L.en;
  const { browser, page, wait, shot, errs } = await open({ lang: 'en', dark: false });
  const sheet = () => sheetOf(page);
  const tile = (n) => tileOf(page, n);
  const nav = (n) => navOf(page, n);

  // ── first run, captured as it is walked ────────────────────────────────
  await wait(400);
  await shot('onb-1');
  await page.locator('main input').first().fill('Sri Murugan Stores');
  await page.getByRole('button', { name: t.next }).click();
  await wait(700);
  await shot('onb-2');
  await page.getByRole('button', { name: /^No$/ }).click();
  await page.getByRole('button', { name: t.next }).click();
  await wait(700);
  for (const [i, [n, p]] of [['Ponni Rice', '62'], ['Toor Dal', '145'], ['Sunflower Oil', '160']].entries()) {
    await page.locator('main section input').nth(i * 2).fill(n);
    await page.locator('main section input').nth(i * 2 + 1).fill(p);
  }
  await wait(300);
  await shot('onb-3');
  await page.getByRole('button', { name: t.finish }).click();
  await wait(1500);
  await shot('01-till-empty');

  // ── a customer, so credit has somebody to be owed by ───────────────────
  await nav('More').click();
  await wait(600);
  await page.getByRole('button', { name: /Customers/ }).last().click();
  await wait(800);
  await page.getByText(/Add customer/).first().click();
  await wait(700);
  const fields = sheet().locator('input');
  await fields.nth(0).fill('Lakshmi Amma');
  if ((await fields.count()) > 1) await fields.nth(1).fill('9843012345');
  await sheet().getByRole('button', { name: /Save|Add/ }).last().click();
  await wait(900);
  await shot('11-customers');
  await nav('Billing').click();
  await wait(700);

  // ── the basket the boards are built around ─────────────────────────────
  const addWeight = async (name, chip, shotName) => {
    await tile(name).click();
    await wait(600);
    await sheet().getByRole('button', { name: chip, exact: true }).click();
    await wait(300);
    if (shotName) await shot(shotName);
    await sheet().getByRole('button', { name: t.add }).click();
    await wait(500);
  };
  // Deliberately not the three items setup just created — those now sit on the
  // front screen as this shop's own quick tiles, which is the point of asking
  // for them, and adding them again here would only show duplicates.
  await addWeight(t.rice, '2kg', '02-quantity');
  await addWeight('Chilli Powder', '250g');
  await tile(t.milk).click(); await wait(320);
  await tile(t.milk).click(); await wait(320);
  await tile(t.biscuit).click(); await wait(500);
  await shot('03-till-cart');

  await page.locator('button', { hasText: /^\d+ items?/ }).first().click();
  await wait(700);
  await shot('04-cart-sheet');
  await page.locator('button', { hasText: /^BILL/ }).last().click();
  await wait(900);
  await shot('05-payment-cash');
  await sheet().getByRole('button', { name: 'Credit', exact: true }).click();
  await wait(600);
  await shot('06-payment-credit');
  await sheet().getByRole('button', { name: t.cash, exact: true }).click();
  await wait(400);
  await sheet().getByRole('button', { name: t.complete }).click();
  await wait(1200);
  await shot('07-receipt');
  const newSale = async () => {
    const b = page.getByRole('button', { name: t.newSale });
    if (await b.count()) { await b.click(); await wait(800); }
  };
  await newSale();

  // ── a few more sales, so the reports have a shape to show ──────────────
  for (const basket of [['Egg', 'Egg', 'Maggi Noodles'], ['Bath Soap', 'Coconut'], ['Biscuit Pack', 'Egg']]) {
    for (const p of basket) { await tile(p).click(); await wait(280); }
    await page.getByRole('button', { name: /^BILL$/ }).click();
    await wait(650);
    await sheet().getByRole('button', { name: t.cash, exact: true }).click();
    await wait(300);
    await sheet().getByRole('button', { name: t.complete }).click();
    await wait(1100);
    await newSale();
  }

  // ── search, then one sale put on the credit book ───────────────────────
  await page.getByPlaceholder(/Search items/i).fill('tea');
  await wait(700);
  await shot('09-search');
  await tile('Tea Powder').click();
  await wait(700);
  await sheet().getByRole('button', { name: '250g', exact: true }).click().catch(() => {});
  await wait(250);
  await sheet().getByRole('button', { name: t.add }).click();
  await wait(600);
  await page.getByPlaceholder(/Search items/i).fill('sugar');
  await wait(700);
  await tile('Sugar').click();
  await wait(700);
  await sheet().getByRole('button', { name: '1kg', exact: true }).click().catch(() => {});
  await wait(250);
  await sheet().getByRole('button', { name: t.add }).click();
  await wait(600);
  await page.getByPlaceholder(/Search items/i).fill('');
  await wait(500);
  await page.getByRole('button', { name: /^BILL$/ }).click();
  await wait(700);
  await sheet().getByRole('button', { name: 'Credit', exact: true }).click();
  await wait(500);
  await sheet().locator('select').first().selectOption({ index: 1 });
  await wait(500);
  await sheet().getByRole('button', { name: t.complete }).click();
  await wait(1300);
  await shot('08-receipt-credit');
  await newSale();

  // ── the rest of the app ────────────────────────────────────────────────
  const scrollMain = (to) =>
    page.locator('main .overflow-y-auto').first().evaluate((e, y) => e.scrollTo(0, y), to).catch(() => {});
  await nav(t.reports).click(); await wait(1300); await shot('10-reports');
  await scrollMain(99999); await wait(600); await shot('10b-reports-lower');
  await nav('Credit').click(); await wait(1000); await shot('12-ledger');
  await nav('Stock').click(); await wait(1000); await shot('13-stock');
  await nav('More').click(); await wait(600);
  await page.getByText(/^Bills$/).last().click(); await wait(1000); await shot('14-bills');
  await nav('More').click(); await wait(600);
  await page.getByText(/^Settings$/).last().click(); await wait(1000); await shot('15-settings');
  await scrollMain(600); await wait(500); await shot('15b-settings-lower');
  await nav('More').click(); await wait(600);
  await page.getByText(/Day Close/).last().click(); await wait(1000); await shot('16-dayclose');

  console.log('main session errors:', errs.length ? errs : 'none');
  await browser.close();
}

/** ── shorter runs for the dark and Tamil boards ────────────────────────── */
async function variant({ lang, dark, prefix }) {
  const t = L[lang];
  const { browser, page, wait, shot, errs } = await open({ lang, dark });
  const sheet = () => sheetOf(page);
  const tile = (n) => tileOf(page, n);

  await page.locator('main input').first()
    .fill(lang === 'en' ? 'Sri Murugan Stores' : 'ஸ்ரீ முருகன் ஸ்டோர்ஸ்');
  await page.getByRole('button', { name: t.next }).click(); await wait(650);
  await page.locator('main section button').first().click();
  await page.getByRole('button', { name: t.next }).click(); await wait(650);
  await page.getByRole('button', { name: t.finish }).click(); await wait(1500);

  await tile(t.rice).click(); await wait(700);
  await sheet().getByRole('button', { name: '2kg', exact: true }).click(); await wait(250);
  await sheet().getByRole('button', { name: t.add }).click(); await wait(600);
  await tile(t.milk).click(); await wait(350);
  await tile(t.biscuit).click(); await wait(600);
  await shot(prefix + 'till');

  await page.locator('button', { hasText: /^\d+/ }).first().click().catch(() => {});
  await wait(700);
  await shot(prefix + 'cart');
  await page.locator('button', { hasText: new RegExp('^' + t.bill) }).last().click();
  await wait(900);
  await sheet().getByRole('button', { name: t.cash, exact: true }).click(); await wait(350);
  await shot(prefix + 'payment');
  await sheet().getByRole('button', { name: t.complete }).click(); await wait(1300);
  await shot(prefix + 'receipt');
  const ns = page.getByRole('button', { name: t.newSale });
  if (await ns.count()) { await ns.click(); await wait(800); }
  await navOf(page, t.reports).click(); await wait(1300);
  await shot(prefix + 'reports');
  console.log(prefix, 'errors:', errs.length ? errs : 'none');
  await browser.close();
}

await main();
await variant({ lang: 'en', dark: true, prefix: 'dk-' });
await variant({ lang: 'ta', dark: false, prefix: 'ta-' });
console.log('captures written to', OUT);
