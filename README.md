# KBS — Retail POS for Tamil Nadu small stores

Billing for **kirana / provision stores in Tamil Nadu**: Tamil-first, works with no internet,
every bill saved automatically, and a credit ledger that replaces the notebook behind the
counter.

Phases 1–3 of the [roadmap](docs/06-roadmap.md) are built, plus most of Phase 4.

## What it does

**Billing**
- Barcode **and** QR scanning in one camera view — native `BarcodeDetector` with a lazy ZXing
  fallback for iOS/Firefox. Continuous mode, torch, beep + vibrate, duplicate debounce, and
  manual entry for faded labels.
- **Learn as you scan** — an unknown barcode opens a prefilled new-item sheet; every scan after
  that is instant. The catalogue builds itself during normal billing.
- **Weight selling** — kg/gram keypad with presets, plus "₹50 worth of tomatoes" amount entry.
- **Tamil voice input** — "இரண்டு கிலோ அரிசி" adds 2 kg of rice.
- Split payments, cash-tendered → change due, credit assigned to a customer, hold/resume bills.

**The bill**
- One bill model, four renderers: 58 mm HTML (screen + print), plain text, PNG, ESC/POS bytes —
  so paper, WhatsApp text and WhatsApp image can never disagree.
- **WhatsApp** as text (`wa.me`) or as an image (Web Share). Zero cost, no Meta account.
- **UPI QR generated locally**, so it still works with no internet.
- **Bluetooth thermal printing** (ESC/POS) with a raster path so Tamil prints correctly on
  printers that have no Tamil font. Browser printing is always available as a fallback.

**Credit ledger (கடன்)**
- Per-customer running balance, append-only statement, part collections, WhatsApp reminders,
  and opening balances for migrating an existing paper notebook.

**Shop operations**
- **Day close** — expected vs. counted cash, difference, WhatsApp summary, one-tap backup.
- **Returns** — original bills are never edited; a return is a linked negative bill.
- Low-stock reorder list → WhatsApp to the supplier.
- Printable **QR shelf labels** for loose goods that have no manufacturer barcode.
- Reports from real sales. GST mode (CGST/SGST, HSN, slabs) — off by default.
- Optional staff PIN.

**Underneath**
- **Offline-first.** Boots and bills with zero network — verified with the network disabled.
- **Auto-save, no Save button.** Each sale commits in one atomic transaction (bill + stock +
  ledger + bill number) with strict durability. The receipt renders only after it lands; on
  failure the cart survives so it can be retried.
- **Draft recovery** for the in-progress cart — survives Android killing a backgrounded tab.
- **Integer paise** money, Indian lakh formatting, round-off to the nearest rupee.
- Installable PWA with an update prompt (never an auto-reload — that would lose the cart).
- JSON backup export/restore through the OS share sheet.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 93 unit tests
npm run build
```

No API keys or environment variables are needed. AI features are optional and would read a
Gemini key the shop owner enters in Settings, stored on their own device.

> **The camera needs HTTPS.** Scanning works on `localhost` in development, but a deployment
> must be served over HTTPS or the scanner will silently fail.

## Architecture

```
src/
├─ domain/       pure logic, unit-tested — money, cart totals, GST, barcode, bill
├─ data/         Dexie/IndexedDB schema + repositories (UI never touches Dexie)
├─ features/     billing, scanner, bill, ledger, bills, dayclose, inventory,
│                customers, reports, settings, backup, voice, lock, pwa
├─ i18n/         ta / en dictionaries + useT hook
└─ components/   shared UI primitives
```

## Design docs

Start at **[docs/README.md](docs/README.md)** for the index and the decision log.

| Doc | Covers |
|---|---|
| [01 — Architecture](docs/01-architecture.md) | Offline-first design, PWA, repository layer, file structure |
| [02 — Data model](docs/02-data-model.md) | Schema, IndexedDB stores, money as integer paise |
| [03 — Billing & scanning](docs/03-billing-scanner.md) | Barcode + QR, learn-as-you-scan, kg/gram selling |
| [04 — Bill, print & WhatsApp](docs/04-bill-print-whatsapp.md) | 58mm thermal bill, WhatsApp text + image, UPI QR |
| [05 — Ledger, Tamil, day close](docs/05-ledger-tamil-dayclose.md) | Credit ledger (கடன்), i18n, day close, backup |
| [06 — Roadmap](docs/06-roadmap.md) | Delivery status, what was left out and why, risks |
| [07 — Auto-save & durability](docs/07-autosave-durability.md) | Auto-save guarantees, commit protocol, storage budget |

## Known limits

- **Off-device backup is manual.** Auto-save covers crashes and killed tabs; it does not cover
  a lost or wiped phone. The day-close screen prompts for a backup, but it still needs a tap.
  See the end of [doc 06](docs/06-roadmap.md) for what to add before real money depends on it.
- **Not built by choice:** expiry/batch tracking (that's a medical-shop feature and needs a
  batch-level data model), AI features, and Google Drive API sync. Reasons in doc 06.
