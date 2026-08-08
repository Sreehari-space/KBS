/**
 * First-run seeding.
 *
 * Guarded by a flag in `counters` so a shop's real catalogue can never be
 * overwritten — not on upgrade, not on a second tab, not after a restore.
 */

import { db, newId, nowIso } from '../db';
import { ensureSettings } from '../repositories/settingsRepo';
import { buildSeedProducts } from './tnKiranaProducts';

const SEED_FLAG = 'seeded:v1';

export async function seedIfEmpty(): Promise<{ seeded: boolean; count: number }> {
  await ensureSettings();

  return db.transaction('rw', [db.products, db.counters], async () => {
    const flag = await db.counters.get(SEED_FLAG);
    if (flag) return { seeded: false, count: 0 };

    // Belt and braces: never seed on top of existing products, even if the
    // flag went missing (e.g. a partial restore).
    const existing = await db.products.count();
    if (existing > 0) {
      await db.counters.put({ id: SEED_FLAG, value: 1 });
      return { seeded: false, count: 0 };
    }

    const products = buildSeedProducts(nowIso(), newId);
    await db.products.bulkAdd(products);
    await db.counters.put({ id: SEED_FLAG, value: 1 });
    return { seeded: true, count: products.length };
  });
}
