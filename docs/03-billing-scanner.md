# 03 — Billing & Scanning

## The scanning reality check

The request was "scan the QR code on products". The honest position:

**Indian retail products carry EAN-13 barcodes, not QR codes.** A Maggi packet, an Aavin milk
sachet, a Colgate tube — all barcodes. QR codes that do appear on Indian packaging are
marketing or BharatQR payment links, not product identifiers.

**And scanning a barcode tells you nothing on its own.** `8901058000023` is just a number.
There is no free, complete, legally usable database mapping Indian EANs to product names and
prices. Paid APIs exist but have thin coverage of regional and local brands — exactly what a
TN kirana stocks.

So the design is:

1. **Scan both formats in one camera view** — EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39,
   _and_ QR. QR support costs nothing extra and covers shop-printed labels (below).
2. **Learn as you scan (D4).** The shop's catalogue builds itself during normal billing.

### Learn-as-you-scan flow

```
      ┌─────────────┐
      │ Scan a code │
      └──────┬──────┘
             ▼
   ┌───────────────────────┐
   │ barcode in products?  │
   └────┬─────────────┬────┘
     yes│             │no
        ▼             ▼
  ┌───────────┐  ┌──────────────────────────────┐
  │ Add to    │  │ "புதிய பொருள்" sheet:        │
  │ cart      │  │ barcode prefilled            │
  │ beep +    │  │ → name, price, unit          │
  │ vibrate   │  │ → Save                        │
  │ stay open │  └──────────────┬───────────────┘
  └───────────┘                 ▼
                        ┌───────────────┐
                        │ Saved + added │
                        │ to cart       │
                        └───────────────┘
              Next scan of that code = instant
```

After roughly two weeks of ordinary billing, a shop's fast-moving items are all in the
catalogue with zero dedicated data-entry session. That is the entire reason this approach
beats asking the owner to type in 400 products before they can start.

**Loose goods get shop-printed QR labels.** Rice, dal, homemade sweets, local produce — none
have manufacturer barcodes. Inventory can print a sheet of QR labels encoding
`kbs:p:<productId>`, which the shop sticks on bins or bags. This is where QR genuinely earns
its place, and it's why we scan both formats.

### The QR-on-the-packet trap

Most Indian FMCG packs now carry a QR _next to_ the striped barcode — and it is almost never a
product identifier. It is usually a campaign URL, and increasingly it is **batch- or
packet-specific**, meaning a different payload on every single packet.

Scanning one of those decodes perfectly well, so learn-as-you-scan would happily create a
catalogue entry keyed to it. That entry would look like it worked, then never match again — and
on a serialised pack it would create a fresh product for _every packet sold_.

So `looksLikeMarketingQr()` flags payloads that are `http(s)://`, `upi://`, `www.`-prefixed, or
longer than 20 characters (real retail barcodes are shorter). When an unknown code trips it, the
new-item sheet shows a **red warning** instead of the usual hint, telling the shopkeeper to scan
the striped barcode instead. It is a warning, not a block — the shopkeeper may have a reason —
but it should never happen silently. Our own `kbs:p:` labels are exempt.

## Scanner implementation

```
src/features/scanner/
├─ ScannerSheet.tsx       full-screen camera overlay
├─ useBarcodeScanner.ts   detection engine + fallback
└─ beep.ts               WebAudio tone — no asset to load
```

**Engine selection, in order:**

1. **`BarcodeDetector`** — native, built into Chrome on Android. Fast, zero bundle cost,
   hardware-accelerated. This is what most target devices will use.
2. **ZXing WASM fallback** (`@zxing/library`) — for iOS Safari and desktop Firefox, which have
   no `BarcodeDetector`. Loaded **lazily**, only when the scanner opens and the native API is
   missing. It must not sit in the main bundle.

```ts
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

async function createDetector() {
  if ('BarcodeDetector' in globalThis) {
    const supported = await BarcodeDetector.getSupportedFormats();
    return new BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) });
  }
  const { BrowserMultiFormatReader } = await import('@zxing/library'); // lazy
  return wrapZxing(new BrowserMultiFormatReader());
}
```

**Camera:** `getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })`.
Detection runs in a `requestAnimationFrame` loop against the video frame.

**Behaviours that decide whether a shopkeeper keeps using this:**

| Behaviour                                                                      | Why                                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Continuous mode** — camera stays open after each hit                         | A 20-item bill must not require 20 taps to reopen the camera                                                                              |
| **Beep + `navigator.vibrate(40)`**                                             | Staff scan without looking at the screen. The beep _is_ the feedback                                                                      |
| **1500 ms duplicate debounce**, keyed by code                                  | Holding one packet in frame otherwise registers 5 times. Scanning the _same_ item twice on purpose still works — just tap `+` in the cart |
| **Torch toggle** via `track.applyConstraints({ advanced: [{ torch: true }] })` | Shop lighting is often poor, and barcodes on shiny wrappers need it                                                                       |
| **Manual entry fallback**                                                      | Faded and torn labels are routine. Never trap the user in a camera that can't read                                                        |
| **Running scanned-item strip** at the bottom of the camera view                | Confirms what went in without closing the scanner                                                                                         |
| **Permission-denied state** with recovery instructions                         | "Camera blocked → tap the lock icon in the address bar". Otherwise the feature looks broken                                               |

