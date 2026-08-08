import React, { useEffect, useMemo, useState } from 'react';
import { Banner, Sheet } from '@/components/ui';
import {
  IconBilling,
  IconBills,
  IconCustomers,
  IconDayClose,
  IconInventory,
  IconLabels,
  IconLedger,
  IconLowStock,
  IconMore,
  IconReports,
  IconSettings,
} from '@/components/icons';
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

type NavItem = {
  id: Screen;
  key: TranslationKey;
  Icon: React.FC<{ className?: string }>;
};

/** Five thumb-reachable primaries; the rest live behind "More". */
const PRIMARY: NavItem[] = [
  { id: 'billing', key: 'nav.billing', Icon: IconBilling },
  { id: 'inventory', key: 'nav.inventory', Icon: IconInventory },
  { id: 'ledger', key: 'nav.ledger', Icon: IconLedger },
  { id: 'reports', key: 'nav.reports', Icon: IconReports },
];

const MORE: NavItem[] = [
  { id: 'bills', key: 'nav.bills', Icon: IconBills },
  { id: 'customers', key: 'nav.customers', Icon: IconCustomers },
  { id: 'dayclose', key: 'nav.dayClose', Icon: IconDayClose },
  { id: 'reorder', key: 'reorder.title', Icon: IconLowStock },
  { id: 'labels', key: 'labels.title', Icon: IconLabels },
  { id: 'settings', key: 'nav.settings', Icon: IconSettings },
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
  const settings = useSettings();
  const [moreOpen, setMoreOpen] = useState(false);

  const shopName =
    (lang === 'ta' && settings.shop.nameTa.trim()) || settings.shop.nameEn || 'KBS';

  const quotaLow = storage !== null && storage.usedFraction > 0.8;
  const inMore = MORE.some((item) => item.id === screen);
  const title = [...PRIMARY, ...MORE].find((item) => item.id === screen);

  return (
    <div className="flex flex-col h-[100dvh] bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
      <header className="flex-shrink-0 bg-light-surface dark:bg-dark-surface border-b border-slate-200 dark:border-slate-700 no-print">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          {/* The shop's own name, the way a till identifies itself. */}
          <h1 className="font-semibold leading-tight truncate">{shopName}</h1>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
            {title ? t(title.key) : ''}
          </p>
        </div>
        {/* Language toggle lives in the header, not buried in Settings —
            staff switch mid-shift. */}
        <button
          onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
          className="flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {lang === 'ta' ? 'English' : 'தமிழ்'}
        </button>
        </div>
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

      {/* Content is capped so a wide screen doesn't strand the amount at one
          edge and its button at the other. */}
      <main className="flex-1 overflow-hidden w-full max-w-3xl mx-auto">
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

      <nav className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-light-surface dark:bg-dark-surface pb-safe no-print">
        <div className="max-w-3xl mx-auto w-full flex">
        {PRIMARY.map((item) => (
          <NavButton
            key={item.id}
            Icon={item.Icon}
            label={t(item.key)}
            active={screen === item.id}
            onClick={() => setScreen(item.id)}
          />
        ))}
        <NavButton
          Icon={IconMore}
          label={t('nav.more')}
          active={inMore}
          onClick={() => setMoreOpen(true)}
        />
        </div>
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
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                screen === item.id
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:text-brand-on-dark'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <item.Icon className="w-6 h-6" />
              <span className="text-xs text-center leading-tight font-medium">{t(item.key)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
};

const NavButton: React.FC<{
  Icon: React.FC<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
      active
        ? 'text-brand-primary dark:text-brand-on-dark'
        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
    }`}
  >
    {/* A rule above the active tab reads as a tab bar rather than a toy. */}
    {active && <span className="absolute top-0 inset-x-3 h-0.5 bg-brand-primary rounded-full" />}
    <Icon className="w-[22px] h-[22px]" />
    <span className="truncate max-w-full px-1">{label}</span>
  </button>
);

export default App;
