import React, { useEffect, useMemo, useState } from 'react';
import { Banner, Sheet } from '@/components/ui';
import { BillingScreen } from '@/features/billing/BillingScreen';
import { CartProvider } from '@/features/billing/CartContext';
import { InventoryScreen } from '@/features/inventory/InventoryScreen';
import { ReorderScreen } from '@/features/inventory/ReorderScreen';
import { ShelfLabelsScreen } from '@/features/inventory/ShelfLabelsScreen';
import { CustomersScreen } from '@/features/customers/CustomersScreen';
import { LedgerScreen } from '@/features/ledger/LedgerScreen';
import { BillsScreen } from '@/features/bills/BillsScreen';
import { DayCloseScreen } from '@/features/dayclose/DayCloseScreen';
import { ReportsScreen } from '@/features/reports/ReportsScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ReceiptSheet } from '@/features/bill/ReceiptSheet';
import { UpdatePrompt } from '@/features/pwa/UpdatePrompt';
import { LockScreen } from '@/features/lock/LockScreen';
import {
  getStorageStatus,
  isStorageEphemeral,
  requestPersistentStorage,
  type StorageStatus,
} from '@/data/db';
import { seedIfEmpty } from '@/data/seed';
import { updateSettings, useSettings } from '@/hooks/useSettings';
import { I18nContext, useT } from '@/i18n/useT';
import type { TranslationKey } from '@/i18n/en';
import type { Language, Sale } from '@/domain/types';

export type Screen =
  | 'billing'
  | 'inventory'
  | 'ledger'
  | 'reports'
  | 'customers'
  | 'bills'
  | 'dayclose'
  | 'reorder'
  | 'labels'
  | 'settings';

/** Five thumb-reachable primaries; the rest live behind "More". */
const PRIMARY: { id: Screen; key: TranslationKey; icon: string }[] = [
  { id: 'billing', key: 'nav.billing', icon: '🧾' },
  { id: 'inventory', key: 'nav.inventory', icon: '📦' },
  { id: 'ledger', key: 'nav.ledger', icon: '📒' },
  { id: 'reports', key: 'nav.reports', icon: '📊' },
];

const MORE: { id: Screen; key: TranslationKey; icon: string }[] = [
  { id: 'bills', key: 'nav.bills', icon: '🧾' },
  { id: 'customers', key: 'nav.customers', icon: '👥' },
  { id: 'dayclose', key: 'nav.dayClose', icon: '🌙' },
  { id: 'reorder', key: 'reorder.title', icon: '⚠️' },
  { id: 'labels', key: 'labels.title', icon: '🏷️' },
  { id: 'settings', key: 'nav.settings', icon: '⚙️' },
];

const App: React.FC = () => {
  const settings = useSettings();
  const [screen, setScreen] = useState<Screen>('billing');
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [ephemeral, setEphemeral] = useState(false);
  const [quotaDismissed, setQuotaDismissed] = useState(false);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    void seedIfEmpty();
    void requestPersistentStorage();
    void getStorageStatus().then(setStorage);
    void isStorageEphemeral().then(setEphemeral);
  }, []);

  // Theme is mirrored to localStorage purely so index.html can apply it before
  // first paint; IndexedDB remains the source of truth.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.ui.theme === 'dark');
    try {
      localStorage.setItem('kbs-theme', settings.ui.theme);
    } catch {
      /* storage blocked — the ephemeral warning covers this */
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

  const pin = settings.ui.staffPin?.trim();

  return (
    <I18nContext.Provider value={i18nValue}>
      {pin && locked ? (
        <LockScreen pin={pin} onUnlock={() => setLocked(false)} />
      ) : (
        <CartProvider>
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
        </CartProvider>
      )}
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
  const [moreOpen, setMoreOpen] = useState(false);

  const quotaLow = storage !== null && storage.usedFraction > 0.8;
  const inMore = MORE.some((item) => item.id === screen);
  const title = [...PRIMARY, ...MORE].find((item) => item.id === screen);

  return (
    <div className="flex flex-col h-[100dvh] bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-light-surface dark:bg-dark-surface border-b border-slate-200 dark:border-slate-700 no-print">
        <h1 className="font-bold text-lg">
          {screen === 'billing' ? 'KBS' : title ? t(title.key) : 'KBS'}
        </h1>
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
        <div className="px-4 pt-3 space-y-2 flex-shrink-0 no-print">
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
        {screen === 'ledger' && <LedgerScreen />}
        {screen === 'reports' && <ReportsScreen />}
        {screen === 'customers' && <CustomersScreen />}
        {screen === 'bills' && <BillsScreen />}
        {screen === 'dayclose' && <DayCloseScreen />}
        {screen === 'reorder' && <ReorderScreen />}
        {screen === 'labels' && <ShelfLabelsScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>

      <nav className="flex-shrink-0 flex border-t border-slate-200 dark:border-slate-700 bg-light-surface dark:bg-dark-surface pb-safe no-print">
        {PRIMARY.map((item) => (
          <NavButton
            key={item.id}
            icon={item.icon}
            label={t(item.key)}
            active={screen === item.id}
            onClick={() => setScreen(item.id)}
          />
        ))}
        <NavButton
          icon="⋯"
          label={t('nav.more')}
          active={inMore}
          onClick={() => setMoreOpen(true)}
        />
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.more')}>
        <div className="grid grid-cols-3 gap-3">
          {MORE.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setScreen(item.id);
                setMoreOpen(false);
              }}
              className={`flex flex-col items-center gap-1 p-4 rounded-xl border ${
                screen === item.id
                  ? 'border-brand-primary bg-brand-primary/10'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-center leading-tight">{t(item.key)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
};

const NavButton: React.FC<{
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
      active ? 'text-brand-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'
    }`}
  >
    <span className="text-xl leading-none">{icon}</span>
    <span className="truncate max-w-full px-1">{label}</span>
  </button>
);

export default App;
