import React, { useEffect, useState } from 'react';
import { Banner, Button, Field, Input, Select, Sheet, Toggle } from '@/components/ui';
import { getStorageStatus, type StorageStatus } from '@/data/db';
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
                addressLines: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
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
                onChange={(e) => void updateSettings('gst', { gstin: e.target.value.toUpperCase() })}
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
      </Section>

      {/* ── Appearance ── */}
      <Section title={t('set.appearance')}>
        <Field label={t('set.language')}>
          <div className="flex gap-2">
            {(['ta', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 py-2.5 rounded-lg border-2 font-medium ${
                  lang === l
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {l === 'ta' ? 'தமிழ்' : 'English'}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('set.appearance')}>
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map((th) => (
              <button
                key={th}
                onClick={() => void updateSettings('ui', { theme: th })}
                className={`flex-1 py-2.5 rounded-lg border-2 font-medium ${
                  settings.ui.theme === th
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {th === 'light' ? t('set.light') : t('set.dark')}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* ── Data & backup ── */}
      <Section title={t('set.data')}>
        <div className="text-sm space-y-1 mb-3 text-light-text-secondary dark:text-dark-text-secondary">
          <div className="flex justify-between">
            <span>{t('set.lastBackup')}</span>
            <span className="tnum">
              {lastBackup ? lastBackup.toLocaleString() : t('set.never')}
            </span>
          </div>
          {storage && storage.quotaBytes > 0 && (
            <div className="flex justify-between">
              <span>{t('set.storageUsed')}</span>
              <span className="tnum">
                {(storage.usageBytes / 1_048_576).toFixed(1)} MB
                {storage.persisted ? ' · protected' : ''}
              </span>
            </div>
          )}
        </div>

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
            <span className="block text-center px-4 py-3 rounded-lg font-semibold bg-slate-100 dark:bg-slate-700 cursor-pointer">
              {t('set.import')}
            </span>
          </label>

          <Button
            variant="ghost"
            onClick={async () => {
              const fixed = await recalculateAllBalances();
              setMessage(`${t('set.recalcBalances')}: ${fixed}`);
            }}
          >
            {t('set.recalcBalances')}
          </Button>

          {installPrompt && (
            <Button
              variant="secondary"
              onClick={async () => {
                await (installPrompt as unknown as { prompt: () => Promise<void> }).prompt();
                setInstallPrompt(null);
              }}
            >
              {t('set.install')}
            </Button>
          )}
        </div>
      </Section>

      {/* ── AI (optional, user-supplied key) ── */}
      <Section title={t('set.ai')}>
        <Field label={t('set.aiKey')} hint={t('set.aiHint')}>
          <Input
            type="password"
            value={settings.ai.geminiApiKey ?? ''}
            onChange={(e) => void updateSettings('ai', { geminiApiKey: e.target.value })}
            placeholder="AIza…"
          />
        </Field>
      </Section>

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
              <p className="tnum">
                {new Date(pendingRestore.exportedAt).toLocaleString()}
              </p>
              <ul className="mt-2 space-y-0.5 tnum">
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
  <div className="rounded-xl bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 p-4 space-y-3">
    <h2 className="font-semibold">{title}</h2>
    {children}
  </div>
);
