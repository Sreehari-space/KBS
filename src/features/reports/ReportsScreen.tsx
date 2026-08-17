import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, EmptyState, Money, Sheet, Skeleton, SkeletonStat, Sparkline } from '@/components/ui';
import { IconChevronRight, IconReports } from '@/components/icons';
import { formatDate, formatDateTime } from '@/domain/datetime';
import { db } from '@/data/db';
import { useT } from '@/i18n/useT';
import {
  dailySeries,
  grossMargin,
  hourHistogram,
  paymentMix,
  percentChange,
  periodBounds,
  productTotals,
  summarise,
} from './analytics';
import type { Product, Sale } from '@/domain/types';

const RANGES = [7, 15, 30] as const;

/**
 * Reports built from REAL sales.
 *
 * Every figure carries a baseline, because a number without one is data and a
 * number with one is information. The hour strip and the profit line are the
 * two things a paper notebook cannot produce, which makes them the reason to
 * open this screen at all.
 */
export const ReportsScreen: React.FC = () => {
  const { t, lang } = useT();
  const [days, setDays] = useState<number>(7);
  const [drill, setDrill] = useState<Sale[] | null>(null);

  const { from, previousFrom } = useMemo(() => periodBounds(days), [days]);

  // One query covering BOTH windows; the split happens in memory. Two range
  // queries would double the IndexedDB work for the same rows.
  const sales = useLiveQuery(
    () => db.sales.where('createdAt').aboveOrEqual(previousFrom.toISOString()).toArray(),
    [previousFrom.getTime()],
  );
  const products = useLiveQuery(() => db.products.toArray(), []);

  const loading = sales === undefined || products === undefined;

  const model = useMemo(() => {
    const all = sales ?? [];
    const fromIso = from.toISOString();
    const current = all.filter((s) => s.createdAt >= fromIso);
    const previous = all.filter((s) => s.createdAt < fromIso);

    const costs = new Map<string, number | undefined>(
      (products ?? []).map((p: Product) => [p.id, p.costPricePaise]),
    );

    return {
      current,
      now: summarise(current),
      before: summarise(previous),
      series: dailySeries(current, days),
      hours: hourHistogram(current),
      modes: paymentMix(current),
      top: productTotals(current).slice(0, 8),
      margin: grossMargin(current, costs),
    };
  }, [sales, products, from, days]);

  const { now, before, series, hours, modes, top, margin } = model;
  const peakHour = Math.max(1, ...hours);
  const maxDay = Math.max(1, ...series.map((b) => b.totalPaise));

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4" aria-busy={loading}>
      <div className="flex gap-2">
        {RANGES.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-1.5 text-sm rounded-full border transition-colors focus-ring ${
              days === d
                ? 'bg-brand-primary border-brand-primary text-white'
                : 'bg-light-surface dark:bg-dark-surface border-light-line dark:border-dark-line hover:border-brand-primary'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </div>
          <Card className="p-3 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </Card>
        </>
      ) : now.billCount === 0 ? (
        <EmptyState
          title={t('reports.empty')}
          hint={t('reports.emptyHint')}
          icon={<IconReports className="w-10 h-10" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={t('reports.revenue')}
              paise={now.revenuePaise}
              change={percentChange(now.revenuePaise, before.revenuePaise)}
              days={days}
              spark={series.map((b) => b.totalPaise)}
              onClick={() => setDrill(model.current)}
            />
            <Stat
              label={t('reports.bills')}
              count={now.billCount}
              change={percentChange(now.billCount, before.billCount)}
              days={days}
              spark={series.map((b) => b.billCount)}
              onClick={() => setDrill(model.current)}
            />
            <Stat
              label={t('reports.avgBill')}
              paise={now.averagePaise}
              change={percentChange(now.averagePaise, before.averagePaise)}
              days={days}
            />
            <Stat
              label={t('reports.creditGiven')}
              paise={now.creditPaise}
              change={percentChange(now.creditPaise, before.creditPaise)}
              days={days}
              onClick={() => setDrill(model.current.filter((s) => s.creditPaise > 0))}
            />
          </div>

          {/* Profit is the single most valuable thing this app can show, and
              the one figure it must never overstate — lines with no cost price
              are reported as uncovered rather than counted as pure profit. */}
          <Card className="p-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">{t('reports.profit')}</h2>
              {margin.costedRevenuePaise > 0 && (
                <span className="text-sm count text-light-text-secondary dark:text-dark-text-secondary">
                  {Math.round((margin.profitPaise / margin.costedRevenuePaise) * 100)}%
                </span>
              )}
            </div>
            {margin.costedRevenuePaise === 0 ? (
              <p className="text-sm mt-1 text-light-text-secondary dark:text-dark-text-secondary">
                {t('reports.noCost')}
              </p>
            ) : (
              <>
                <Money
                  paise={margin.profitPaise}
                  className={`block text-2xl font-bold mt-0.5 ${
                    margin.profitPaise < 0 ? 'text-red-600 dark:text-red-400' : ''
                  }`}
                />
                <p className="text-xs mt-1 text-light-text-secondary dark:text-dark-text-secondary">
                  {t('reports.profitHint')}
                  {margin.uncostedRevenuePaise > 0 && (
                    <>
                      {' · '}
                      <Money paise={margin.uncostedRevenuePaise} hidePaise />{' '}
                      {t('reports.uncosted')}
                    </>
                  )}
                </p>
              </>
            )}
          </Card>

          {/* Hour of day. A kirana owner does not know whether the evening
              rush beats the morning one; this is the cheapest way to find
              out, and no notebook can do it. */}
          <Card className="p-3">
            <h2 className="font-semibold">{t('reports.byHour')}</h2>
            <p className="text-xs mb-3 text-light-text-secondary dark:text-dark-text-secondary">
              {t('reports.byHourHint')}
            </p>
            <div className="flex items-end gap-[2px] h-20">
              {hours.map((amount, hour) => (
                // An hour with no sales keeps its 2px stub so the row reads as
                // a baseline, but at a fraction of the opacity — otherwise a
                // dead hour looks like a very small one.
                <div
                  key={hour}
                  className={`flex-1 rounded-t-sm min-h-[2px] ${
                    amount > 0
                      ? 'bg-brand-primary/80 dark:bg-brand-on-dark/70'
                      : 'bg-light-line dark:bg-white/20'
                  }`}
                  style={{ height: `${Math.max(2, (amount / peakHour) * 100)}%` }}
                  title={`${String(hour).padStart(2, '0')}:00`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] mt-1 count text-light-text-secondary dark:text-dark-text-secondary">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </Card>

          <Section title={t('reports.byMode')}>
            {modes.map(([mode, amount]) => (
              <div key={mode} className="flex justify-between py-1.5 text-sm">
                <span>{t(`pay.${mode}` as 'pay.cash')}</span>
                <Money paise={amount} className="font-medium" />
              </div>
            ))}
          </Section>

          <Section title={t('reports.daily')}>
            {[...series].reverse().map((bucket) => (
              <button
                key={bucket.date.toISOString()}
                onClick={() =>
                  setDrill(
                    model.current.filter(
                      (s) => new Date(s.createdAt).toDateString() === bucket.date.toDateString(),
                    ),
                  )
                }
                disabled={bucket.billCount === 0}
                className="w-full py-1.5 text-left disabled:opacity-50 rounded focus-ring"
              >
                <div className="flex justify-between text-sm mb-1">
                  <span>{formatDate(bucket.date.toISOString(), lang)}</span>
                  <Money paise={bucket.totalPaise} className="font-medium" />
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-light-line dark:bg-white/10">
                  <div
                    className="h-full bg-brand-primary rounded-full transition-[width] duration-300"
                    style={{ width: `${(bucket.totalPaise / maxDay) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </Section>

          <Section title={t('reports.topItems')}>
            {top.map((item) => (
              <div key={item.productId} className="flex justify-between py-1.5 text-sm gap-3">
                <span className="truncate">
                  {lang === 'ta' && item.nameTa.trim() ? item.nameTa : item.nameEn}
                </span>
                <Money paise={item.revenuePaise} className="font-medium flex-shrink-0" />
              </div>
            ))}
          </Section>
        </>
      )}

      <Sheet open={drill !== null} onClose={() => setDrill(null)} title={t('reports.drillTitle')}>
        <div className="space-y-2">
          {(drill ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 py-2 border-b border-light-line dark:border-dark-line last:border-0"
            >
              <div className="min-w-0">
                <p className="font-medium count">{s.billNo}</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  {formatDateTime(s.createdAt, lang)} · {s.lines.length} {t('billing.items')}
                </p>
              </div>
              <Money paise={s.totalPaise} className="font-bold flex-shrink-0" />
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
};

/**
 * A stat card that answers "how much" and "compared to what" in one glance.
 * Tapping it opens the bills behind the figure, so the number is never a
 * dead end.
 */
const Stat: React.FC<{
  label: string;
  paise?: number;
  count?: number;
  change: number | null;
  days: number;
  spark?: number[];
  onClick?: () => void;
}> = ({ label, paise, count, change, days, spark, onClick }) => {
  const { t } = useT();
  const positive = change !== null && change >= 0;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
        {onClick && (
          <IconChevronRight className="w-4 h-4 flex-shrink-0 text-light-text-secondary dark:text-dark-text-secondary" />
        )}
      </div>
      {paise !== undefined ? (
        <Money paise={paise} className="block text-xl font-bold mt-0.5" />
      ) : (
        <p className="text-xl font-bold count mt-0.5">{count}</p>
      )}
      <div className="flex items-end justify-between gap-2 mt-1">
        <p
          className={`text-[11px] count leading-tight ${
            change === null
              ? 'text-light-text-secondary dark:text-dark-text-secondary'
              : positive
                ? 'text-brand-secondary dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
          }`}
        >
          {change === null ? (
            t('reports.noBaseline')
          ) : (
            <>
              {positive ? '▲' : '▼'} {Math.abs(Math.round(change))}%{' '}
              <span className="text-light-text-secondary dark:text-dark-text-secondary">
                {t('reports.vsPrevious', { days })}
              </span>
            </>
          )}
        </p>
        {spark && spark.some((v) => v > 0) && (
          <Sparkline
            values={spark}
            className="flex-shrink-0 text-brand-primary dark:text-brand-on-dark"
          />
        )}
      </div>
    </>
  );

  if (!onClick) return <Card className="p-3">{body}</Card>;
  return (
    <Card className="p-0">
      <button onClick={onClick} className="w-full text-left p-3 rounded-2xl focus-ring">
        {body}
      </button>
    </Card>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card className="p-3">
    <h2 className="font-semibold mb-2">{title}</h2>
    {children}
  </Card>
);
