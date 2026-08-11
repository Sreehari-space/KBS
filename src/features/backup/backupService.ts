/**
 * Backup and restore. See docs/07-autosave-durability.md.
 *
 * Auto-save protects against crashes and forgetting to save. It cannot protect
 * against the phone being lost, stolen or wiped — that is what this is for.
 *
 * Deliberately a plain JSON file shared through the OS share sheet (D7)
 * rather than a Google Drive API integration: Drive needs a GCP project, an
 * OAuth consent screen and internet at backup time. Sharing to the Drive app
 * that is already signed in reaches the same place in two taps.
 */

import { db, type Counter } from '../../data/db';
import { recalculateAllBalances } from '@/data/repositories/ledgerRepo';
import type { Customer, LedgerEntry, Product, Sale, Settings } from '@/domain/types';

export const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = 'lastBackupAt';

export interface BackupFile {
  kbsVersion: number;
  exportedAt: string;
  counts: Record<string, number>;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  ledger: LedgerEntry[];
  settings: Settings | null;
  /** Optional: absent in v1 files, which restore rebuilds from the sales. */
  counters?: Counter[];
}

/**
 * Rebuild the daily bill and return sequences from the bills themselves.
 *
 * This is the fix for the worst bug in the restore path: counters were never
 * exported, so restoring onto a NEW device — the disaster-recovery case, the
 * only one that matters — left every sequence at zero and the next sale
 * reissued a bill number that already existed. Two different sales, same
 * number, no error, discovered during a dispute months later.
 *
 * Deriving from the sales rather than trusting an exported counter also
 * repairs backups taken before this existed, and self-corrects if a counter
 * was ever left behind by a partial write.
 */
export function countersFromSales(sales: readonly Sale[]): Counter[] {
  const highest = new Map<string, number>();
  for (const sale of sales) {
    // "080826-014" and "080826-R002" — date key, series, sequence.
    const match = /^(\d{6})-(R?)(\d+)$/.exec(sale.billNo);
    if (!match) continue;
    const [, dateKey, isReturn, seq] = match;
    const id = `${isReturn ? 'return' : 'bill'}:${dateKey}`;
    highest.set(id, Math.max(highest.get(id) ?? 0, Number(seq)));
  }
  return [...highest.entries()].map(([id, value]) => ({ id, value }));
}

export async function buildBackup(): Promise<BackupFile> {
  const [products, customers, sales, ledger, settings, counters] = await Promise.all([
    db.products.toArray(),
    db.customers.toArray(),
    db.sales.toArray(),
    db.ledger.toArray(),
    db.settings.toArray(),
    db.counters.toArray(),
  ]);

  return {
    kbsVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      products: products.length,
      customers: customers.length,
      sales: sales.length,
      ledger: ledger.length,
    },
    products,
    customers,
    sales,
    ledger,
    counters,
    // Images are excluded: they are the bulk of the bytes and are
    // reconstructible by re-photographing. Bills and the ledger are not.
    settings: settings[0] ?? null,
  };
}

function backupFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `kbs-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}.json`;
}

/**
 * Export and hand the file to the OS share sheet, so the owner can send it to
 * their own WhatsApp, Drive or email. Falls back to a download on desktop.
 */
export async function exportBackup(): Promise<{ shared: boolean; filename: string }> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = backupFilename();
  const file = new File([blob], filename, { type: 'application/json' });

  let shared = false;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'KBS backup' });
      shared = true;
    } catch (err) {
      // The user dismissing the share sheet is not an error worth surfacing.
      if ((err as Error)?.name !== 'AbortError') shared = false;
    }
  }

  if (!shared) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  await db.counters.put({ id: LAST_BACKUP_KEY, value: Date.now() });
  return { shared, filename };
}

export function parseBackup(text: string): BackupFile {
  const parsed = JSON.parse(text) as BackupFile;
  if (typeof parsed?.kbsVersion !== 'number' || !Array.isArray(parsed.sales)) {
    throw new Error('This file is not a KBS backup');
  }
  if (parsed.kbsVersion > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of KBS');
  }
  return parsed;
}

/**
 * Replace everything on this device with the backup's contents.
 *
 * Never called without an explicit confirmation showing the backup's date and
 * row counts — restoring the wrong file over live data is unrecoverable.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    [db.products, db.customers, db.sales, db.ledger, db.settings, db.counters, db.drafts],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.customers.clear(),
        db.sales.clear(),
        db.ledger.clear(),
        db.drafts.clear(),
      ]);
      await db.products.bulkAdd(backup.products ?? []);
      await db.customers.bulkAdd(backup.customers ?? []);
      await db.sales.bulkAdd(backup.sales ?? []);
      await db.ledger.bulkAdd(backup.ledger ?? []);
      if (backup.settings) await db.settings.put({ ...backup.settings, id: 'singleton' });

      // Bill sequences are rebuilt from the restored bills rather than taken
      // from the file, so an older backup with no counters — and any counter
      // left stale by a partial write — still lands on the right next number.
      // Without this the next sale reissues a bill number that already exists.
      const rebuilt = countersFromSales(backup.sales ?? []);
      await db.counters.bulkPut(rebuilt);

      // Anything else the file carried (the backup timestamp, future keys)
      // that the sequences above do not own.
      const owned = new Set(rebuilt.map((c) => c.id));
      const carried = (backup.counters ?? []).filter(
        (c) => !owned.has(c.id) && c.id !== 'seeded:v1',
      );
      if (carried.length > 0) await db.counters.bulkPut(carried);

      // Mark as seeded so first-run seeding can't run over restored data.
      await db.counters.put({ id: 'seeded:v1', value: 1 });
    },
  );

  // The cached balances came straight out of the file. Recomputing them from
  // the restored ledger costs one pass and turns "probably fine" into
  // "checked" on the one operation that has no undo.
  await recalculateAllBalances();
}

export async function getLastBackupAt(): Promise<Date | null> {
  const row = await db.counters.get(LAST_BACKUP_KEY);
  return row ? new Date(row.value) : null;
}

export async function daysSinceBackup(): Promise<number | null> {
  const last = await getLastBackupAt();
  if (!last) return null;
  return Math.floor((Date.now() - last.getTime()) / 86_400_000);
}
