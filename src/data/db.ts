/**
 * IndexedDB schema. See docs/02-data-model.md and docs/07-autosave-durability.md.
 *
 * IndexedDB — not the localStorage API (D10). Both are on-device and
 * serverless, but localStorage caps at ~5 MB (about six weeks of bills) and
 * its synchronous whole-blob rewrites would freeze a low-end phone on every
 * sale. localStorage is used for exactly one thing in this app: the theme
 * flag in index.html, which must be read before first paint.
 */

import Dexie, { type Table } from 'dexie';
import type {
  CartDraft,
  Customer,
  Id,
  LedgerEntry,
  Product,
  Sale,
  Settings,
} from '@/domain/types';

export interface StoredImage {
  id: Id;
  blob: Blob;
}

/** Small counters kept outside settings: daily bill sequence, seed flag. */
export interface Counter {
  id: string;
  value: number;
}

export class KbsDatabase extends Dexie {
  products!: Table<Product, Id>;
  customers!: Table<Customer, Id>;
  sales!: Table<Sale, Id>;
  ledger!: Table<LedgerEntry, Id>;
  settings!: Table<Settings, string>;
  drafts!: Table<CartDraft, Id>;
  images!: Table<StoredImage, Id>;
  counters!: Table<Counter, string>;

  constructor(name = 'kbs') {
    // 'strict' makes Chromium flush each transaction to disk before resolving,
    // instead of leaving it in an OS buffer (its 'relaxed' default). A battery
    // pull a second after billing therefore cannot lose the sale — the whole
    // point of doc 07.
    //
    // Applied database-wide rather than only to the sale commit, because Dexie
    // exposes durability per-connection, not per-transaction. That also covers
    // cart drafts, which is desirable: a draft that isn't on disk cannot
    // survive the crash it exists to protect against. The cost is an fsync per
    // write — a few milliseconds, and only a few thousand writes a day.
    // Non-Chromium engines ignore the hint and apply their own defaults.
    super(name, { chromeTransactionDurability: 'strict' });

    // NEVER mutate a shipped version. Schema changes add a new .version(n)
    // with an explicit .upgrade() — a shop's device may still be on the old
    // one and their data is the only copy.
    this.version(1).stores({
      // *barcodes is a multi-entry index: this is what makes a scan an O(1)
      // lookup even when a product carries several codes.
      products: 'id, *barcodes, nameEn, nameTa, category, isQuickTile, deletedAt',
      customers: 'id, phone, name, deletedAt',
      sales: 'id, billNo, createdAt, customerId, status',
      ledger: 'id, customerId, at, type, saleId',
      settings: 'id',
      drafts: 'id, kind, updatedAt',
      images: 'id',
      counters: 'id',
    });
  }
}

export const db = new KbsDatabase();

/** There is no "reset app" button and db.delete() is never called (doc 07). */

// ─── Storage protection (task 1.4c) ─────────────────────────────────────────

export interface StorageStatus {
  persisted: boolean;
  usageBytes: number;
  quotaBytes: number;
  /** 0..1; the UI warns above 0.8, before writes start failing. */
  usedFraction: number;
  /** Storage is unavailable — private mode, or blocked by policy. */
  unavailable: boolean;
}

/**
 * Ask the browser to exempt our database from automatic eviction under
 * storage pressure. Grant odds are much better for an installed PWA, which is
 * one more reason to push installation.
 *
 * This does NOT protect against the user clearing site data, or the phone
 * being lost — see doc 07 for what auto-save can and cannot cover.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const empty: StorageStatus = {
    persisted: false,
    usageBytes: 0,
    quotaBytes: 0,
    usedFraction: 0,
    unavailable: false,
  };
  try {
    if (!navigator.storage?.estimate) return empty;
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted?.() ?? Promise.resolve(false),
    ]);
    const usageBytes = estimate.usage ?? 0;
    const quotaBytes = estimate.quota ?? 0;
    return {
      persisted,
      usageBytes,
      quotaBytes,
      usedFraction: quotaBytes > 0 ? usageBytes / quotaBytes : 0,
      unavailable: false,
    };
  } catch {
    return { ...empty, unavailable: true };
  }
}

/**
 * Detect storage that will be discarded when the browser closes.
 *
 * Billing in a private/incognito window would lose the entire day, so the app
 * shows a blocking warning rather than letting a shopkeeper find out at night.
 */
export async function isStorageEphemeral(): Promise<boolean> {
  try {
    if (!navigator.storage?.estimate) return false;
    const { quota } = await navigator.storage.estimate();
    // Incognito sessions report a small fixed quota (typically ~120 MB) while
    // a normal profile reports gigabytes.
    return typeof quota === 'number' && quota > 0 && quota < 200 * 1024 * 1024;
  } catch {
    return false;
  }
}

/** True when the database can actually be opened and written to. */
export async function canPersist(): Promise<boolean> {
  try {
    await db.open();
    return true;
  } catch {
    return false;
  }
}

export const newId = (): Id =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const nowIso = (): string => new Date().toISOString();
