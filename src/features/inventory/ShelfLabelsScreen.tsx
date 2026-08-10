import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banner, Button, Checkbox, EmptyState, SkeletonRows } from '@/components/ui';
import { IconLabels } from '@/components/icons';
import { buildProductQrPayload } from '@/domain/barcode';
import { formatINR } from '@/domain/money';
import { listProducts } from '@/data/repositories/productRepo';
import { productName, unitLabel, useT } from '@/i18n/useT';


/**
 * Shop-printed QR labels for loose goods (docs/03).
 *
 * Rice, dal, homemade sweets and local produce carry no manufacturer barcode.
 * These labels encode `kbs:p:<productId>`, so once stuck on a bin they scan
 * exactly like a packaged item — this is where QR genuinely earns its place.
 */
export const ShelfLabelsScreen: React.FC = () => {
  const { t, lang } = useT();
  const products = useLiveQuery(() => listProducts(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [codes, setCodes] = useState<Map<string, string>>(new Map());

  // Products with no barcode are exactly the ones that need a label.
  const candidates = (products ?? []).filter((p) => p.barcodes.length === 0);

  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      const next = new Map<string, string>();
      for (const id of selected) {
        next.set(id, await QRCode.toDataURL(buildProductQrPayload(id), { margin: 0, width: 160 }));
      }
      if (!cancelled) setCodes(next);
    };
    void build();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = candidates.filter((p) => selected.has(p.id));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="no-print">
          <Banner tone="info">{t('labels.hint')}</Banner>
        </div>

        <div className="no-print space-y-2" aria-busy={products === undefined}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">{t('labels.select')}</h2>
            {selected.size > 0 && (
              <span className="text-sm count text-light-text-secondary dark:text-dark-text-secondary">
                {t('labels.selected', { n: selected.size })}
              </span>
            )}
          </div>
          {products === undefined ? (
            <SkeletonRows rows={4} />
          ) : candidates.length === 0 ? (
            <EmptyState
              title={t('labels.empty')}
              hint={t('labels.emptyHint')}
              icon={<IconLabels className="w-10 h-10" />}
            />
          ) : (
            candidates.map((p) => (
              // The tinted background alone never said these rows were
              // tickable, which is a strange thing to leave next to a button
              // that counts the ticks. A box that fills is unambiguous.
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                role="checkbox"
                aria-checked={selected.has(p.id)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors focus-ring ${
                  selected.has(p.id)
                    ? 'border-brand-primary bg-brand-primary/10'
                    : 'border-slate-200 dark:border-slate-700 bg-light-surface dark:bg-dark-surface hover:border-brand-primary'
                }`}
              >
                <Checkbox checked={selected.has(p.id)} />
                <span className="flex-1 truncate font-medium">{productName(p, lang)}</span>
                <span className="money text-sm">{formatINR(p.sellPricePaise)}</span>
              </button>
            ))
          )}
        </div>

        {/* The printable sheet. `.bill-print` is reused so only this prints. */}
        {chosen.length > 0 && (
          <div className="bill-print bg-white text-black p-3" style={{ ['--bill-width' as string]: 'auto' }}>
            <div className="grid grid-cols-2 gap-3">
              {chosen.map((p) => (
                <div key={p.id} className="border border-black/40 rounded p-2 text-center break-inside-avoid">
                  {codes.get(p.id) && (
                    <img src={codes.get(p.id)} alt="" className="w-20 h-20 mx-auto" />
                  )}
                  <p className="text-xs font-bold leading-tight mt-1">{productName(p, lang)}</p>
                  <p className="text-xs tnum">
                    {formatINR(p.sellPricePaise)}/{unitLabel(p.unit, lang)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 pb-safe border-t border-slate-200 dark:border-slate-700 no-print">
        <Button full onClick={() => window.print()} disabled={chosen.length === 0}>
          {t('labels.print')} ({chosen.length})
        </Button>
      </div>
    </div>
  );
};
