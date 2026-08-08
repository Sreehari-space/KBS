# 06 — Roadmap

Each task below is meant to be one reviewable commit or PR. Phases are ordered by dependency,
not by excitement — the scanner and WhatsApp bill are the visible wins, but they sit on top of
persistence and offline, and they're worth nothing without them.

> **Status: Phases 1–3 are built, and most of Phase 4.** 93 unit tests plus browser runs
> verifying offline boot, offline billing, draft recovery, atomic commit and rollback, unique
> bill numbers under concurrency, learn-as-you-scan, credit sales into the ledger, collections,
> and returns.
>
> **Not built, deliberately** — see "What was left out" at the end of this doc:
> expiry/batch tracking (4.5), AI features (4.6), and Google Drive sync (4.8).

## Phase 1 — Foundation ✅

**Goal: a sale survives a page refresh, and the app opens with no internet.**

| # | Task | Touches |
|---|---|---|
| 1.1 | Remove the CDN importmap and Tailwind CDN; bundle React + install Tailwind properly; self-host Noto Sans Tamil | `index.html`, `tailwind.config.js`, `package.json` |
| 1.2 | Restructure into `src/` per [doc 01](01-architecture.md); move existing components unchanged | whole tree |
| 1.3 | `domain/money.ts` + `domain/cart.ts` with paise arithmetic, Indian formatting, round-off — **with unit tests** | `src/domain/` |
| 1.4 | Dexie schema, repository interfaces, Dexie implementations | `src/data/` |
| **1.4a** | **Atomic sale-commit transaction** per [doc 07](07-autosave-durability.md): sales + stock + ledger + bill counter in one transaction, strict durability, receipt renders only on success, cart preserved on failure | `data/repositories/saleRepo.ts` |
| **1.4b** | **Draft auto-save** — debounced cart persistence + restore-on-boot banner | `features/billing/` |
| **1.4c** | **Storage protection** — `persist()`, quota monitoring + 80% warning, incognito detection, non-silent write failures | `src/data/db.ts` |
| 1.5 | Replace `useState` data with `useLiveQuery`; delete prop-drilling from `App.tsx` | `App.tsx`, all screens |
| 1.6 | TN kirana seed data with Tamil names and units (no barcodes — see doc 02) | `src/data/seed/` |
| 1.7 | i18n scaffolding + Tamil strings + header language toggle | `src/i18n/` |
| 1.8 | Settings persisted via `settingsRepo`; **wire tax/GSTIN/UPI into billing** (currently dead) | `features/settings/` |
| 1.9 | PWA: manifest, service worker, install prompt, update toast | `vite.config.ts` |
| 1.10 | Remove `API_KEY` from the bundle; move Gemini behind a user-supplied key | `vite.config.ts`, `geminiService.ts` |
| 1.11 | JSON backup export/import + Web Share | `features/backup/` |

**Done when:** all ten acceptance tests in
[doc 07](07-autosave-durability.md#acceptance-criteria) pass on a real Android phone — including
force-stopping the browser straight after billing, and having Android kill the tab mid-cart.

## Phase 2 — Scanning & the bill ✅

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

## Phase 3 — What makes it indispensable ✅

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

## Phase 4 — Delight (4.1–4.4, 4.7 ✅)

| # | Task |
|---|---|
| 4.1 | Web Bluetooth + ESC/POS direct printing, with raster path for Tamil |
| 4.2 | Tamil voice billing — Web Speech API `ta-IN`, "இரண்டு கிலோ அரிசி" → cart |
| 4.3 | Shop-printed QR labels for loose goods |
| 4.4 | Weight-embedded barcode parsing |
| 4.5 | Expiry & batch tracking (opens up medical shops) — **not built**, see below |
| 4.6 | AI: Tamil name normalisation, daily business summary — **not built**, key field ships |
| 4.7 | Staff PIN lock |
| 4.8 | Optional Google Drive API sync — **not built**, see D7 |

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
| Android kills a backgrounded tab mid-bill | Cart lost, customer waiting | Debounced draft auto-save + restore banner (task 1.4b) |
| Storage quota exhausted by product photos | Writes start failing | Images capped at 50 KB before storage; 80% quota warning ([doc 07](07-autosave-durability.md)) |
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

## What was left out, and why

Three Phase 4 items were deliberately not built. Each is a scope judgement, not an oversight.

**4.5 — Expiry and batch tracking.** This exists to open up *medical shops*, which was
explicitly not the target: the agreed focus is kirana/provision stores ([README](README.md)).
Doing it properly means batch-level stock, per-batch expiry, FEFO picking on the billing path,
and a drug licence number on the bill — a different data model, not a field. Building it half
way would be worse than not having it, because a pharmacy would trust stock numbers that aren't
batch-aware. Worth doing as its own phase if a medical shop actually wants to pilot.

**4.6 — AI features.** The plumbing is in place — Settings takes a Gemini key, stored on the
shop's own device (D8) — but no feature consumes it yet. The reason is the constraint that
shaped everything else: this app must work with no internet. Every AI call fails offline, so AI
can only ever be a garnish on screens the shop doesn't depend on. That is real work for
marginal value next to, say, expiry tracking. The key field ships so the capability is there
when a specific, genuinely useful AI feature is identified.

**4.8 — Google Drive API sync.** Argued against in D7 and that reasoning still holds: a GCP
project, an OAuth consent screen, a client ID in public JavaScript, and internet at backup
time. Backup instead exports JSON through the OS share sheet, which reaches Drive in two taps
because the Drive app is already signed in. The day-close screen ends with a one-tap backup so
it rides on a daily ritual rather than a reminder.

### The gap that remains

Auto-save fully covers crashes, forgetting to save, and Android killing a backgrounded tab. It
does **not** cover the phone being lost, stolen or wiped — the data lives in one browser
profile on one device, and off-device backup still depends on the owner tapping the button.

The credit ledger is the part whose loss is unrecoverable: it is money owed that no customer
will volunteer. If this is ever rolled out beyond a pilot shop, automatic off-device backup
(option 3 from the durability discussion — a daily encrypted blob to a tiny endpoint) is the
one thing I would add before real money depends on it.
