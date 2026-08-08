import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, EmptyState } from '@/components/ui';
import { IconReports } from '@/components/icons';
import { formatDate } from '@/domain/datetime';
import { formatINR } from '@/domain/money';
import { db } from '@/data/db';
import { useT } from '@/i18n/useT';
import type { Sale } from '@/domain/types';

/**
 * Reports built from REAL sales.
 *
 * The previous version rendered hardcoded arrays (`salesByDay`, `topProducts`)
 * that never touched the database, and fired two Gemini calls on mount — so
 * the screen was broken with no internet. Nothing here needs a network.
 */
export const ReportsScreen: React.FC = () => {
  const { t, lang } = useT();
  const [days, setDays] = useState(7);

  const sales = useLiveQuery(async () => {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    return db.sales.where('createdAt').aboveOrEqual(from.toISOString()).toArray();
  }, [days], [] as Sale[]);

  const stats = useMemo(() => {
    const all = sales ?? [];
    const revenue = all.reduce((sum, s) => sum + s.totalPaise, 0);
    const credit = all.reduce((sum, s) => sum + s.creditPaise, 0);

    const byMode = new Map<string, number>();
    for (const sale of all) {
      for (const p of sale.payments) {
        byMode.set(p.mode, (byMode.get(p.mode) ?? 0) + p.amountPaise);
      }
    }

    const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const sale of all) {
      for (const line of sale.lines) {
        const name = lang === 'ta' && line.nameTa.trim() ? line.nameTa : line.nameEn;
        const cur = byProduct.get(line.productId) ?? { name, qty: 0, revenue: 0 };
        cur.qty += line.qty;
        cur.revenue += line.lineTotalPaise;
        byProduct.set(line.productId, cur);
      }
    }

    const byDay = new Map<string, number>();
    for (const sale of all) {
      const key = formatDate(sale.createdAt, lang);
      byDay.set(key, (byDay.get(key) ?? 0) + sale.totalPaise);
    }

    return {
      billCount: all.length,
      revenue,
      credit,
      average: all.length ? Math.round(revenue / all.length) : 0,
      byMode: [...byMode.entries()].sort((a, b) => b[1] - a[1]),
      topProducts: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      byDay: [...byDay.entries()].reverse(),
    };
  }, [sales, lang]);

  const maxDay = Math.max(1, ...stats.byDay.map(([, v]) => v));

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <div className="flex gap-2">
        {[7, 15, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${
              days === d
                ? 'bg-brand-primary border-brand-primary text-white'
                : 'bg-light-surface dark:bg-dark-surface border-slate-300 dark:border-slate-600 hover:border-brand-primary'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {stats.billCount === 0 ? (
        <EmptyState
          title={t('reports.empty')}
          hint={t('reports.emptyHint')}
          icon={<IconReports className="w-10 h-10" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('reports.revenue')} value={formatINR(stats.revenue)} />
            <Stat label={t('reports.bills')} value={String(stats.billCount)} />
            <Stat label={t('reports.avgBill')} value={formatINR(stats.average)} />
            <Stat label={t('reports.creditGiven')} value={formatINR(stats.credit)} />
          </div>

          <Section title={t('reports.byMode')}>
            {stats.byMode.map(([mode, amount]) => (
              <div key={mode} className="flex justify-between py-1.5 text-sm">
                <span>{t(`pay.${mode}` as 'pay.cash')}</span>
                <span className="tnum font-medium">{formatINR(amount)}</span>
              </div>
            ))}
          </Section>

          <Section title={t('reports.daily')}>
            {stats.byDay.map(([day, amount]) => (
              <div key={day} className="py-1.5">
                <div className="flex justify-between text-sm mb-1">
                  <span>{day}</span>
                  <span className="tnum font-medium">{formatINR(amount)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-brand-primary rounded-full"
                    style={{ width: `${(amount / maxDay) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </Section>

          <Section title={t('reports.topItems')}>
            {stats.topProducts.map((p) => (
              <div key={p.name} className="flex justify-between py-1.5 text-sm gap-3">
                <span className="truncate">{p.name}</span>
                <span className="tnum font-medium flex-shrink-0">{formatINR(p.revenue)}</span>
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Card className="p-3">
    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
    <p className="text-xl font-bold tnum mt-0.5">{value}</p>
  </Card>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card className="p-3">
    <h2 className="font-semibold mb-2">{title}</h2>
    {children}
  </Card>
);
