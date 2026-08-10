import React, { useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { IconCheck, IconPlus } from '@/components/icons';
import { createProduct } from '@/data/repositories/productRepo';
import { parseRupeeInput } from '@/domain/money';
import { suggestNames } from '@/domain/tamil/suggest';
import { nowIso } from '@/data/db';
import { updateSettings } from '@/hooks/useSettings';
import { useT } from '@/i18n/useT';

interface ItemDraft {
  name: string;
  price: string;
}

const BLANK_ROWS: ItemDraft[] = Array.from({ length: 3 }, () => ({ name: '', price: '' }));

/**
 * First run.
 *
 * A fresh install used to drop the shopkeeper straight onto an empty billing
 * screen — technically correct and completely unwelcoming. Three questions
 * and four minutes later the till has their shop's name on it, knows whether
 * it charges GST, and has their fastest sellers waiting on the front screen.
 * That is the difference between software that was installed and software
 * that was set up FOR them.
 *
 * Everything here is skippable and everything is editable later in Settings,
 * so this is a head start, never a gate.
 */
export const OnboardingScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { t, lang, setLang } = useT();
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState('');
  const [shopNameTa, setShopNameTa] = useState('');
  const [gst, setGst] = useState<boolean | null>(null);
  const [items, setItems] = useState<ItemDraft[]>(BLANK_ROWS);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    const trimmed = shopName.trim();
    if (trimmed) {
      await updateSettings('shop', {
        nameEn: trimmed,
        nameTa: shopNameTa.trim() || trimmed,
      });
    }
    if (gst !== null) await updateSettings('gst', { enabled: gst });

    for (const item of items) {
      const name = item.name.trim();
      const price = parseRupeeInput(item.price);
      if (!name || price === null || price <= 0) continue;
      const suggestion = suggestNames(name);
      await createProduct({
        nameEn: suggestion.nameEn || name,
        nameTa: suggestion.nameTa,
        barcodes: [],
        category: 'General',
        unit: 'piece',
        sellPricePaise: price,
        stockQty: 0,
        lowStockThreshold: 0,
        // A shop that has not counted its stock should not be told items are
        // out of stock on day one.
        trackStock: false,
        // The whole point of asking is that these greet them on the till.
        isQuickTile: true,
      });
    }

    await updateSettings('ui', { onboardedAt: nowIso() });
    onDone();
  };

  const skip = async () => {
    setSaving(true);
    await updateSettings('ui', { onboardedAt: nowIso() });
    onDone();
  };

  const filledItems = items.filter((i) => i.name.trim() && parseRupeeInput(i.price)).length;

  return (
    <div className="h-[100dvh] flex flex-col bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
      <header className="flex-shrink-0 px-5 pt-6 pb-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
            {t('onb.step', { n: step })}
          </p>
          <button
            onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 focus-ring"
          >
            {lang === 'ta' ? 'English' : 'தமிழ்'}
          </button>
        </div>
        {/* Progress is a rule, not a spinner: three segments, one per step. */}
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 max-w-lg mx-auto w-full">
        {step === 1 && (
          <section className="animate-fade-in">
            <h1 className="text-2xl font-bold">{t('onb.welcome')}</h1>
            <p className="mt-1 mb-6 text-light-text-secondary dark:text-dark-text-secondary">
              {t('onb.welcomeHint')}
            </p>
            <Field label={t('onb.shopTitle')} hint={t('onb.shopHint')}>
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder={t('set.shopName')}
                autoFocus
                className="text-lg"
              />
            </Field>
            <div className="mt-3">
              <Field label={`${t('set.shopNameTa')} (${t('common.optional')})`}>
                <Input
                  value={shopNameTa}
                  onChange={(e) => setShopNameTa(e.target.value)}
                  className="text-lg"
                />
              </Field>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="animate-fade-in">
            <h1 className="text-2xl font-bold">{t('onb.gstTitle')}</h1>
            <p className="mt-1 mb-6 text-light-text-secondary dark:text-dark-text-secondary">
              {t('onb.gstHint')}
            </p>
            <div className="space-y-2">
              {[
                { value: false, label: t('onb.gstNo') },
                { value: true, label: t('onb.gstYes') },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  onClick={() => setGst(option.value)}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 text-left font-medium transition-colors focus-ring ${
                    gst === option.value
                      ? 'border-brand-primary bg-brand-primary/10'
                      : 'border-slate-300 dark:border-slate-600 bg-light-surface dark:bg-dark-surface'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      gst === option.value
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-slate-400 dark:border-slate-500'
                    }`}
                  >
                    {gst === option.value && <IconCheck className="w-3 h-3" />}
                  </span>
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="animate-fade-in">
            <h1 className="text-2xl font-bold">{t('onb.itemsTitle')}</h1>
            <p className="mt-1 mb-5 text-light-text-secondary dark:text-dark-text-secondary">
              {t('onb.itemsHint')}
            </p>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={item.name}
                    placeholder={t('onb.itemName')}
                    onChange={(e) =>
                      setItems((cur) =>
                        cur.map((row, i) =>
                          i === index ? { ...row, name: e.target.value } : row,
                        ),
                      )
                    }
                    className="flex-1"
                  />
                  <Input
                    value={item.price}
                    inputMode="decimal"
                    placeholder={t('onb.itemPrice')}
                    onChange={(e) =>
                      setItems((cur) =>
                        cur.map((row, i) =>
                          i === index ? { ...row, price: e.target.value } : row,
                        ),
                      )
                    }
                    className="w-24 tnum"
                  />
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              className="mt-3 py-2 text-sm flex items-center gap-2"
              onClick={() => setItems((cur) => [...cur, { name: '', price: '' }])}
            >
              <IconPlus className="w-4 h-4" />
              {t('onb.addRow')}
            </Button>
            {filledItems > 0 && (
              <p className="mt-3 text-sm text-brand-secondary font-medium">
                {t('onb.itemsAdded', { n: filledItems })}
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="flex-shrink-0 px-5 py-4 pb-safe max-w-lg mx-auto w-full space-y-2">
        {step < 3 ? (
          <Button full onClick={() => setStep(step + 1)} disabled={saving}>
            {t('onb.next')}
          </Button>
        ) : (
          <Button full onClick={() => void finish()} disabled={saving}>
            {t('onb.finish')}
          </Button>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="text-sm px-2 py-2 rounded text-light-text-secondary dark:text-dark-text-secondary disabled:opacity-0 focus-ring"
          >
            {t('common.back')}
          </button>
          <button
            onClick={() => void skip()}
            disabled={saving}
            className="text-sm px-2 py-2 rounded text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text focus-ring"
          >
            {t('onb.skip')}
          </button>
        </div>
      </footer>
    </div>
  );
};
