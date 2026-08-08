import React from 'react';
import { Button, Sheet } from '@/components/ui';
import { formatAmount, formatINR, formatQty } from '@/domain/money';
import { useSettings } from '@/hooks/useSettings';
import { unitLabel, useT } from '@/i18n/useT';
import type { Sale } from '@/domain/types';

/**
 * Post-sale receipt.
 *
 * Phase 1 scope: confirm the sale landed and allow a print. The full bill
 * model with four renderers, WhatsApp text/image and the UPI QR is Phase 2
 * (docs/04-bill-print-whatsapp.md) — this uses the same `.bill-print`
 * stylesheet so the paper output is already 58mm rather than A4.
 */
export const ReceiptSheet: React.FC<{ sale: Sale | null; onClose: () => void }> = ({
  sale,
  onClose,
}) => {
  const { t, lang } = useT();
  const settings = useSettings();
  if (!sale) return null;

  const shopName =
    lang === 'ta' && settings.shop.nameTa.trim() ? settings.shop.nameTa : settings.shop.nameEn;

  return (
    <Sheet open onClose={onClose} title={t('bill.title')}>
      <div
        className="bill-print font-mono text-sm bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
        style={{ ['--bill-width' as string]: `${settings.printer.widthMm}mm` }}
      >
        <div className="text-center">
          <p className="font-bold text-base">{shopName}</p>
          {settings.shop.addressLines.map((line, i) => (
            <p key={i} className="text-xs">
              {line}
            </p>
          ))}
          {settings.shop.phone && <p className="text-xs">{settings.shop.phone}</p>}
          {settings.gst.enabled && settings.gst.gstin && (
            <p className="text-xs">GSTIN: {settings.gst.gstin}</p>
          )}
        </div>

        <div className="my-2 border-t border-dashed border-slate-400" />

        <p className="text-xs">
          {t('bill.no')}: {sale.billNo}
        </p>
        <p className="text-xs">{new Date(sale.createdAt).toLocaleString()}</p>

        <div className="my-2 border-t border-dashed border-slate-400" />

        {sale.lines.map((line, i) => {
          const name = lang === 'ta' && line.nameTa.trim() ? line.nameTa : line.nameEn;
          return (
            <div key={i} className="mb-1">
              <p className="leading-tight">{name}</p>
              <div className="flex justify-between text-xs tnum">
                <span>
                  {formatQty(line.qty)} {unitLabel(line.unit, lang)} × {formatAmount(line.unitPricePaise)}
                </span>
                <span>{formatAmount(line.lineTotalPaise)}</span>
              </div>
            </div>
          );
        })}

        <div className="my-2 border-t border-dashed border-slate-400" />

        <Row label={t('billing.subtotal')} value={formatAmount(sale.subtotalPaise)} />
        {sale.billDiscountPaise > 0 && (
          <Row label={t('billing.discount')} value={`-${formatAmount(sale.billDiscountPaise)}`} />
        )}
        {sale.taxPaise > 0 && <Row label={t('billing.tax')} value={formatAmount(sale.taxPaise)} />}
        {sale.roundOffPaise !== 0 && (
          <Row
            label={t('billing.roundOff')}
            value={`${sale.roundOffPaise > 0 ? '+' : '-'}${formatAmount(Math.abs(sale.roundOffPaise))}`}
          />
        )}

        <div className="flex justify-between font-bold text-base mt-1 tnum">
          <span>{t('billing.total')}</span>
          <span>{formatAmount(sale.totalPaise)}</span>
        </div>

        <div className="my-2 border-t border-dashed border-slate-400" />

        {sale.payments.map((p, i) => (
          <Row key={i} label={t(`pay.${p.mode}` as 'pay.cash')} value={formatAmount(p.amountPaise)} />
        ))}
        {sale.creditPaise > 0 && (
          <Row label={t('pay.credit')} value={formatAmount(sale.creditPaise)} />
        )}

        <p className="text-center text-xs mt-3">
          {lang === 'ta' ? settings.billing.footerLineTa : settings.billing.footerLineEn}
        </p>
      </div>

      <div className="mt-4 flex gap-3 no-print">
        <Button variant="ghost" className="flex-1" onClick={() => window.print()}>
          {t('bill.print')}
        </Button>
        <Button className="flex-1" onClick={onClose}>
          {t('bill.newSale')}
        </Button>
      </div>
      <p className="mt-3 text-xs text-center text-light-text-secondary dark:text-dark-text-secondary no-print tnum">
        {t('billing.total')} {formatINR(sale.totalPaise)} · {sale.billNo}
      </p>
    </Sheet>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-xs tnum">
    <span>{label}</span>
    <span>{value}</span>
  </div>
);