**Checksum validation.** `domain/barcode.ts` validates the EAN-13 check digit before lookup.
A misread that fails the checksum is discarded silently rather than creating a junk product.

**Weight-embedded barcodes** (Phase 3). Supermarket scales print labels like `2PPPPPWWWWWC`
where digits encode grams. Parsed only when `settings.scanner.weightBarcodePrefix` is set,
since the encoding varies by scale vendor and a wrong guess would mis-price goods.

### Fallbacks, because scanning is never the only path

Many TN kiranas have **no barcodes at all** on half their stock. The scanner is an
accelerator, never a requirement. Three parallel ways to add a line:

- **Tamil + English search** — one box matching `nameTa`, `nameEn`, barcode, and SKU
- **Quick tiles** — the 15–20 items that are most of daily sales, one tap, no typing
- **Direct entry** — numeric keypad, type rate and quantity for an item not in the catalogue

## Billing screen

Replaces `components/Sales.tsx`. The current layout is desktop-shaped — sidebar plus a 4-column
product grid plus a fixed cart column. On a phone that's unusable.

**Phone (primary target):**

```
┌─────────────────────────────┐
│ 🔍 search        [📷 Scan]  │   scan button is large and always visible
├─────────────────────────────┤
│  Quick tiles / search hits  │   scrollable
│  ┌────┐ ┌────┐ ┌────┐       │
│  │அரிசி│ │பால் │ │சர்க்கரை│  │
│  └────┘ └────┘ └────┘       │
├─────────────────────────────┤
│ 🛒 4 items        ₹ 452.00  │   sticky bottom bar — tap to expand cart
│         [ பில் / BILL ]      │
└─────────────────────────────┘
```

Cart is a bottom sheet that expands over the products. Totals are always visible in the sticky
bar so the shopkeeper can read the running amount aloud while still adding items.

**Desktop/tablet:** keep today's two-pane layout — it's genuinely good on a wide screen.

### Quantity entry for weight items

Tapping a `kg` product opens a numeric keypad sheet, not a `+`/`−` stepper:

```
   தக்காளி  /  Tomato
   ₹40.00 / kg
   ┌───────────────────┐
   │        2.5        │  kg
   └───────────────────┘
   [250g] [500g] [1kg] [2kg]     ← one-tap presets
   ┌───┬───┬───┐
   │ 1 │ 2 │ 3 │
   │ 4 │ 5 │ 6 │
   │ 7 │ 8 │ 9 │
   │ . │ 0 │ ⌫ │
   └───┴───┴───┘
        ₹ 100.00
      [ சேர் / ADD ]
```

Also supports **entering the amount instead of the weight** — "₹50 worth of tomatoes" is how
customers actually ask. The sheet computes `qty = amount / unitPrice` and rounds to grams.
This is a small feature that gets used constantly.

### Payment

Replaces the single-choice payment buttons. A payment sheet supporting:

- **Split payment** — add multiple `Payment` rows until they cover the total
- **Credit (கடன்)** — assign the remainder to a customer; requires selecting one; shows their
  current balance and warns (never blocks) past the credit limit
- **UPI QR** — generated from `settings.shop.upiVpa`, not the hardcoded `user@okbank` in
  `Sales.tsx:300`. Generated **locally** with a QR library, not fetched from
  `api.qrserver.com` — that call fails offline, which is exactly when it's needed
- **Cash tendered → change due** — "customer gave ₹500, return ₹48". Constant mental
  arithmetic at the counter that the app should just do

### Hold / resume

Customer forgets something and walks back to the aisle; the next customer is waiting. Park the
bill (`status: 'held'`), serve the next person, resume later. Held bills survive a refresh
because they're in IndexedDB.

### Returns

Open a past bill → select lines → generate a return bill with negative quantities linked via
`returnOfSaleId`. Stock goes back up; a refund is recorded as a negative payment, or credited
to the customer's ledger. Currently impossible in KBS.

## Totals calculation

`domain/cart.ts`, pure and unit-tested:

```
lineTotal   = round(qty × unitPricePaise) − lineDiscountPaise
subtotal    = Σ lineTotal
afterDisc   = subtotal − billDiscountPaise
tax         = gst.enabled ? computeGst(lines, pricesIncludeTax) : 0
             (when pricesIncludeTax, tax is EXTRACTED from afterDisc, not added)
preRound    = afterDisc + (pricesIncludeTax ? 0 : tax)
roundOff    = roundOffEnabled ? roundOffDelta(preRound) : 0
total       = preRound + roundOff
credit      = total − Σ payments
```

Every value is integer paise. The invariant `Σ payments + credit === total` is asserted before
a sale is committed — if it fails, the sale is rejected rather than written wrong.
