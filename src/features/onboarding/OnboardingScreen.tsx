import React, { useState } from 'react';
import { IconCheck, IconPlus } from '@/components/icons';
import { createProduct } from '@/data/repositories/productRepo';
import { parseRupeeInput } from '@/domain/money';
import { suggestNames } from '@/domain/tamil/suggest';
import { nowIso } from '@/data/db';
import { updateSettings } from '@/hooks/useSettings';
import { useT } from '@/i18n/useT';
import { RiceSack, ShopSign, StampedBill } from './illustrations';

interface ItemDraft {
  name: string;
  price: string;
}

const BLANK_ROWS: ItemDraft[] = Array.from({ length: 3 }, () => ({ name: '', price: '' }));

type StepNo = 1 | 2 | 3;

/**
 * One table, one row per question.
 *
 * A colour per step: pink, lime, peach. The step you are on is the colour of
 * the whole screen, so progress is felt before the rule at the top is read.
 * Ink clears 13:1 on all three grounds and the muted ink clears 7:1.
 *
 * The art shrinks on step 3 because step 3 is the only one carrying a list.
 */
const STEPS: Record<
  StepNo,
  { ground: string; art: React.FC<{ className?: string }>; artSize: string }
> = {
  1: { ground: 'bg-paper-pink dark:bg-paper-pink-dark', art: ShopSign, artSize: 'h-40' },
  2: { ground: 'bg-paper-lime dark:bg-paper-lime-dark', art: StampedBill, artSize: 'h-40' },
  3: { ground: 'bg-paper-peach dark:bg-paper-peach-dark', art: RiceSack, artSize: 'h-28' },
};

/**
 * Fields here are written out rather than borrowed from `@/components/ui`.
 * The shared Input is a soft white card with a transparent border, which is
 * right on the till and wrong here: a white fill on the lime ground measures
 * 1.15:1, so it would read as a smudge, not a box. On this screen the ink
 * border does the separating and the fill barely matters. Overriding almost
 * every base class of the shared primitive to get there would have been worse
 * than not using it.
 *
 * No width class — the caller adds one. That is the same trap that collapsed
 * the item-name box to 26px, and one width per element is how it stays fixed.
 */
const FIELD =
  'rounded-2xl border-[2.5px] border-ink/85 bg-white/70 px-4 py-3 text-[17px] text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-ink dark:border-ink-cream/55 dark:bg-white/[0.07] dark:text-ink-cream dark:placeholder:text-ink-cream-soft/60 dark:focus:border-ink-cream';

const LABEL = 'mb-1.5 block text-sm font-semibold text-ink-soft dark:text-ink-cream-soft';

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
 *
 * It is also the one screen in KBS that is not a till, and it is dressed like
 * it: a pastel ground per step, heavy display type and drawn-by-hand ink. The
 * treatment stops at the front door on purpose — the same pastels behind a
 * cart list would cost the legibility the counter depends on.
 */
