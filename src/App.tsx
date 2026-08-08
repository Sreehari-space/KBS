import React, { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui';
import { BillingScreen } from '@/features/billing/BillingScreen';
import { InventoryScreen } from '@/features/inventory/InventoryScreen';
import { CustomersScreen } from '@/features/customers/CustomersScreen';
import { ReportsScreen } from '@/features/reports/ReportsScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ReceiptSheet } from '@/features/bill/ReceiptSheet';
import { UpdatePrompt } from '@/features/pwa/UpdatePrompt';
import {
  getStorageStatus,
  isStorageEphemeral,
  requestPersistentStorage,
  type StorageStatus,
} from '@/data/db';
import { seedIfEmpty } from '@/data/seed';
import { updateSettings, useSettings } from '@/hooks/useSettings';
import { I18nContext, useT } from '@/i18n/useT';
import type { Language, Sale } from '@/domain/types';

export type Screen = 'billing' | 'inventory' | 'customers' | 'reports' | 'settings';

const NAV: { id: Screen; key: 'nav.billing' | 'nav.inventory' | 'nav.customers' | 'nav.reports' | 'nav.settings'; icon: string }[] = [
  { id: 'billing', key: 'nav.billing', icon: '🧾' },
  { id: 'inventory', key: 'nav.inventory', icon: '📦' },
  { id: 'customers', key: 'nav.customers', icon: '👥' },
  { id: 'reports', key: 'nav.reports', icon: '📊' },
  { id: 'settings', key: 'nav.settings', icon: '⚙️' },
];

const App: React.FC = () => {
  const settings = useSettings();
  const [screen, setScreen] = useState<Screen>('billing');
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [ephemeral, setEphemeral] = useState(false);
  const [quotaDismissed, setQuotaDismissed] = useState(false);

  // First run: seed the catalogue and ask the browser to protect our data.
  useEffect(() => {
    void seedIfEmpty();
    void requestPersistentStorage();
    void getStorageStatus().then(setStorage);
    void isStorageEphemeral().then(setEphemeral);
  }, []);

  // Theme is mirrored to localStorage purely so index.html can apply it
  // before first paint; IndexedDB remains the source of truth.
  useEffect(() => {
    const dark = settings.ui.theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('kbs-theme', settings.ui.theme);
    } catch {
      /* storage blocked — the ephemeral warning already covers this */
    }
  }, [settings.ui.theme]);

  useEffect(() => {
    document.documentElement.lang = settings.ui.language;
  }, [settings.ui.language]);

  const i18nValue = useMemo(
    () => ({
      lang: settings.ui.language,
      setLang: (lang: Language) => void updateSettings('ui', { language: lang }),
    }),
    [settings.ui.language],
  );

  return (
    <I18nContext.Provider value={i18nValue}>
      <Shell
        screen={screen}
        setScreen={setScreen}
        storage={storage}
        ephemeral={ephemeral}
        quotaDismissed={quotaDismissed}
        onDismissQuota={() => setQuotaDismissed(true)}
        onBilled={setLastSale}
      />
      <ReceiptSheet sale={lastSale} onClose={() => setLastSale(null)} />
      <UpdatePrompt />
    </I18nContext.Provider>
  );
};

const Shell: React.FC<{
  screen: Screen;
  setScreen: (s: Screen) => void;
  storage: StorageStatus | null;
  ephemeral: boolean;
  quotaDismissed: boolean;
  onDismissQuota: () => void;
  onBilled: (sale: Sale) => void;
}> = ({ screen, setScreen, storage, ephemeral, quotaDismissed, onDismissQuota, onBilled }) => {
  const { t, lang, setLang } = useT();

  const quotaLow = storage !== null && storage.usedFraction > 0.8;

  return (
    <div className="flex flex-col h-[100dvh] bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-light-surface dark:bg-dark-surface border-b border-slate-200 dark:border-slate-700">
        <h1 className="font-bold text-lg">KBS</h1>
        {/* Language toggle lives in the header, not buried in Settings —
            staff switch mid-shift. */}
        <button
          onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
          className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-700"
        >
          {lang === 'ta' ? 'English' : 'தமிழ்'}
        </button>
      </header>

      {(ephemeral || (quotaLow && !quotaDismissed) || storage?.unavailable) && (
        <div className="px-4 pt-3 space-y-2 flex-shrink-0">
          {/* Billing in a private window would lose the entire day. */}
          {ephemeral && <Banner tone="danger">{t('warn.ephemeral')}</Banner>}
          {storage?.unavailable && <Banner tone="danger">{t('warn.noStorage')}</Banner>}
          {quotaLow && !quotaDismissed && (
            <Banner tone="warning" onDismiss={onDismissQuota}>
              {t('warn.quota')}
            </Banner>
          )}
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {screen === 'billing' && <BillingScreen onBilled={onBilled} />}
        {screen === 'inventory' && <InventoryScreen />}
        {screen === 'customers' && <CustomersScreen />}
        {screen === 'reports' && <ReportsScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>

      {/* Bottom nav on phones (thumb-reachable); the same bar works on desktop. */}
      <nav className="flex-shrink-0 flex border-t border-slate-200 dark:border-slate-700 bg-light-surface dark:bg-dark-surface pb-safe no-print">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
              screen === item.id
                ? 'text-brand-primary'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span>{t(item.key)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
