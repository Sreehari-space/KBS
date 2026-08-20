# 01 — Architecture

## Design constraints

These come from the shop floor, not from preference.

1. **The counter must work with zero internet.** Rural and semi-urban TN connectivity is
   intermittent. A sale must never fail because the network dropped.
2. **The device is usually an Android phone**, sometimes a cheap laptop. Billing UI must be
   thumb-reachable and fast on a low-end device.
3. **No server, no monthly bill.** The shop owner installs a web app and it works.
4. **The camera needs HTTPS.** So the app must be served from a real HTTPS origin (or
   `localhost`), which makes deployment part of the design, not an afterthought.

## Critical blocker in the current code

**KBS today cannot work offline at all**, regardless of what we cache.

`index.html` loads React from a CDN at runtime:

```html
<script type="importmap">
  {
    "imports": {
      "react": "https://aistudiocdn.com/react@^19.2.0",
      "recharts": "https://aistudiocdn.com/recharts@^3.3.0"
    }
  }
</script>
<script src="https://cdn.tailwindcss.com"></script>
```

With no internet the browser cannot resolve `react`, so nothing renders — a service worker
can't fix a dependency that was never part of our build output. Tailwind is the same story:
the CDN build compiles classes in the browser at runtime.

**Required change (D2):**

- Delete the `importmap` block. React, recharts, etc. come from `package.json` and get
  bundled by Vite (they are already listed as dependencies — only `index.html` bypasses them).
- Delete the `cdn.tailwindcss.com` script. Install Tailwind as a dev dependency with a real
  `tailwind.config.js` (port the existing colour tokens verbatim) and a PostCSS build step.
- Self-host the **Noto Sans Tamil** font as a woff2 in `public/fonts/`. A Google Fonts link
  would break Tamil rendering offline.
- Replace `picsum.photos` product images. Images become either a generated initial/emoji tile
  or a user-supplied photo stored as a `Blob` in IndexedDB. No remote image URLs anywhere.

Until D2 lands, every other offline feature is theatre.

## Layered architecture

```
┌──────────────────────────────────────────────────┐
│  UI (React components, feature folders)          │
│  Knows nothing about Dexie or IndexedDB          │
└───────────────────────┬──────────────────────────┘
                        │ calls
┌───────────────────────▼──────────────────────────┐
│  Repositories  (async interfaces)                │
│  ProductRepo, SaleRepo, CustomerRepo,            │
│  LedgerRepo, SettingsRepo                        │
└───────────────────────┬──────────────────────────┘
                        │ implemented by
┌───────────────────────▼──────────────────────────┐
│  DexieRepo  (IndexedDB)          ← only impl now │
│  SupabaseRepo                    ← possible later│
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Domain (pure functions, zero I/O, unit-tested)  │
│  money · cart totals · GST · bill · barcode      │
└──────────────────────────────────────────────────┘
```

**Why the repository layer (D3)?** The UI never imports Dexie. If the shop later wants two
counters sharing one catalogue, we write a second implementation of the same interfaces and
the billing screen doesn't change. The cost is a handful of thin interface files.

**Why a separate domain layer?** Cart totals, tax split, round-off, and barcode parsing are
where money bugs live. As pure functions with no React and no database, they're trivially
unit-testable — and these are the only parts of the app I'd insist have tests.

## State management

No Redux, no Zustand. Two mechanisms:

- **Dexie's `liveQuery` + `useLiveQuery`** for anything persisted. Components subscribe to a
  query and re-render when IndexedDB changes. This removes almost all of today's
  `useState` + prop-drilling (`App.tsx` currently threads `products`, `setProducts`,
  `customers`, `sales` through every screen).
- **One React context** for ephemeral session state: the open cart, active language, active
  theme. The cart is also mirrored to IndexedDB on every change so a browser crash mid-bill
  loses nothing.

## PWA

`vite-plugin-pwa` with Workbox.

- **Precache** the full app shell — JS, CSS, fonts, icons. Everything needed to boot.
- **No runtime network caching**, because after D2 there are no runtime network requests.
- `display: "standalone"`, `orientation: "any"`, `start_url: "/"`, maskable icons.
- **Icons** are generated from `assets/logo.png` by `scripts/build-icons.py`, never hand-
  exported. The logo is a 3D render, so the script does three things the eye would miss:
  it keeps every icon opaque (iOS paints a transparent apple-touch icon black), it writes
  dithered 255-colour PNGs rather than truecolor (a third of the bytes, and undithered
  quantisation bands across the gradient), and it holds the maskable artwork inside the
  0.8w safe circle. Re-run the script after any change to the master; don't edit the PNGs.
- **Update flow:** a new service worker shows a "புதிய பதிப்பு / Update available" toast and
  activates on tap. Never auto-reload — a forced reload mid-bill would lose the cart.
- **Install prompt:** capture `beforeinstallprompt` and show an "Install KBS" button in
  Settings. Shop owners won't discover the browser's own menu item.

## Deployment

Static hosting with HTTPS. Netlify / Cloudflare Pages / GitHub Pages all work and all have a
free tier. The build output is plain static files — no Node runtime needed.

## Security: the Gemini key (D8)

`vite.config.ts` currently does this:

```js
define: { 'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY) }
```

That string-replaces the key into the JavaScript bundle. Anyone who opens DevTools on the
deployed site can read it and spend against the account.

In a client-only app there is no way to hide a shared key. So:

- Remove both `define` entries.
- AI features become **bring-your-own-key**: Settings gets an optional "Gemini API key" field,
  stored in IndexedDB on the shop's own device. The shop owner's key, the shop owner's quota.