export const OnboardingScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { t, lang, setLang } = useT();
  const [step, setStep] = useState<StepNo>(1);
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
  const { ground, art: Art, artSize } = STEPS[step];
  const go = (n: number) => setStep(Math.min(3, Math.max(1, n)) as StepNo);

  // Tamil sets longer words in a taller script, so the display size steps down
  // rather than wrapping a heading to five lines on a 360px phone. `.display`
  // already resets the tight Latin tracking for `:lang(ta)`; the size is the
  // part it cannot know about.
  const headingSize = lang === 'ta' ? 'text-[1.9rem]' : 'text-[2.4rem]';

  return (
    <div
      className={`flex h-full flex-col text-ink transition-colors duration-500 dark:text-ink-cream ${ground}`}
    >
      <header className="mx-auto w-full max-w-lg flex-shrink-0 px-6 pb-2 pt-6">
        <div className="flex items-center justify-between gap-3">
          {/* Back lives up here so the footer can hold the reference's two
              actions and nothing else. */}
          <button
            onClick={() => go(step - 1)}
            disabled={step === 1}
            aria-label={t('common.back')}
            className="-ml-1 rounded-full p-1 focus-ring disabled:opacity-0"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 5 L8 12 L15 19" />
            </svg>
          </button>
          <button
            onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
            className="rounded-full border-2 border-ink/80 px-4 py-1.5 text-sm font-semibold focus-ring dark:border-ink-cream/60"
          >
            {lang === 'ta' ? 'English' : 'தமிழ்'}
          </button>
        </div>

        {/* Three hairlines, one per question. The one you are on is drawn
            heavier — the others stay, so the length of the road is visible. */}
        <div className="mt-5 flex gap-2" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`flex-1 rounded-full bg-current transition-all duration-300 ${
                n === step ? 'h-[3px] opacity-100' : 'h-px opacity-35'
              }`}
            />
          ))}
        </div>
        <p className="sr-only">{t('onb.step', { n: step })}</p>
      </header>

      {/* The reference spreads a card rather than stacking it: heading at the
          top, the drawing floating in whatever room is left, and the copy and
          controls sitting down on the action. `min-h-full` makes the middle
          claim the slack on a short step and collapse on a tall one, so step 3
          still scrolls from the top instead of centring itself out of view. */}
      <main className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-6">
        <div className="flex min-h-full flex-col pb-2">
          <h1 className={`display mt-5 font-bold ${headingSize}`}>
            {step === 1 && t('onb.welcome')}
            {step === 2 && t('onb.gstTitle')}
            {step === 3 && t('onb.itemsTitle')}
          </h1>

          <div className="grid flex-1 place-items-center py-4">
            <Art className={`w-auto ${artSize}`} />
          </div>

          <p className="mb-5 text-[17px] leading-snug text-ink-soft dark:text-ink-cream-soft">
            {step === 1 && t('onb.welcomeHint')}
            {step === 2 && t('onb.gstHint')}
            {step === 3 && t('onb.itemsHint')}
          </p>

          {step === 1 && (
            <section className="animate-fade-in space-y-3">
              <label className="block">
                <span className={LABEL}>{t('onb.shopTitle')}</span>
                <input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={t('set.shopName')}
                  autoFocus
                  className={`${FIELD} w-full`}
                />
                <span className="mt-1.5 block text-xs text-ink-soft dark:text-ink-cream-soft">
                  {t('onb.shopHint')}
                </span>
              </label>
              <label className="block">
                <span className={LABEL}>
                  {t('set.shopNameTa')} ({t('common.optional')})
                </span>
                <input
                  value={shopNameTa}
                  onChange={(e) => setShopNameTa(e.target.value)}
                  className={`${FIELD} w-full`}
                />
              </label>
            </section>
          )}

          {step === 2 && (
            <section className="animate-fade-in space-y-3">
              {[
                { value: false, label: t('onb.gstNo') },
                { value: true, label: t('onb.gstYes') },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  onClick={() => setGst(option.value)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-[2.5px] p-4 text-left font-semibold transition-colors focus-ring ${
                    gst === option.value
                      ? 'border-ink bg-ink text-white dark:border-ink-cream dark:bg-ink-cream dark:text-ink'
                      : 'border-ink/80 bg-white/60 text-ink dark:border-ink-cream/55 dark:bg-white/[0.07] dark:text-ink-cream'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      gst === option.value
                        ? 'border-white bg-white text-ink dark:border-ink dark:bg-ink dark:text-ink-cream'
                        : 'border-ink/70 dark:border-ink-cream/60'
                    }`}
                  >
                    {gst === option.value && <IconCheck className="h-3 w-3" />}
                  </span>
                  {option.label}
                </button>
              ))}
            </section>
          )}

          {step === 3 && (
            <section className="animate-fade-in">
              <div className="space-y-2.5">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2.5">
                    <input
                      value={item.name}
                      placeholder={t('onb.itemName')}
                      onChange={(e) =>
                        setItems((cur) =>
                          cur.map((row, i) =>
                            i === index ? { ...row, name: e.target.value } : row,
                          ),
                        )
                      }
                      className={`${FIELD} min-w-0 flex-1`}
                    />
                    <input
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
                      className={`${FIELD} tnum w-24`}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setItems((cur) => [...cur, { name: '', price: '' }])}
                className="mt-3 flex items-center gap-2 rounded-full border-2 border-ink/70 px-4 py-2 text-sm font-semibold focus-ring dark:border-ink-cream/50"
              >
                <IconPlus className="h-4 w-4" />
                {t('onb.addRow')}
              </button>
              {filledItems > 0 && (
                <p className="mt-3 text-sm font-semibold">
                  {t('onb.itemsAdded', { n: filledItems })}
                </p>
              )}
            </section>
          )}
        </div>
      </main>

      {/* The reference's footer: one ink pill, and the way out beside it.
          Tamil sets "start billing" about twice as wide as English, so the pill
          refuses to break mid-label and the row wraps instead — the way out
          drops to its own line rather than the action folding in half. */}
      <footer className="mx-auto flex w-full max-w-lg flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-6 pb-safe pb-4 pt-3">
        <button
          onClick={() => (step < 3 ? go(step + 1) : void finish())}
          disabled={saving}
          className="whitespace-nowrap rounded-full bg-ink px-7 py-3.5 font-semibold text-white transition-transform focus-ring active:scale-[0.98] disabled:opacity-60 dark:bg-ink-cream dark:text-ink"
        >
          {step < 3 ? t('onb.next') : t('onb.finish')}
        </button>
        <button
          onClick={() => void skip()}
          disabled={saving}
          className="rounded text-sm font-medium text-ink-soft underline decoration-ink-soft/40 underline-offset-4 focus-ring dark:text-ink-cream-soft dark:decoration-ink-cream-soft/40"
        >
          {t('onb.skip')}
        </button>
      </footer>
    </div>
  );
};
