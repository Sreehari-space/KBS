/**
 * Settings persistence.
 *
 * The old Settings screen wrote to component state that nothing ever read —
 * tax rate, GSTIN and UPI VPA were typed into fields and discarded. These
 * values now live here and are the single source the billing screen reads.
 */

import { db } from '../db';
import type { Settings } from '@/domain/types';

export const SETTINGS_ID = 'singleton';

export const defaultSettings: Settings = {
  id: SETTINGS_ID,
  shop: {
    nameEn: 'My Store',
    nameTa: 'எனது கடை',
    addressLines: [],
    phone: '',
  },
  gst: {
    // Off by default (D6): most target shops are below the ₹40L threshold or
    // on the composition scheme and charge no GST at all.
    enabled: false,
    stateCode: '33', // Tamil Nadu
    pricesIncludeTax: true, // Indian retail quotes MRP inclusive of tax
  },
  billing: {
    roundOffEnabled: true,
    billPrefix: '',
    footerLineEn: 'Thank you! Visit again',
    footerLineTa: 'நன்றி! மீண்டும் வருக',
    showSavings: true,
    printUpiQr: true,
  },
  printer: {
    widthMm: 58,
    mode: 'browser',
    copies: 1,
  },
  ui: {
    language: 'ta',
    theme: 'light',
    billingLayout: 'grid',
  },
  ai: {},
  scanner: {
    beepOnScan: true,
    continuousMode: true,
    weightBarcodePrefix: '',
  },
};

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get(SETTINGS_ID);
  return stored ? mergeDefaults(stored) : defaultSettings;
}

export async function ensureSettings(): Promise<Settings> {
  const stored = await db.settings.get(SETTINGS_ID);
  if (stored) return mergeDefaults(stored);
  await db.settings.put(defaultSettings);
  return defaultSettings;
}

/** Patch one section without clobbering the others. */
export async function updateSettings<K extends keyof Omit<Settings, 'id'>>(
  section: K,
  patch: Partial<Settings[K]>,
): Promise<void> {
  const current = await getSettings();
  await db.settings.put({
    ...current,
    [section]: { ...current[section], ...patch },
  });
}

export async function replaceSettings(next: Settings): Promise<void> {
  await db.settings.put({ ...next, id: SETTINGS_ID });
}

/**
 * Fill in any section added by a later version, so a shop upgrading from an
 * older build doesn't hit undefined reads on the billing path.
 */
function mergeDefaults(stored: Settings): Settings {
  return {
    ...defaultSettings,
    ...stored,
    id: SETTINGS_ID,
    shop: { ...defaultSettings.shop, ...stored.shop },
    gst: { ...defaultSettings.gst, ...stored.gst },
    billing: { ...defaultSettings.billing, ...stored.billing },
    printer: { ...defaultSettings.printer, ...stored.printer },
    ui: { ...defaultSettings.ui, ...stored.ui },
    ai: { ...defaultSettings.ai, ...stored.ai },
    scanner: { ...defaultSettings.scanner, ...stored.scanner },
  };
}
