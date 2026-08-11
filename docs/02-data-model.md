# 02 — Data Model

## Money: integer paise only (D1)

Today's code stores rupees as floats and computes tax as `subtotal * 0.08`. That produces
totals like `13.469999999999999`, and the receipt then _back-computes_ the subtotal with
`total / 1.08` (`Sales.tsx:144`), which silently breaks the moment the tax rate changes.

**Rule: every monetary value in the database, in the domain layer, and in component props is
an integer number of paise.** Rupees exist only at the moment of display and at the moment a
user types a number.

```ts
// domain/money.ts
export type Paise = number; // branded in the real impl

export const rupeesToPaise = (r: number): Paise => Math.round(r * 100);
export const paiseToRupees = (p: Paise): number => p / 100;

/** ₹1,25,000.50 — Indian lakh/crore grouping, not 125,000.50 */
export const formatINR = (p: Paise, opts?: { paise?: boolean }) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: opts?.paise === false ? 0 : 2,
  }).format(paiseToRupees(p));

/** Round-off to the nearest rupee. Returns the delta to add. */
export const roundOffDelta = (p: Paise): Paise => Math.round(p / 100) * 100 - p;
```

Quantities are the one deliberate exception: a `kg` line is `2.5`, stored as a float. We keep
those at 3 decimal places (gram precision) and always compute the line amount as
`Math.round(qty * unitPricePaise)` so the _money_ stays integral even though the quantity isn't.

## Types

```ts
// domain/types.ts

export type Id = string; // crypto.randomUUID()
export type Paise = number;
export type ISODate = string; // ISO 8601 UTC

export type Unit = 'piece' | 'kg' | 'g' | 'litre' | 'ml' | 'packet';
export type GstSlab = 0 | 5 | 12 | 18 | 28;

// ─── Product ────────────────────────────────────────────────────────────────
export interface Product {
  id: Id;
  nameEn: string;
  nameTa: string; // "" until the shop fills it in
  barcodes: string[]; // multi-valued index; a pack can have old + new codes
  sku?: string;
  category: string;

  unit: Unit;
  /** Price per unit. For unit:'kg' this is the price per kilogram. */
  sellPricePaise: Paise;
  costPricePaise?: Paise; // optional; enables real profit reporting

  stockQty: number; // decimal for weight units
  lowStockThreshold: number;
  trackStock: boolean; // false for loose items the shop doesn't count

  hsn?: string; // only when GST mode is on
  gstSlab?: GstSlab;

  imageBlobId?: Id; // -> images store; never a remote URL
  isQuickTile: boolean; // pinned to the billing screen's quick grid

  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate; // soft delete — old bills must still resolve names
}
```

> **Why soft delete?** A bill printed in April must still be readable in October even if the
> product was removed in June. Sale lines snapshot their own data (below), but soft delete
> also keeps reports from showing gaps.

```ts
// ─── Customer ───────────────────────────────────────────────────────────────
export interface Customer {
  id: Id;
  name: string;
  phone: string; // 10-digit local; +91 added only when building wa.me links
  address?: string;

  /** Denormalised running credit balance in paise. Positive = customer owes the shop.
   *  Source of truth is the ledger; this is a cache, recomputable at any time. */
  balancePaise: Paise;
  creditLimitPaise?: Paise; // soft warning at billing time, never a hard block

  notes?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
}
```

```ts
// ─── Sale ───────────────────────────────────────────────────────────────────
export interface SaleLine {
  productId: Id;
  /** Snapshot at time of sale. Renaming or repricing a product must never alter
   *  a bill that was already printed. */
  nameEn: string;
  nameTa: string;
  unit: Unit;
  qty: number;
  unitPricePaise: Paise;
  lineDiscountPaise: Paise;
  /** round(qty * unitPricePaise) - lineDiscountPaise */
  lineTotalPaise: Paise;
  gstSlab?: GstSlab;
  hsn?: string;
}

export type PaymentMode = 'cash' | 'upi' | 'card' | 'credit';

export interface Payment {
  mode: PaymentMode;
  amountPaise: Paise;
  reference?: string; // UPI txn ref, last 4 of card
}

export type SaleStatus = 'completed' | 'held' | 'returned' | 'partially_returned';

export interface Sale {
  id: Id;
  /** Human-facing bill number, resets daily: "080826-014". Shown on the printed bill. */
  billNo: string;
  createdAt: ISODate;

  lines: SaleLine[];

  subtotalPaise: Paise; // sum of lineTotalPaise
  billDiscountPaise: Paise; // whole-bill discount on top of line discounts
  taxPaise: Paise; // 0 when GST mode is off
  roundOffPaise: Paise; // signed; -0.40 or +0.30
  totalPaise: Paise; // subtotal - billDiscount + tax + roundOff

  payments: Payment[]; // split payment: ₹300 cash + ₹200 UPI
  /** Unpaid remainder. > 0 means a ledger entry was created. */
  creditPaise: Paise;

  customerId?: Id; // required when creditPaise > 0
  status: SaleStatus;
  returnOfSaleId?: Id; // set on a return bill, pointing at the original
  note?: string;
}
```

> **Split payments matter.** "₹300 cash and the rest GPay" is an everyday request. Today's
> model allows exactly one `PaymentMethod` per sale, so this is a schema change, not a UI tweak.

> **Bill numbering.** `DDMMYY-NNN`, sequence resetting each day. Generated inside the same
> Dexie transaction that writes the sale, so two fast taps can't collide.

