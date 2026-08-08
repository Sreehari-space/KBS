import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banner, Button, Field, Input, Select, Sheet, Toggle } from '@/components/ui';
import { formatINR, parseRupeeInput } from '@/domain/money';
import {
  addBarcodeToProduct,
  createProduct,
  listProducts,
} from '@/data/repositories/productRepo';
import { useNameSuggestion } from '@/hooks/useNameSuggestion';
import { productName, unitLabel, useT } from '@/i18n/useT';
import type { Product, Unit } from '@/domain/types';

const UNITS: Unit[] = ['piece', 'packet', 'kg', 'g', 'litre', 'ml'];

/**
 * Learn-as-you-scan (D4), reached from an unknown barcode at the counter.
 *
 * Two things this screen has to respect, both learned from real use:
 *
 * 1. **Only name and price are required.** A shopkeeper doing this mid-bill
 *    with a customer waiting will not fill in six fields. Everything else is
 *    behind "More details" with a working default.
 * 2. **Stock tracking defaults OFF here.** Saving with tracking on and no
 *    quantity created a product that was instantly "out of stock" — greyed out
 *    and untappable in the billing grid. Someone adding an item they are
 *    holding wants to sell it, not do inventory.
 *
 * There is also a "Already have it" tab: if the item is already in the
 * catalogue (added by hand, or under a different barcode), this attaches the
 * scanned code to it instead of creating a duplicate.
 */
export const NewProductSheet: React.FC<{
  barcode: string | null;
  onClose: () => void;
  onCreated: (product: Product) => void;
  warning?: string | undefined;
}> = ({ barcode, onClose, onCreated, warning }) => {
  const { t, lang } = useT();
  const [mode, setMode] = useState<'new' | 'link'>('new');

  // English and Tamil names stay in step as the shopkeeper types, including
  // when they type Tanglish.
  const { fields, setEnglish, setTamil, reset } = useNameSuggestion();
  const { nameEn, nameTa, suggestion } = fields;
  const [price, setPrice] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [unit, setUnit] = useState<Unit>('piece');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [trackStock, setTrackStock] = useState(false);
  const [saving, setSaving] = useState(false);

  const [linkSearch, setLinkSearch] = useState('');
  const products = useLiveQuery(() => listProducts(), [], [] as Product[]);

  useEffect(() => {
    if (!barcode) return;
    setMode('new');
    reset();
    setPrice('');
    setShowMore(false);
    setUnit('piece');
    setCategory('');
    setStock('');
    setTrackStock(false);
    setLinkSearch('');
  }, [barcode, reset]);

  const linkMatches = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    const all = products ?? [];
    if (!q) return all.slice(0, 8);
    return all
      .filter(
        (p) => p.nameEn.toLowerCase().includes(q) || p.nameTa.includes(linkSearch.trim()),
      )
      .slice(0, 8);
  }, [products, linkSearch]);

  const pricePaise = parseRupeeInput(price);
  const canSave = Boolean(nameEn.trim()) && pricePaise !== null && !saving;

  const saveNew = async () => {
    if (!canSave || !barcode || pricePaise === null) return;
    setSaving(true);
    try {
      const product = await createProduct({
        nameEn: nameEn.trim(),
        nameTa: nameTa.trim(),
        barcodes: [barcode],
        category: category.trim() || 'General',
        unit,
        sellPricePaise: pricePaise,
        stockQty: Number(stock) || 0,
        lowStockThreshold: 0,
        trackStock,
        isQuickTile: false,
      });
      onCreated(product);
    } finally {
      setSaving(false);
    }
  };

  const link = async (product: Product) => {
    if (!barcode) return;
    setSaving(true);
    try {
      await addBarcodeToProduct(product.id, barcode);
      onCreated(product);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={barcode !== null} onClose={onClose} title={t('inv.newFromScan')} persistent>
      <div className="space-y-4">
        {warning ? (
          <Banner tone="danger">{warning}</Banner>
        ) : (
          <Banner tone="info">{t('inv.newFromScanHint')}</Banner>
        )}

        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary break-all">
          {barcode}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {(['new', 'link'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2.5 rounded-lg border-2 text-sm font-semibold ${
                mode === m
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {m === 'new' ? t('inv.createNew') : t('inv.linkExisting')}
            </button>
          ))}
        </div>

        {mode === 'new' ? (
          <>
            {/* The only two fields that matter at the counter. */}
            <Field label={t('inv.name')}>
              <Input
                value={nameEn}
                onChange={(e) => setEnglish(e.target.value)}
                autoFocus
                className="text-lg"
              />
            </Field>

            {/* The Tamil name appears only once there is something to show,
                so an empty form stays down to two fields. */}
            {(nameTa || fields.tamilEdited) && (
              <Field
                label={t('inv.nameTa')}
                hint={
                  suggestion && suggestion.confidence === 'low'
                    ? t('inv.autoTamilCheck')
                    : t('inv.autoTamil')
                }
              >
                <Input
                  value={nameTa}
                  onChange={(e) => setTamil(e.target.value)}
                  className={
                    suggestion && suggestion.confidence === 'low'
                      ? 'border-amber-400 dark:border-amber-600'
                      : ''
                  }
                />
              </Field>
            )}
            <Field label={t('inv.price')}>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="text-lg tnum"
              />
            </Field>

            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              className="w-full text-left text-sm font-medium text-brand-primary py-1"
            >
              {showMore ? '▾' : '▸'} {t('inv.moreDetails')}
            </button>

            {showMore && (
              <div className="space-y-3 pl-1 border-l-2 border-slate-200 dark:border-slate-700">
                <div className="pl-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('inv.unit')}>
                      <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {unitLabel(u, lang)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('inv.category')}>
                      <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                    </Field>
                  </div>
                  <Toggle
                    checked={trackStock}
                    onChange={setTrackStock}
                    label={t('inv.trackStock')}
                  />
                  {trackStock && (
                    <Field label={t('inv.stock')}>
                      <Input
                        inputMode="decimal"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" full onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button full onClick={saveNew} disabled={!canSave}>
                {t('common.save')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {t('inv.linkHint')}
            </p>
            <Input
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              placeholder={t('inv.linkSearch')}
              autoFocus
            />
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {linkMatches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => void link(p)}
                  disabled={saving}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 text-left"
                >
                  <span className="truncate font-medium">{productName(p, lang)}</span>
                  <span className="tnum text-sm flex-shrink-0">
                    {formatINR(p.sellPricePaise)}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="ghost" full onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
};
