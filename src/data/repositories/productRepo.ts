/** Product persistence. See docs/02-data-model.md. */

import { db, newId, nowIso } from '../db';
import { normaliseBarcode, parseProductQrPayload } from '@/domain/barcode';
import type { Id, Product } from '@/domain/types';

export type NewProduct = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

/** Live list of everything not soft-deleted. */
export async function listProducts(): Promise<Product[]> {
  const all = await db.products.toArray();
  return all.filter((p) => !p.deletedAt).sort((a, b) => a.nameEn.localeCompare(b.nameEn));
}

export function getProduct(id: Id): Promise<Product | undefined> {
  return db.products.get(id);
}

/**
 * Resolve a scanned code to a product.
 *
 * Handles three cases: our own shop-printed QR labels, UPC-A codes that need
 * padding to EAN-13, and plain barcode hits.
 */
export async function findByBarcode(rawCode: string): Promise<Product | undefined> {
  const productId = parseProductQrPayload(rawCode.trim());
  if (productId) {
    const byId = await db.products.get(productId);
    return byId?.deletedAt ? undefined : byId;
  }

  const code = normaliseBarcode(rawCode);
  const hit = await db.products.where('barcodes').equals(code).first();
  if (hit && !hit.deletedAt) return hit;

  // A UPC-A stored unpadded still needs to be findable.
  if (code.startsWith('0') && code.length === 13) {
    const unpadded = await db.products.where('barcodes').equals(code.slice(1)).first();
    if (unpadded && !unpadded.deletedAt) return unpadded;
  }
  return undefined;
}

/** Tamil and English both match, so staff can type in whichever is faster. */
export async function searchProducts(term: string): Promise<Product[]> {
  const q = term.trim().toLowerCase();
  if (!q) return listProducts();
  const all = await listProducts();
  return all.filter(
    (p) =>
      p.nameEn.toLowerCase().includes(q) ||
      p.nameTa.includes(term.trim()) ||
      p.sku?.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.barcodes.some((b) => b.includes(q)),
  );
}

export async function quickTiles(): Promise<Product[]> {
  const all = await listProducts();
  return all.filter((p) => p.isQuickTile);
}

export async function lowStock(): Promise<Product[]> {
  const all = await listProducts();
  return all
    .filter((p) => p.trackStock && p.stockQty <= p.lowStockThreshold)
    .sort((a, b) => a.stockQty - b.stockQty);
}

export async function createProduct(input: NewProduct): Promise<Product> {
  const now = nowIso();
  const product: Product = {
    ...input,
    barcodes: input.barcodes.map(normaliseBarcode).filter(Boolean),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  await db.products.add(product);
  return product;
}

export async function updateProduct(id: Id, patch: Partial<Product>): Promise<void> {
  const next: Partial<Product> = { ...patch, updatedAt: nowIso() };
  if (patch.barcodes) next.barcodes = patch.barcodes.map(normaliseBarcode).filter(Boolean);
  await db.products.update(id, next);
}

/**
 * Soft delete. A bill printed in April must still resolve its product rows in
 * October, so nothing is ever really removed.
 */
export async function deleteProduct(id: Id): Promise<void> {
  await db.products.update(id, { deletedAt: nowIso(), updatedAt: nowIso(), isQuickTile: false });
}

/**
 * Attach another barcode to a product that already exists.
 *
 * Covers the everyday cases: the item was added by hand without a barcode,
 * the brand changed packaging so there are now two codes, or a wrong code was
 * captured and the right one needs adding.
 */
export async function addBarcodeToProduct(id: Id, barcode: string): Promise<void> {
  const product = await db.products.get(id);
  if (!product) throw new Error('Product not found');
  const code = normaliseBarcode(barcode);
  if (!code || product.barcodes.includes(code)) return;
  await db.products.update(id, {
    barcodes: [...product.barcodes, code],
    updatedAt: nowIso(),
  });
}

export async function listCategories(): Promise<string[]> {
  const all = await listProducts();
  return [...new Set(all.map((p) => p.category))].filter(Boolean).sort();
}

// ─── Images ─────────────────────────────────────────────────────────────────

/**
 * Store a product photo, downscaled first.
 *
 * An untouched phone photo is 2–5 MB; 500 of them would be 1–2 GB and could
 * trip storage eviction. Images are the only real quota risk in this app
 * (doc 07), so they are capped before they ever reach IndexedDB.
 */
export async function storeProductImage(file: Blob): Promise<Id> {
  const resized = await downscaleImage(file, 400, 0.72);
  const id = newId();
  await db.images.add({ id, blob: resized });
  return id;
}

export async function getImageUrl(id?: Id): Promise<string | undefined> {
  if (!id) return undefined;
  const row = await db.images.get(id);
  return row ? URL.createObjectURL(row.blob) : undefined;
}

async function downscaleImage(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', quality);
  });
}
