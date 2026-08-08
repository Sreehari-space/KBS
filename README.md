# KBS — Retail POS for Tamil Nadu small stores

A point-of-sale and billing app aimed at **kirana / provision stores in Tamil Nadu**:
Tamil-first, works with no internet, barcode + QR scanning, clean 58mm thermal bills, and
WhatsApp bill delivery.

> **Status:** the current code is an early demo — data lives in memory and is lost on refresh.
> A full technical design for the upgrade is in [`docs/`](docs/README.md) and is awaiting review
> before implementation starts.

## Design docs

Start at **[docs/README.md](docs/README.md)** for the index and the decision log.

| Doc | Covers |
|---|---|
| [01 — Architecture](docs/01-architecture.md) | Offline-first client design, PWA, repository layer, file structure |
| [02 — Data model](docs/02-data-model.md) | Schema, IndexedDB stores, money as integer paise |
| [03 — Billing & scanning](docs/03-billing-scanner.md) | Barcode + QR, learn-as-you-scan, kg/gram selling |
| [04 — Bill, print & WhatsApp](docs/04-bill-print-whatsapp.md) | 58mm thermal bill, WhatsApp text + image, UPI QR |
| [05 — Ledger, Tamil, day close](docs/05-ledger-tamil-dayclose.md) | Credit ledger (கடன்), i18n, day close, backup |
| [06 — Roadmap](docs/06-roadmap.md) | Phased delivery, risks, open questions |
| [07 — Auto-save & durability](docs/07-autosave-durability.md) | Auto-save guarantees, commit protocol, draft recovery, storage budget |

## Run locally

**Prerequisites:** Node.js

```bash
npm install
npm run dev
```

AI features currently read `GEMINI_API_KEY` from `.env.local`. Note that this key is compiled
into the client bundle — see [D8](docs/README.md#decision-log) for the planned fix.
