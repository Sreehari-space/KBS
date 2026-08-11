import React, { useEffect, useState } from 'react';
import { Banner, Button, Card, Field, Input, Select, Sheet, Toggle } from '@/components/ui';
import { IconCheck, IconChevronDown, IconChevronRight } from '@/components/icons';
import { formatDateTime } from '@/domain/datetime';
import { getStorageStatus, type StorageStatus } from '@/data/db';
import { isBluetoothPrintingAvailable } from '@/features/bill/escpos';
import { recalculateAllBalances } from '@/data/repositories/ledgerRepo';
import {
  daysSinceBackup,
  exportBackup,
  getLastBackupAt,
  parseBackup,
  restoreBackup,
  type BackupFile,
} from '@/features/backup/backupService';
import { updateSettings, useSettings } from '@/hooks/useSettings';
import { useT } from '@/i18n/useT';

export const SettingsScreen: React.FC = () => {
  const { t, lang, setLang } = useT();
  const settings = useSettings();

  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [staleDays, setStaleDays] = useState<number | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const refresh = () => {
    void getStorageStatus().then(setStorage);
    void getLastBackupAt().then(setLastBackup);
    void daysSinceBackup().then(setStaleDays);
  };
  useEffect(refresh, []);

  // Captured so the app can offer installation itself — shop owners will not
  // find the browser's own "Add to home screen" menu item, and installing is
  // what protects storage from eviction (and from Safari's 7-day wipe).
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleImportFile = async (file: File) => {
    try {
      setPendingRestore(parseBackup(await file.text()));
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4 pb-8">
      {message && (
        <Banner tone="info" onDismiss={() => setMessage(null)}>
          {message}
        </Banner>
      )}

      {staleDays !== null && staleDays >= 7 && (
        <Banner tone="warning">{t('backup.reminder', { days: staleDays })}</Banner>
      )}

      {/* Settings opens with reassurance, not with a form. This is the one
          screen where the shopkeeper comes to ask "is my data safe?", and it
          should answer before they scroll. */}
      <Card className="p-4">
        <p className="font-semibold text-lg leading-tight">
          {lang === 'ta' && settings.shop.nameTa ? settings.shop.nameTa : settings.shop.nameEn}
        </p>
        {/* No `uppercase tracking-wide` here: uppercase is a no-op in Tamil
            and the extra letter-spacing pulls its glyph clusters apart. */}
        <h2 className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mt-3 mb-2">
          {t('set.readyTitle')}
        </h2>

        <div className="space-y-2.5 text-sm">
          <div>
            <div className="flex justify-between gap-3">
              <span className="text-light-text-secondary dark:text-dark-text-secondary">
                {t('set.storageUsed')}
              </span>
              <span className="count">
                {storage && storage.quotaBytes > 0
                  ? `${(storage.usageBytes / 1_048_576).toFixed(1)} MB`
                  : '—'}
              </span>
            </div>
            {storage && storage.quotaBytes > 0 && (
              <>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      storage.usedFraction > 0.8 ? 'bg-amber-500' : 'bg-brand-primary'
                    }`}
                    style={{ width: `${Math.max(1, storage.usedFraction * 100)}%` }}
                  />
                </div>
                <p
                  className={`text-xs mt-1 ${
                    storage.persisted
                      ? 'text-brand-secondary dark:text-emerald-400'
                      : 'text-light-text-secondary dark:text-dark-text-secondary'
                  }`}
                >
                  {storage.persisted ? t('set.protected') : t('set.atRisk')}
                </p>
              </>
            )}
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-light-text-secondary dark:text-dark-text-secondary">
              {t('set.lastBackup')}
            </span>
            {/* Age is colour-coded, because "12 days ago" only means something
                if the screen says whether that is fine. */}
            <span
              className={`count text-right ${
                lastBackup === null || (staleDays !== null && staleDays >= 7)
                  ? 'text-amber-600 dark:text-amber-400 font-medium'
                  : 'text-brand-secondary dark:text-emerald-400'
              }`}
            >
              {lastBackup ? formatDateTime(lastBackup.toISOString(), lang) : t('set.never')}
            </span>
          </div>

          {installPrompt ? (
            <Button
              variant="secondary"
              full
              className="py-2.5 text-sm"
              onClick={async () => {
                await (installPrompt as unknown as { prompt: () => Promise<void> }).prompt();
                setInstallPrompt(null);
              }}
            >
              {t('set.install')}
            </Button>
          ) : (
            window.matchMedia?.('(display-mode: standalone)').matches && (
              <p className="flex items-center gap-1.5 text-brand-secondary dark:text-emerald-400">
                <IconCheck className="w-4 h-4" />
                {t('set.installedAlready')}
              </p>
            )
          )}
        </div>
      </Card>

      {/* ── Shop ── */}
      <Section title={t('set.shop')}>
        <Field label={t('set.shopName')}>
          <Input
            value={settings.shop.nameEn}
            onChange={(e) => void updateSettings('shop', { nameEn: e.target.value })}
          />
        </Field>
        <Field label={t('set.shopNameTa')}>
          <Input
            value={settings.shop.nameTa}
            onChange={(e) => void updateSettings('shop', { nameTa: e.target.value })}
          />
        </Field>
        <Field label={t('set.address')}>
          <Input
            value={settings.shop.addressLines.join(', ')}
            onChange={(e) =>
              void updateSettings('shop', {
                addressLines: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
        <Field label={t('set.phone')}>
          <Input
            inputMode="numeric"
            value={settings.shop.phone}
            onChange={(e) => void updateSettings('shop', { phone: e.target.value })}
          />
        </Field>
        <Field label={t('set.upiVpa')} hint={t('set.upiHint')}>
          <Input
            value={settings.shop.upiVpa ?? ''}
            onChange={(e) => void updateSettings('shop', { upiVpa: e.target.value })}
            placeholder="shop@okaxis"
          />
        </Field>
      </Section>

      {/* ── GST ── */}
      <Section title={t('set.gst')}>
        <Toggle
          checked={settings.gst.enabled}
          onChange={(v) => void updateSettings('gst', { enabled: v })}
          label={t('set.gstEnabled')}
          hint={t('set.gstHint')}
        />
        {settings.gst.enabled && (
          <>
            <Field label={t('set.gstin')}>
              <Input
                value={settings.gst.gstin ?? ''}
                onChange={(e) =>
                  void updateSettings('gst', { gstin: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <Toggle
              checked={settings.gst.pricesIncludeTax}
              onChange={(v) => void updateSettings('gst', { pricesIncludeTax: v })}
              label={t('set.pricesIncludeTax')}
            />
          </>
        )}
      </Section>

      {/* ── Billing ── */}
      <Section title={t('set.billing')}>
        <Toggle
          checked={settings.billing.roundOffEnabled}
          onChange={(v) => void updateSettings('billing', { roundOffEnabled: v })}
          label={t('set.roundOff')}
        />
        <Toggle
          checked={settings.billing.showSavings}
          onChange={(v) => void updateSettings('billing', { showSavings: v })}
          label={t('set.showSavings')}
        />
        <Toggle
          checked={settings.billing.printUpiQr}
          onChange={(v) => void updateSettings('billing', { printUpiQr: v })}
          label={t('set.printUpiQr')}
        />
        <Field label={t('set.paperWidth')}>
          <Select
            value={String(settings.printer.widthMm)}
            onChange={(e) =>
              void updateSettings('printer', { widthMm: Number(e.target.value) as 58 | 80 })
            }
          >
            <option value="58">58 mm</option>
            <option value="80">80 mm</option>
          </Select>
        </Field>
        {/* Web Bluetooth is Android-Chrome only; browser printing always
            remains the fallback, so this is only offered where it can work. */}
        {isBluetoothPrintingAvailable() && (
          <Field label={t('set.printer')}>
            <Select
              value={settings.printer.mode}
              onChange={(e) =>
                void updateSettings('printer', {
                  mode: e.target.value as 'browser' | 'bluetooth',
                })
              }
            >
              <option value="browser">Browser print</option>
              <option value="bluetooth">Bluetooth (ESC/POS)</option>
            </Select>
          </Field>
        )}
      </Section>

      {/* ── Scanner ──
          Section and field labels used to be the same word ("Scan" inside
          "Scan"), which reads as a placeholder nobody finished. Each control
          now says what it actually does. */}
      <Section title={t('billing.scan')}>
        <Toggle
          checked={settings.scanner.continuousMode}
          onChange={(v) => void updateSettings('scanner', { continuousMode: v })}
          label={t('set.scanContinuous')}
          hint={t('set.scanContinuousHint')}
        />
        <Toggle
          checked={settings.scanner.beepOnScan}
          onChange={(v) => void updateSettings('scanner', { beepOnScan: v })}
          label={t('set.scanBeep')}
        />
      </Section>

      {/* ── Appearance ── */}
      <Section title={t('set.appearance')}>
        <Field label={t('set.language')}>
          <div className="flex gap-2">
            {(['ta', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors focus-ring ${
                  lang === l
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:text-brand-on-dark'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {l === 'ta' ? 'தமிழ்' : 'English'}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('set.theme')}>
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map((th) => (
              <button
                key={th}
                onClick={() => void updateSettings('ui', { theme: th })}
                className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors focus-ring ${
                  settings.ui.theme === th
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:text-brand-on-dark'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {th === 'light' ? t('set.light') : t('set.dark')}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* ── Data & backup ──
          Storage and last-backup figures moved to the status card at the top;
          this section is now purely the two actions. */}
      <Section title={t('set.data')}>
        <div className="flex flex-col gap-2">
          <Button
            onClick={async () => {
              await exportBackup();
              refresh();
              setMessage(t('backup.exported'));
            }}
          >
            {t('set.export')}
          </Button>

          <label className="block">
            <span className="sr-only">{t('set.import')}</span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
            <span className="block text-center px-4 py-3 rounded-md font-semibold bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 cursor-pointer">
              {t('set.import')}
            </span>
          </label>
        </div>
      </Section>

      {/* ── Staff PIN ──
          The field used to repeat the section's own title back at the reader. */}
      <Section title={t('lock.set')}>
        <Field label={t('set.pinDigits')} hint={t('lock.setHint')}>
          <Input
            inputMode="numeric"
            maxLength={6}
            value={settings.ui.staffPin ?? ''}
            onChange={(e) =>
              void updateSettings('ui', { staffPin: e.target.value.replace(/\D/g, '') })
            }
            placeholder="––––"
            className="tnum"
          />
        </Field>
      </Section>

      {/* ── Advanced ──
          A Gemini API key sitting in the open in a kirana till's settings
          reads like a developer left a demo behind. Everything here is real
          and useful, and none of it belongs in the shopkeeper's line of sight
          on an ordinary day. */}
      <div className="rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          className="w-full flex items-center gap-2 p-3 text-left focus-ring rounded-lg"
        >
          {advancedOpen ? (
            <IconChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <IconChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="font-semibold">{t('set.advanced')}</span>
          {/* Hidden on a phone, where it would wrap under the chevron and
              turn a one-line row into three. */}
          <span className="ml-auto hidden sm:inline text-xs text-light-text-secondary dark:text-dark-text-secondary">
            {t('set.advancedHint')}
          </span>
        </button>

        {advancedOpen && (
          <div className="p-3 pt-0 space-y-3 animate-fade-in">
            <Field label={t('set.weightPrefix')} hint={t('set.weightPrefixHint')}>
              <Input
                inputMode="numeric"
                maxLength={2}
                value={settings.scanner.weightBarcodePrefix}
                onChange={(e) =>
                  void updateSettings('scanner', { weightBarcodePrefix: e.target.value })
                }
                placeholder={t('common.none')}
                className="tnum"
              />
            </Field>

            <Field label={t('set.aiKey')} hint={t('set.aiHint')}>
              <Input
                type="password"
                value={settings.ai.geminiApiKey ?? ''}
                onChange={(e) => void updateSettings('ai', { geminiApiKey: e.target.value })}
                placeholder="AIza…"
              />
            </Field>

            <Button
              variant="ghost"
              full
              onClick={async () => {
                const fixed = await recalculateAllBalances();
                setMessage(`${t('set.recalcBalances')}: ${fixed}`);
              }}
            >
              {t('set.recalcBalances')}
            </Button>
          </div>
        )}
      </div>

      {/* Restore confirmation — never silent. */}
      <Sheet
        open={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        title={t('backup.importTitle')}
      >
        {pendingRestore && (
          <div className="space-y-4">
            <Banner tone="danger">{t('backup.importWarn')}</Banner>
            <div className="text-sm">
              <p className="font-semibold mb-1">{t('backup.contains')}</p>
              <p className="count">{formatDateTime(pendingRestore.exportedAt, lang)}</p>
              <ul className="mt-2 space-y-0.5 count">
                {Object.entries(pendingRestore.counts ?? {}).map(([key, count]) => (
                  <li key={key} className="flex justify-between">
                    <span>{key}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" full onClick={() => setPendingRestore(null)}>
                {t('backup.cancel')}
              </Button>
              <Button
                variant="danger"
                full
                onClick={async () => {
                  await restoreBackup(pendingRestore);
                  setPendingRestore(null);
                  setMessage(t('backup.importTitle'));
                  refresh();
                }}
              >
                {t('backup.replace')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 p-3 space-y-3">
    <h2 className="font-semibold">{title}</h2>
    {children}
  </div>
);
