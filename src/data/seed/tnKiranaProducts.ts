/**
 * Seed catalogue for a Tamil Nadu provision store.
 *
 * Replaces the old US grocery mock data ("Organic Bananas", "Cage-Free Eggs").
 * Seeded ONCE on first run, guarded by a flag in `counters`, so it can never
 * overwrite a shop's real catalogue.
 *
 * NOTE ON BARCODES — deviation from docs/02-data-model.md, which said packaged
 * items would ship with real EAN-13 codes. They ship with NO barcodes instead.
 * Real codes cannot be verified offline, and an invented one is worse than
 * none: it would never match the packet in the shop's hand, and could collide
 * with a genuine code belonging to a different product. Learn-as-you-scan (D4)
 * fills these in correctly on first scan, which is the mechanism the design
 * relies on anyway.
 *
 * Prices are plausible starting points in paise; every shop edits them.
 */

import type { Product } from '@/domain/types';

type SeedItem = {
  en: string;
  ta: string;
  cat: string;
  unit: Product['unit'];
  /** Selling price in PAISE. */
  price: number;
  stock: number;
  low: number;
  /** Pinned to the billing screen's quick grid. */
  quick?: boolean;
  /** Loose goods the shop doesn't count. */
  noTrack?: boolean;
};

const ITEMS: SeedItem[] = [
  // ─── Rice & grains (அரிசி & தானியம்) ─────────────────────────────────────
  { en: 'Ponni Rice', ta: 'பொன்னி அரிசி', cat: 'Rice', unit: 'kg', price: 5800, stock: 200, low: 25, quick: true },
  { en: 'Idli Rice', ta: 'இட்லி அரிசி', cat: 'Rice', unit: 'kg', price: 5200, stock: 150, low: 20, quick: true },
  { en: 'Basmati Rice', ta: 'பாஸ்மதி அரிசி', cat: 'Rice', unit: 'kg', price: 12000, stock: 40, low: 10 },
  { en: 'Raw Rice', ta: 'பச்சரிசி', cat: 'Rice', unit: 'kg', price: 5500, stock: 100, low: 20 },
  { en: 'Wheat', ta: 'கோதுமை', cat: 'Rice', unit: 'kg', price: 4800, stock: 60, low: 15 },
  { en: 'Wheat Flour', ta: 'கோதுமை மாவு', cat: 'Rice', unit: 'kg', price: 5500, stock: 50, low: 10 },
  { en: 'Rice Flour', ta: 'அரிசி மாவு', cat: 'Rice', unit: 'kg', price: 6000, stock: 30, low: 8 },
  { en: 'Ragi', ta: 'கேழ்வரகு', cat: 'Rice', unit: 'kg', price: 7000, stock: 25, low: 6 },
  { en: 'Semolina (Rava)', ta: 'ரவை', cat: 'Rice', unit: 'kg', price: 6500, stock: 30, low: 8 },

  // ─── Pulses (பருப்பு) ───────────────────────────────────────────────────
  { en: 'Toor Dal', ta: 'துவரம் பருப்பு', cat: 'Pulses', unit: 'kg', price: 16000, stock: 60, low: 15, quick: true },
  { en: 'Urad Dal', ta: 'உளுந்து', cat: 'Pulses', unit: 'kg', price: 14000, stock: 40, low: 10 },
  { en: 'Moong Dal', ta: 'பாசிப்பருப்பு', cat: 'Pulses', unit: 'kg', price: 13000, stock: 35, low: 10 },
  { en: 'Bengal Gram', ta: 'கடலை பருப்பு', cat: 'Pulses', unit: 'kg', price: 9500, stock: 45, low: 12 },
  { en: 'Green Gram', ta: 'பச்சை பயறு', cat: 'Pulses', unit: 'kg', price: 12000, stock: 30, low: 8 },
  { en: 'Groundnut', ta: 'நிலக்கடலை', cat: 'Pulses', unit: 'kg', price: 14000, stock: 25, low: 6 },

  // ─── Oil (எண்ணெய்) ──────────────────────────────────────────────────────
  { en: 'Sunflower Oil', ta: 'சூரியகாந்தி எண்ணெய்', cat: 'Oil', unit: 'litre', price: 14500, stock: 50, low: 12, quick: true },
  { en: 'Gingelly Oil', ta: 'நல்லெண்ணெய்', cat: 'Oil', unit: 'litre', price: 24000, stock: 20, low: 5 },
  { en: 'Coconut Oil', ta: 'தேங்காய் எண்ணெய்', cat: 'Oil', unit: 'litre', price: 22000, stock: 20, low: 5 },
  { en: 'Ghee', ta: 'நெய்', cat: 'Oil', unit: 'kg', price: 62000, stock: 12, low: 3 },

  // ─── Spices & masala (மசாலா) ────────────────────────────────────────────
  { en: 'Chilli Powder', ta: 'மிளகாய் தூள்', cat: 'Spices', unit: 'kg', price: 28000, stock: 15, low: 4, quick: true },
  { en: 'Turmeric Powder', ta: 'மஞ்சள் தூள்', cat: 'Spices', unit: 'kg', price: 24000, stock: 12, low: 3 },
  { en: 'Coriander Powder', ta: 'மல்லி தூள்', cat: 'Spices', unit: 'kg', price: 22000, stock: 12, low: 3 },
  { en: 'Sambar Powder', ta: 'சாம்பார் பொடி', cat: 'Spices', unit: 'kg', price: 32000, stock: 10, low: 3 },
  { en: 'Tamarind', ta: 'புளி', cat: 'Spices', unit: 'kg', price: 18000, stock: 20, low: 5 },
  { en: 'Mustard', ta: 'கடுகு', cat: 'Spices', unit: 'kg', price: 16000, stock: 10, low: 3 },
  { en: 'Cumin', ta: 'சீரகம்', cat: 'Spices', unit: 'kg', price: 40000, stock: 8, low: 2 },
  { en: 'Fenugreek', ta: 'வெந்தயம்', cat: 'Spices', unit: 'kg', price: 15000, stock: 8, low: 2 },
  { en: 'Pepper', ta: 'மிளகு', cat: 'Spices', unit: 'kg', price: 70000, stock: 5, low: 2 },
  { en: 'Asafoetida', ta: 'பெருங்காயம்', cat: 'Spices', unit: 'g', price: 200, stock: 500, low: 100 },

  // ─── Sugar & salt ───────────────────────────────────────────────────────
  { en: 'Sugar', ta: 'சர்க்கரை', cat: 'Essentials', unit: 'kg', price: 4500, stock: 100, low: 20, quick: true },
  { en: 'Jaggery', ta: 'வெல்லம்', cat: 'Essentials', unit: 'kg', price: 6500, stock: 30, low: 8 },
  { en: 'Salt', ta: 'உப்பு', cat: 'Essentials', unit: 'kg', price: 2500, stock: 60, low: 15, quick: true },

  // ─── Dairy (பால் பொருட்கள்) ─────────────────────────────────────────────
  { en: 'Aavin Milk 500ml', ta: 'ஆவின் பால் 500மி.லி', cat: 'Dairy', unit: 'packet', price: 2600, stock: 60, low: 15, quick: true },
  { en: 'Curd 200g', ta: 'தயிர் 200கி', cat: 'Dairy', unit: 'packet', price: 2000, stock: 40, low: 10 },
  { en: 'Butter 100g', ta: 'வெண்ணெய் 100கி', cat: 'Dairy', unit: 'packet', price: 6000, stock: 20, low: 5 },
  { en: 'Paneer 200g', ta: 'பன்னீர் 200கி', cat: 'Dairy', unit: 'packet', price: 9000, stock: 10, low: 3 },
  { en: 'Egg', ta: 'முட்டை', cat: 'Dairy', unit: 'piece', price: 700, stock: 200, low: 30, quick: true },

  // ─── Beverages (பானங்கள்) ───────────────────────────────────────────────
  { en: 'Tea Powder', ta: 'தேயிலை', cat: 'Beverages', unit: 'kg', price: 40000, stock: 15, low: 4, quick: true },
  { en: 'Coffee Powder', ta: 'காபி பொடி', cat: 'Beverages', unit: 'kg', price: 60000, stock: 10, low: 3 },
  { en: 'Horlicks 500g', ta: 'ஹார்லிக்ஸ் 500கி', cat: 'Beverages', unit: 'piece', price: 26500, stock: 12, low: 3 },
  { en: 'Boost 500g', ta: 'பூஸ்ட் 500கி', cat: 'Beverages', unit: 'piece', price: 25500, stock: 10, low: 3 },
  { en: 'Soft Drink 750ml', ta: 'குளிர்பானம் 750மி.லி', cat: 'Beverages', unit: 'piece', price: 4000, stock: 36, low: 12 },
  { en: 'Water Can 20L', ta: 'தண்ணீர் கேன் 20லி', cat: 'Beverages', unit: 'piece', price: 4000, stock: 20, low: 5 },

  // ─── Packaged FMCG (பேக்கெட் பொருட்கள்) ─────────────────────────────────
  { en: 'Maggi Noodles 70g', ta: 'மேகி நூடுல்ஸ் 70கி', cat: 'Packaged', unit: 'piece', price: 1400, stock: 80, low: 20, quick: true },
  { en: 'Biscuit Pack', ta: 'பிஸ்கட் பாக்கெட்', cat: 'Packaged', unit: 'piece', price: 1000, stock: 100, low: 25, quick: true },
  { en: 'Rusk 200g', ta: 'ரஸ்க் 200கி', cat: 'Packaged', unit: 'piece', price: 4000, stock: 20, low: 5 },
  { en: 'Vermicelli 200g', ta: 'சேமியா 200கி', cat: 'Packaged', unit: 'piece', price: 3000, stock: 30, low: 8 },
  { en: 'Appalam', ta: 'அப்பளம்', cat: 'Packaged', unit: 'packet', price: 5000, stock: 25, low: 6 },
  { en: 'Pickle 300g', ta: 'ஊறுகாய் 300கி', cat: 'Packaged', unit: 'piece', price: 8500, stock: 15, low: 4 },

  // ─── Vegetables (காய்கறி) — loose, usually not stock-counted ────────────
  { en: 'Tomato', ta: 'தக்காளி', cat: 'Vegetables', unit: 'kg', price: 4000, stock: 0, low: 0, quick: true, noTrack: true },
  { en: 'Onion', ta: 'வெங்காயம்', cat: 'Vegetables', unit: 'kg', price: 3500, stock: 0, low: 0, quick: true, noTrack: true },
  { en: 'Potato', ta: 'உருளைக்கிழங்கு', cat: 'Vegetables', unit: 'kg', price: 3800, stock: 0, low: 0, noTrack: true },
  { en: 'Green Chilli', ta: 'பச்சை மிளகாய்', cat: 'Vegetables', unit: 'kg', price: 6000, stock: 0, low: 0, noTrack: true },
  { en: 'Curry Leaves', ta: 'கறிவேப்பிலை', cat: 'Vegetables', unit: 'packet', price: 500, stock: 0, low: 0, noTrack: true },
  { en: 'Coriander Leaves', ta: 'கொத்தமல்லி', cat: 'Vegetables', unit: 'packet', price: 1000, stock: 0, low: 0, noTrack: true },
  { en: 'Coconut', ta: 'தேங்காய்', cat: 'Vegetables', unit: 'piece', price: 3500, stock: 0, low: 0, quick: true, noTrack: true },
  { en: 'Lemon', ta: 'எலுமிச்சை', cat: 'Vegetables', unit: 'piece', price: 500, stock: 0, low: 0, noTrack: true },

  // ─── Household (வீட்டு உபயோகம்) ─────────────────────────────────────────
  { en: 'Bath Soap', ta: 'குளியல் சோப்பு', cat: 'Household', unit: 'piece', price: 3500, stock: 50, low: 12, quick: true },
  { en: 'Detergent Bar', ta: 'சலவை சோப்பு', cat: 'Household', unit: 'piece', price: 1200, stock: 60, low: 15 },
  { en: 'Detergent Powder 1kg', ta: 'சலவை தூள் 1கிலோ', cat: 'Household', unit: 'piece', price: 12000, stock: 25, low: 6 },
  { en: 'Toothpaste 100g', ta: 'பற்பசை 100கி', cat: 'Household', unit: 'piece', price: 6000, stock: 30, low: 8 },
  { en: 'Shampoo Sachet', ta: 'ஷாம்பு சாஷே', cat: 'Household', unit: 'piece', price: 300, stock: 200, low: 50 },
  { en: 'Coconut Hair Oil 100ml', ta: 'தலை எண்ணெய் 100மி.லி', cat: 'Household', unit: 'piece', price: 4500, stock: 20, low: 5 },
  { en: 'Agarbatti', ta: 'ஊதுபத்தி', cat: 'Household', unit: 'packet', price: 3000, stock: 30, low: 8 },
  { en: 'Matchbox', ta: 'தீப்பெட்டி', cat: 'Household', unit: 'piece', price: 200, stock: 100, low: 25 },
  { en: 'Candle', ta: 'மெழுகுவர்த்தி', cat: 'Household', unit: 'piece', price: 1000, stock: 40, low: 10 },
  { en: 'Phenyl 500ml', ta: 'ஃபினாயில் 500மி.லி', cat: 'Household', unit: 'piece', price: 5500, stock: 15, low: 4 },
];

export function buildSeedProducts(now: string, makeId: () => string): Product[] {
  return ITEMS.map((item) => ({
    id: makeId(),
    nameEn: item.en,
    nameTa: item.ta,
    barcodes: [], // filled in by learn-as-you-scan — see the note above
    category: item.cat,
    unit: item.unit,
    sellPricePaise: item.price,
    stockQty: item.stock,
    lowStockThreshold: item.low,
    trackStock: !item.noTrack,
    isQuickTile: Boolean(item.quick),
    createdAt: now,
    updatedAt: now,
  }));
}

export const SEED_PRODUCT_COUNT = ITEMS.length;
