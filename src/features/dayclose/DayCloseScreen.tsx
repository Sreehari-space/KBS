import React, { useEffect, useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { IconCheck, IconWhatsApp } from '@/components/icons';
import { buildDayClose, dayCloseText, type DayCloseSummary } from './dayClose';
import { exportBackup } from '@/features/backup/backupService';
import { formatINR, parseRupeeInput } from '@/domain/money';
import { useSettings } from '@/hooks/useSettings';
import { useT } from '@/i18n/useT';

export const DayCloseScreen: React.FC = () => {
  const { t, lang } = useT();
  const settings = useSettings();
  const [summary, setSummary] = useState<DayCloseSummary | null>(null);
  const [counted, setCounted] = useState('');
  const [backupDone, setBackupDone] = useState(false);

  useEffect(() => {
    void buildDayClose().then(setSummary);
  }, []);

  if (!summary) return null;

  const countedPaise = parseRupeeInput(counted);
  const difference = countedPaise === null ? null : countedPaise - summary.expectedCashPaise;
  const shopName =
    lang === 'ta' && settings.shop.nameTa ? settings.shop.nameTa : settings.shop.nameEn;

  const send = () => {
    const text = dayCloseText(summary, shopName, countedPaise, {
      title: t('day.title'),
      sales: t('day.sales'),
      bills: t('day.bills'),
      cash: t('pay.cash'),
      upi: t('pay.upi'),
      card: t('pay.card'),
      credit: t('day.creditGiven'),
      collected: t('day.creditCollected'),
      expected: t('day.expectedCash'),
      counted: t('day.countedCash'),
      difference: t('day.difference'),
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <div className="rounded-xl bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="font-semibold mb-3">
          {t('day.title')} — {summary.date.toLocaleDateString()}
        </h2>
        <Row label={t('day.bills')} value={String(summary.billCount)} />
        <Row label={t('day.sales')} value={formatINR(summary.salesTotalPaise)} bold />
      </div>

      <div className="rounded-xl bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 p-4">
        <Row label={t('pay.cash')} value={formatINR(summary.byMode.cash)} />
        <Row label={t('pay.upi')} value={formatINR(summary.byMode.upi)} />
        <Row label={t('pay.card')} value={formatINR(summary.byMode.card)} />
        <Row label={t('day.creditGiven')} value={formatINR(summary.creditGivenPaise)} />
        <Row label={t('day.creditCollected')} value={formatINR(summary.creditCollectedPaise)} />
      </div>

      <div className="rounded-xl bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        {/* Expected cash is takings PLUS cash collected against old credit —
            not just the day's sales. */}
        <Row label={t('day.expectedCash')} value={formatINR(summary.expectedCashPaise)} bold />
        <Field label={t('day.countedCash')}>
          <Input
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0"
            className="text-lg tnum"
          />
        </Field>
        {difference !== null && (
          <div
            className={`flex justify-between font-bold tnum text-lg ${
              difference === 0
                ? 'text-brand-secondary'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            <span>{t('day.difference')}</span>
            <span>
              {difference < 0 ? '−' : '+'}
              {formatINR(Math.abs(difference))}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Button
          full
          variant="secondary"
          onClick={send}
          className="flex items-center justify-center gap-2"
        >
          <IconWhatsApp className="w-5 h-5" />
          {t('day.sendSummary')}
        </Button>
        {/* Backup rides on a ritual the owner already performs daily, rather
            than a reminder they will dismiss (doc 07). */}
        <Button
          full
          onClick={async () => {
            await exportBackup();
            setBackupDone(true);
          }}
        >
          <span className="flex items-center justify-center gap-2">
            {backupDone && <IconCheck className="w-5 h-5" />}
            {backupDone ? t('backup.exported') : t('backup.backupNow')}
          </span>
        </Button>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; bold?: boolean }> = ({
  label,
  value,
  bold,
}) => (
  <div className={`flex justify-between py-1 ${bold ? 'font-bold text-lg' : 'text-sm'}`}>
    <span className={bold ? '' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
      {label}
    </span>
    <span className="tnum">{value}</span>
  </div>
);
