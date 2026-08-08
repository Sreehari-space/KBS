# 06 — Roadmap

Each task below is meant to be one reviewable commit or PR. Phases are ordered by dependency,
not by excitement — the scanner and WhatsApp bill are the visible wins, but they sit on top of
persistence and offline, and they're worth nothing without them.

## Phase 1 — Foundation

**Goal: a sale survives a page refresh, and the app opens with no internet.**

| # | Task | Touches |
|---|---|---|
| 1.1 | Remove the CDN importmap and Tailwind CDN; bundle React + install Tailwind properly; self-host Noto Sans Tamil | `index.html`, `tailwind.config.js`, `package.json` |
| 1.2 | Restructure into `src/` per [doc 01](01-architecture.md); move existing components unchanged | whole tree |
| 1.3 | `domain/money.ts` + `domain/cart.ts` with paise arithmetic, Indian formatting, round-off — **with unit tests** | `src/domain/` |
| 1.4 | Dexie schema, repository interfaces, Dexie implementations | `src/data/` |
| 1.5 | Replace `useState` data with `useLiveQuery`; delete prop-drilling from `App.tsx` | `App.tsx`, all screens |
| 1.6 | TN kirana seed data with Tamil names, units, real barcodes | `src/data/seed/` |
| 1.7 | i18n scaffolding + Tamil strings + header language toggle | `src/i18n/` |
| 1.8 | Settings persisted via `settingsRepo`; **wire tax/GSTIN/UPI into billing** (currently dead) | `features/settings/` |
| 1.9 | PWA: manifest, service worker, install prompt, update toast | `vite.config.ts` |
| 1.10 | Remove `API_KEY` from the bundle; move Gemini behind a user-supplied key | `vite.config.ts`, `geminiService.ts` |
| 1.11 | JSON backup export/import + Web Share | `features/backup/` |

**Done when:** bill a sale on an Android phone in aeroplane mode, force-close the browser,
reopen — the sale is in history, stock is decremented, the UI is in Tamil.

## Phase 2 — Scanning & the bill

**Goal: the two features originally asked for.**

| # | Task |
|---|---|
| 2.1 | `useBarcodeScanner` — `BarcodeDetector` + lazy ZXing fallback |
| 2.2 | `ScannerSheet` — full-screen camera, torch, continuous mode, beep + vibrate, debounce |
| 2.3 | Learn-as-you-scan: unknown code → prefilled new-product sheet → straight into cart |
| 2.4 | EAN-13 checksum validation + manual barcode entry fallback |
| 2.5 | `domain/bill.ts` — `buildBill()` and the `Bill` model |
| 2.6 | `BillPreview` — 58mm layout, on-screen and `@page`-based printing; delete the popup printer |
| 2.7 | `billToText` + `wa.me` send (Tier A) |
| 2.8 | `billToCanvas` + `navigator.share` image send (Tier B) |
| 2.9 | Local UPI QR generation; remove the `api.qrserver.com` dependency |
| 2.10 | Round-off, savings line, split payments, cash-tendered/change |
| 2.11 | Mobile-first billing layout: sticky total bar, cart bottom sheet, quick tiles |

**Done when:** scan four packaged items with the camera, print a clean 58mm bill, and send the
same bill to WhatsApp as both text and image — all offline except the WhatsApp send itself.

## Phase 3 — What makes it indispensable

| # | Task |
|---|---|
| 3.1 | Ledger model + repository + balance calculation (**unit tested**) |
| 3.2 | Ledger list, customer statement, collect-payment flow |
| 3.3 | Credit as a payment mode in billing; balance shown before committing the sale |
| 3.4 | WhatsApp credit reminders |
| 3.5 | Opening-balance bulk entry for migrating the paper notebook |
| 3.6 | Units + decimal quantities; kg/gram keypad sheet with amount-based entry |
| 3.7 | GST mode: CGST/SGST split, HSN, slabs, tax-inclusive pricing |
| 3.8 | Day close screen + WhatsApp summary |
| 3.9 | Reports rebuilt on real sales data (replaces the hardcoded arrays) |
| 3.10 | Hold/resume bills; returns and refunds |
| 3.11 | Low-stock reorder list → WhatsApp to supplier |

**Done when:** a shop can run a full month — credit sales, collections, daily closes — without
touching the paper notebook.

## Phase 4 — Delight

| # | Task |
|---|---|
| 4.1 | Web Bluetooth + ESC/POS direct printing, with raster path for Tamil |
| 4.2 | Tamil voice billing — Web Speech API `ta-IN`, "இரண்டு கிலோ அரிசி" → cart |
| 4.3 | Shop-printed QR labels for loose goods |
| 4.4 | Weight-embedded barcode parsing |
| 4.5 | Expiry & batch tracking (opens up medical shops) |
| 4.6 | AI: Tamil name normalisation, daily business summary — all behind the user's own key |
| 4.7 | Staff PIN lock |
| 4.8 | Optional Google Drive API sync |

## Sequencing note

If seeing the scanner and the new bill sooner matters more than completeness, a **slim
Phase 1** is viable: tasks 1.1–1.5 and 1.9 only (bundling, restructure, money, Dexie,
liveQuery, PWA), deferring Tamil, seed data, and backup to run alongside Phase 2. That gets to
a working scanner roughly a third faster without building anything that has to be thrown away.

What can't be skipped is 1.1 and 1.4. Without bundled dependencies there is no offline app,
and without persistence there is nothing worth scanning into.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `BarcodeDetector` missing on the shop's device | Scanner dead on iOS/Firefox | ZXing WASM fallback, spec'd in Phase 2 |
| Camera needs HTTPS | Scanner silently fails on a plain-HTTP deployment | HTTPS hosting is part of Phase 1, not an afterthought |
| Browser storage eviction | **Total data loss** | `storage.persist()`, backup reminders, visible last-backup date |
| Cheap thermal printers lack Tamil fonts | Tamil bills print as boxes | ESC/POS raster path reusing `billToCanvas` |
| Web Bluetooth is Android-only | No direct print on iOS | Browser print (Path 1) is never removed |
| Shop has no barcodes at all | Scanner is useless there | Search, quick tiles, and direct keypad entry are first-class, not fallbacks |
| GST rules change | Compliance drift | GST is off by default; slabs and HSN are data, not code |
| Single device holds all data | Phone lost = business lost | Backup export in Phase 1, before real use begins |

## Open questions

Worth settling before Phase 1 starts, though none of them block it:

1. **Is there a real shop to pilot with?** One actual kirana using this for a week will
   reorder this roadmap more usefully than any further planning.
2. **Which comes first for that shop — scanning or the credit ledger?** If their stock is
   mostly loose goods, the ledger matters far more and Phase 3.1–3.5 should move ahead of
   Phase 2.
3. **GST registered or not?** Decides whether GST mode is Phase 3 work or can slip to Phase 4.
4. **Existing printer?** If they already own a specific 58mm Bluetooth model, ESC/POS support
   can be tested against real hardware early rather than written blind.
5. **How many products in their current catalogue?** Over ~200 and the opening bulk-import
   flow needs more thought than learn-as-you-scan alone.
