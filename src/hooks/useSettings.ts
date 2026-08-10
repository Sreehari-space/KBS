import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { defaultSettings, SETTINGS_ID, updateSettings } from '@/data/repositories/settingsRepo';
import type { Settings } from '@/domain/types';

/**
 * Live settings. Every screen reads from here, so a change in Settings takes
 * effect on the billing screen immediately — unlike the old build where the
 * tax rate and UPI ID were typed into fields nothing ever read.
 */
export function useSettings(): Settings {
  return useSettingsStatus().settings;
}

/**
 * Settings plus whether they have actually been read off disk yet.
 *
 * `useSettings` cannot tell "not loaded" from "loaded and empty", which is
 * fine for a colour scheme and wrong for anything gated on a stored flag —
 * first-run setup would flash on every cold start. Only App needs this.
 */
export function useSettingsStatus(): { settings: Settings; loaded: boolean } {
  const stored = useLiveQuery(() => db.settings.get(SETTINGS_ID), [], undefined);
  if (!stored) return { settings: defaultSettings, loaded: false };
  return { loaded: true, settings: mergeStored(stored) };
}

function mergeStored(stored: Settings): Settings {
  return {
    ...defaultSettings,
    ...stored,
    shop: { ...defaultSettings.shop, ...stored.shop },
    gst: { ...defaultSettings.gst, ...stored.gst },
    billing: { ...defaultSettings.billing, ...stored.billing },
    printer: { ...defaultSettings.printer, ...stored.printer },
    ui: { ...defaultSettings.ui, ...stored.ui },
    ai: { ...defaultSettings.ai, ...stored.ai },
    scanner: { ...defaultSettings.scanner, ...stored.scanner },
  };
}

export { updateSettings };