- Every AI feature degrades silently when no key is set — the panel just doesn't appear.
  **No AI call may ever sit on the billing path.** Billing works with no key and no internet.
- If the existing key has been deployed anywhere, **rotate it**.

Related cleanup: `services/geminiService.ts:30` sends the literal string
`[YOUR_INVENTORY_JSON]` to the model, and `Reports.tsx` fires two model calls on mount. Both
need fixing when AI moves behind a key check.

## Target file structure

```
kbs/
├─ index.html                      # importmap + Tailwind CDN removed
├─ assets/logo.png                 # icon master, not shipped
├─ scripts/build-icons.py          # regenerates public/icons/
├─ vite.config.ts                  # + PWA plugin, - API_KEY define
├─ tailwind.config.js              # NEW — colour tokens moved out of index.html
├─ public/
│  ├─ fonts/NotoSansTamil-*.woff2  # self-hosted, offline-safe
│  └─ icons/                       # generated — see scripts/build-icons.py
└─ src/
   ├─ main.tsx
   ├─ App.tsx                      # shell + nav only; no data state
   │
   ├─ domain/                      # pure, no I/O, unit-tested
   │  ├─ types.ts                  # see doc 02
   │  ├─ money.ts                  # paise arithmetic, ₹ formatting, round-off
   │  ├─ cart.ts                   # line totals, discounts, bill totals
   │  ├─ gst.ts                     # CGST/SGST split, HSN, slabs
   │  ├─ barcode.ts                # EAN-13 checksum, weight-embedded parsing
   │  └─ bill.ts                   # Sale -> Bill model (doc 04)
   │
   ├─ data/
   │  ├─ db.ts                     # Dexie schema + version migrations
   │  ├─ repositories/
   │  │  ├─ types.ts               # repo interfaces
   │  │  ├─ productRepo.ts
   │  │  ├─ saleRepo.ts
   │  │  ├─ customerRepo.ts
   │  │  ├─ ledgerRepo.ts
   │  │  └─ settingsRepo.ts
   │  └─ seed/tnKiranaProducts.ts  # replaces data/mockData.ts
   │
   ├─ features/
   │  ├─ billing/                  # replaces components/Sales.tsx
   │  │  ├─ BillingScreen.tsx
   │  │  ├─ ProductSearch.tsx
   │  │  ├─ QuickTiles.tsx
   │  │  ├─ CartPanel.tsx
   │  │  ├─ QuantitySheet.tsx      # kg / gram entry
   │  │  ├─ PaymentSheet.tsx       # split payment + credit
   │  │  └─ HeldBills.tsx
   │  ├─ scanner/
   │  │  ├─ ScannerSheet.tsx
   │  │  ├─ useBarcodeScanner.ts   # BarcodeDetector + ZXing fallback
   │  │  └─ beep.ts                # WebAudio, no asset file
   │  ├─ bill/
   │  │  ├─ BillPreview.tsx        # 58mm on-screen
   │  │  ├─ billToText.ts          # WhatsApp text
   │  │  ├─ billToCanvas.ts        # WhatsApp PNG
   │  │  ├─ billToEscPos.ts        # Phase 4
   │  │  └─ ShareSheet.tsx
   │  ├─ inventory/                # replaces components/Inventory.tsx
   │  ├─ customers/                # replaces components/Customers.tsx
   │  ├─ ledger/                   # NEW — கடன்
   │  ├─ dayclose/                 # NEW — கடை சாத்து
   │  ├─ reports/                  # replaces components/Reports.tsx (real data)
   │  ├─ settings/                 # replaces components/Settings.tsx
   │  └─ backup/                   # JSON export / import
   │
   ├─ i18n/
   │  ├─ en.ts
   │  ├─ ta.ts
   │  └─ useT.ts
   │
   ├─ components/ui/               # Button, Sheet, Modal, NumericKeypad, Toast
   ├─ hooks/
   └─ styles/index.css
```

## Migration map

| Today                                               | Becomes                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `App.tsx` (holds all data in `useState`)            | Shell + routing only. Data comes from `useLiveQuery`.                     |
| `data/mockData.ts` (US grocery)                     | `data/seed/tnKiranaProducts.ts` (TN provisions, seeded on first run only) |
| `components/Sales.tsx` (319 lines, does everything) | Split across `features/billing/` and `features/bill/`                     |
| `components/Inventory.tsx`                          | `features/inventory/` + units, barcodes, cost price                       |
| `components/Reports.tsx` (hardcoded arrays)         | `features/reports/` reading real sales                                    |
| `components/Settings.tsx` (fields wired to nothing) | `features/settings/` persisted via `settingsRepo`                         |
| `constants.tsx` (ICONS)                             | Keep as-is. It works.                                                     |
| `services/geminiService.ts`                         | Keep, but behind a user-supplied key and off the billing path             |

## Testing

Vitest. Deliberately narrow — this is a solo-maintained app, not an enterprise codebase.

**Must have tests** (pure domain, where money bugs hide):
`money.ts` · `cart.ts` · `gst.ts` · `barcode.ts` · `bill.ts` · ledger balance calculation

**Should have:** repository CRUD against `fake-indexeddb`.

**Skip:** component tests. Manual QA on a real Android phone is more valuable per hour here.

## Explicitly out of scope

Multi-branch · multi-user roles · e-invoicing / IRN · payment gateway integration ·
purchase orders · accounting exports (Tally) · native app store builds.