```ts
// ─── Ledger (கடன்) ──────────────────────────────────────────────────────────
export type LedgerEntryType =
  | 'opening_balance' // migrating an existing paper notebook
  | 'credit_sale' // goods taken on credit  -> increases balance
  | 'payment' // customer settles       -> decreases balance
  | 'adjustment'; // manual correction / write-off

export interface LedgerEntry {
  id: Id;
  customerId: Id;
  at: ISODate;
  type: LedgerEntryType;
  /** Signed. Positive increases what the customer owes. */
  amountPaise: Paise;
  saleId?: Id; // set for credit_sale
  paymentMode?: PaymentMode; // set for payment
  note?: string;
}
```

> The ledger is **append-only**. Corrections are new `adjustment` rows, never edits. This is
> the whole point of a ledger — if a customer disputes a balance, the shop can walk the
> history. `Customer.balancePaise` is only a cache of `sum(amountPaise)`.

```ts
// ─── Settings ───────────────────────────────────────────────────────────────
export interface Settings {
  id: 'singleton';

  shop: {
    nameEn: string;
    nameTa: string;
    addressLines: string[];
    phone: string;
    upiVpa?: string; // "shop@okaxis" — drives the UPI QR (hardcoded today)
    upiPayeeName?: string;
    logoBlobId?: Id;
  };

  gst: {
    enabled: boolean; // DEFAULT false (D6)
    gstin?: string;
    stateCode: string; // "33" = Tamil Nadu
    pricesIncludeTax: boolean; // DEFAULT true — MRP is tax-inclusive in India
  };

  billing: {
    roundOffEnabled: boolean; // DEFAULT true
    billPrefix: string;
    footerLineEn: string; // "Thank you! Visit again"
    footerLineTa: string; // "நன்றி! மீண்டும் வருக"
    showSavings: boolean;
    printUpiQr: boolean;
  };

  printer: {
    widthMm: 58 | 80; // DEFAULT 58
    mode: 'browser' | 'bluetooth';
    bluetoothDeviceId?: string;
    copies: number;
  };

  ui: {
    language: 'ta' | 'en'; // DEFAULT 'ta'
    theme: 'light' | 'dark';
    billingLayout: 'grid' | 'list';
  };

  ai: {
    geminiApiKey?: string; // user-supplied (D8); absent = AI features hidden
  };

  scanner: {
    beepOnScan: boolean;
    continuousMode: boolean;
    weightBarcodePrefix: string; // "" disables; typically "2"
  };
}
```

> **`pricesIncludeTax: true` by default.** Indian retail quotes MRP inclusive of GST. If GST
> mode is on, tax is _extracted_ from the price, not added on top. Getting this backwards
> inflates every bill by the slab rate.

## IndexedDB schema (Dexie)

```ts
// data/db.ts
export class KbsDatabase extends Dexie {
  products!: Table<Product, Id>;
  customers!: Table<Customer, Id>;
  sales!: Table<Sale, Id>;
  ledger!: Table<LedgerEntry, Id>;
  settings!: Table<Settings, string>;
  images!: Table<{ id: Id; blob: Blob }, Id>;
  counters!: Table<{ id: string; value: number }, string>; // daily bill sequence

  constructor() {
    super('kbs');
    this.version(1).stores({
      products: 'id, *barcodes, nameEn, nameTa, category, isQuickTile, deletedAt',
      customers: 'id, phone, name, deletedAt',
      sales: 'id, billNo, createdAt, customerId, status',
      ledger: 'id, customerId, at, type, saleId',
      settings: 'id',
      images: 'id',
      counters: 'id',
    });
  }
}
```

Index notes:

- `*barcodes` is a **multi-entry index** — this is what makes a scan an O(1) lookup even
  when a product carries several codes.
- `sales.createdAt` drives every report and the day-close screen.
- `ledger.customerId` drives the per-customer statement.
- Blobs live in their own store so product queries don't drag image bytes into memory.

**Migrations.** Every schema change bumps `.version(n)` with an explicit `.upgrade()`. Never
mutate a version already shipped — a shop's device may still be on it, and their live data is
the only copy.

## Seed data

`data/seed/tnKiranaProducts.ts` replaces the US grocery list, seeded **once** on first run
(guarded by a flag in `counters`) so it never overwrites a shop's real catalogue.

Roughly 60 items a TN provision store actually stocks, with Tamil names and correct units:

| Category      | Examples                               | Unit      |
| ------------- | -------------------------------------- | --------- |
| Rice & grains | பொன்னி அரிசி, இட்லி அரிசி, கோதுமை      | kg        |
| Pulses        | துவரம் பருப்பு, உளுந்து, கடலை பருப்பு  | kg        |
| Oil           | நல்லெண்ணெய், சூரியகாந்தி எண்ணெய்       | litre     |
| Spices        | மிளகாய் தூள், மஞ்சள் தூள், புளி        | kg / g    |
| Packaged FMCG | Maggi, Britannia, Colgate, Surf Excel  | piece     |
| Dairy         | Aavin milk, curd, butter               | packet    |
| Beverages     | tea powder, coffee powder, soft drinks | g / piece |
| Household     | soap, detergent, agarbatti, matchbox   | piece     |

**Barcodes in seed data — revised during implementation.** This section originally said
packaged items would ship with real EAN-13 codes. They ship with **no barcodes** instead.
Real codes cannot be verified offline, and an invented one is worse than none: it would never
match the packet in the shop's hand, and could collide with a genuine code belonging to a
different product. Learn-as-you-scan (D4) fills them in correctly on first scan, which is the
mechanism the design relies on anyway. Loose items are found by Tamil search or quick tiles.
