# KBS — Retail POS for Tamil Nadu small stores

Billing for **kirana / provision stores in Tamil Nadu**: Tamil-first, works with no internet,
and every bill saved automatically to the device.

**Phase 1 is built.** Barcode/QR scanning and the WhatsApp bill are Phase 2 — see the
[roadmap](docs/06-roadmap.md).

## What works today

- **Offline-first.** The app boots and bills with zero network. Verified in a browser with the
  network fully disabled.
- **Auto-save, no Save button.** Each sale is written in one atomic transaction (bill + stock +
  ledger + bill number). The receipt renders only after that commits; if it fails the cart is
  kept so it can be retried.
- **Draft recovery.** The in-progress cart is persisted (debounced) and offered back on next
  open — this is what survives Android killing a backgrounded tab.
- **Tamil / English**, switchable from the header, with a self-hosted Tamil font so text
  renders offline.
- **Integer paise money** throughout, Indian lakh formatting, round-off to the nearest rupee.
- **Weight selling** — kg/gram keypad with presets, and "₹50 worth of tomatoes" amount entry.
- **Split payments**, cash-tendered/change, and credit assigned to a customer.
- **60-item TN provision-store catalogue** seeded on first run.
- **Reports from real sales**, and **JSON backup** export/restore via the OS share sheet.
- **Installable PWA** with an update prompt (never an auto-reload — that would lose the cart).

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 65 unit tests
npm run build
```

No API keys or environment variables are needed. AI features are optional and read a Gemini key
the shop owner enters in Settings, stored on their own device.

> The camera needs HTTPS, so Phase 2's scanner will require a real HTTPS origin (or localhost).

## Architecture

```
src/
├─ domain/       pure logic, unit-tested — money, cart totals, GST, barcode
├─ data/         Dexie/IndexedDB schema + repositories (UI never touches Dexie)
├─ features/     billing, bill, inventory, customers, reports, settings, backup, pwa
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
| [06 — Roadmap](docs/06-roadmap.md) | Phased delivery, risks, open questions |
| [07 — Auto-save & durability](docs/07-autosave-durability.md) | Auto-save guarantees, commit protocol, storage budget |
