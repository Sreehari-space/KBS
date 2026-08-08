/**
 * Core domain types. See docs/02-data-model.md.
 *
 * RULE: every monetary value here is an integer number of PAISE (D1).
 * Rupees exist only when formatting for display or parsing user input.
 */

export type Id = string;
export type Paise = number;
export type ISODate = string;

export type Unit = 'piece' | 'kg' | 'g' | 'litre' | 'ml' | 'packet';
export type GstSlab = 0 | 5 | 12 | 18 | 28;

/** Units sold by weight/volume accept fractional quantities and a keypad. */
export const FRACTIONAL_UNITS: readonly Unit[] = ['kg', 'g', 'litre', 'ml'];
export const isFractionalUnit = (u: Unit) => FRACTIONAL_UNITS.includes(u);

// ─── Product ────────────────────────────────────────────────────────────────

export interface Product {
  id: Id;
  nameEn: string;
  /** May be '' until the shop fills it in; UI falls back to nameEn. */
  nameTa: string;
  /** Multi-entry indexed. A product may carry an old and a new barcode. */
  barcodes: string[];
  sku?: string;
  category: string;

  unit: Unit;
  /** Price per unit. For unit 'kg' this is the price per kilogram. */
  sellPricePaise: Paise;
  costPricePaise?: Paise;

  stockQty: number;
  lowStockThreshold: number;
  /** false for loose items the shop doesn't bother counting. */
  trackStock: boolean;

  hsn?: string;
  gstSlab?: GstSlab;

  imageBlobId?: Id;
  isQuickTile: boolean;

  createdAt: ISODate;
  updatedAt: ISODate;
  /** Soft delete — old bills must still resolve their product rows. */
  deletedAt?: ISODate;
}

// ─── Customer ───────────────────────────────────────────────────────────────

export interface Customer {
  id: Id;
  name: string;
  /** 10-digit local number. '+91' is added only when building wa.me links. */
  phone: string;
  address?: string;

  /** Denormalised credit balance. Positive = customer owes the shop.
   *  Source of truth is the ledger; this is a recomputable cache. */
  balancePaise: Paise;
  creditLimitPaise?: Paise;

  notes?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
}

// ─── Sale ───────────────────────────────────────────────────────────────────

export interface SaleLine {
  productId: Id;
  /** Snapshot at time of sale. Renaming or repricing a product must never
   *  change a bill that was already printed. */
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
  reference?: string;
}

export type SaleStatus = 'completed' | 'held' | 'returned' | 'partially_returned';

export interface Sale {
  id: Id;
  /** Human-facing, resets daily: "080826-014". */
  billNo: string;
  createdAt: ISODate;

  lines: SaleLine[];

  subtotalPaise: Paise;
  billDiscountPaise: Paise;
  taxPaise: Paise;
  /** Signed. -40 means 40 paise were knocked off. */
  roundOffPaise: Paise;
  totalPaise: Paise;

  payments: Payment[];
  /** Unpaid remainder; > 0 means a ledger entry exists for this sale. */
  creditPaise: Paise;

  customerId?: Id;
  status: SaleStatus;
  returnOfSaleId?: Id;
  note?: string;
}

// ─── Ledger (கடன்) ──────────────────────────────────────────────────────────

export type LedgerEntryType = 'opening_balance' | 'credit_sale' | 'payment' | 'adjustment';

export interface LedgerEntry {
  id: Id;
  customerId: Id;
  at: ISODate;
  type: LedgerEntryType;
  /** Signed. Positive increases what the customer owes. */
  amountPaise: Paise;
  saleId?: Id;
  paymentMode?: PaymentMode;
  note?: string;
}

// ─── Settings ───────────────────────────────────────────────────────────────

export type Language = 'ta' | 'en';

export interface Settings {
  id: 'singleton';

  shop: {
    nameEn: string;
    nameTa: string;
    addressLines: string[];
    phone: string;
    upiVpa?: string;
    upiPayeeName?: string;
    logoBlobId?: Id;
  };

  gst: {
    /** Default false — most target shops are below the threshold (D6). */
    enabled: boolean;
    gstin?: string;
    /** '33' = Tamil Nadu. */
    stateCode: string;
    /** Default true — Indian retail quotes MRP inclusive of tax. */
    pricesIncludeTax: boolean;
  };

  billing: {
    roundOffEnabled: boolean;
    billPrefix: string;
    footerLineEn: string;
    footerLineTa: string;
    showSavings: boolean;
    printUpiQr: boolean;
  };

  printer: {
    widthMm: 58 | 80;
    mode: 'browser' | 'bluetooth';
    bluetoothDeviceId?: string;
    copies: number;
  };

  ui: {
    language: Language;
    theme: 'light' | 'dark';
    billingLayout: 'grid' | 'list';
  };

  ai: {
    /** Supplied by the shop owner, stored on their own device (D8). */
    geminiApiKey?: string;
  };

  scanner: {
    beepOnScan: boolean;
    continuousMode: boolean;
    /** '' disables weight-embedded barcode parsing. */
    weightBarcodePrefix: string;
  };
}

// ─── Drafts (auto-save, doc 07) ─────────────────────────────────────────────

export interface CartDraft {
  id: Id;
  /** 'active' is the single in-progress cart; others are held bills. */
  kind: 'active' | 'held';
  label?: string;
  lines: SaleLine[];
  customerId?: Id;
  billDiscountPaise: Paise;
  updatedAt: ISODate;
}
