import React, { useEffect, useState } from 'react';
import { Banner, Button, Field, Input, Select, Sheet, Toggle } from '@/components/ui';
import { parseRupeeInput } from '@/domain/money';
import { createProduct } from '@/data/repositories/productRepo';
import { unitLabel, useT } from '@/i18n/useT';
import type { Product, Unit } from '@/domain/types';

const UNITS: Unit[] = ['piece', 'packet', 'kg', 'g', 'litre', 'ml'];

/**
 * Learn-as-you-scan (D4).
 *
 * There is no free, complete database mapping Indian EANs to products, so the
 * shop builds its own catalogue during normal billing: the first scan of an
 * unknown code opens this prefilled sheet, and every scan after that goes
 * straight into the cart.
 */
export const NewProductSheet: React.FC<{
  barcode: string | null;
  onClose: () => void;
  onCreated: (product: Product) => void;
  /** Shown when the scanned payload looks like a marketing QR, not a barcode. */
  warning?: string | undefined;
}> = ({ barcode, onClose, onCreated, warning }) => {
  const { t, lang } = useT();
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<Unit>('piece');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [trackStock, setTrackStock] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (barcode) {
      setNameEn('');
      setNameTa('');
      setPrice('');
      setUnit('piece');
      setCategory('');
      setStock('');
      setTrackStock(true);
    }
  }, [barcode]);

  const save = async () => {
    const pricePaise = parseRupeeInput(price);
    if (!nameEn.trim() || pricePaise === null || !barcode) return;
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

  return (
    <Sheet open={barcode !== null} onClose={onClose} title={t('inv.newFromScan')} persistent>
      <div className="space-y-3">
        {/* The warning replaces the normal hint: adding a product keyed to a
            campaign URL would look like it worked and then never match again. */}
        {warning ? (
          <Banner tone="danger">{warning}</Banner>
        ) : (
          <Banner tone="info">{t('inv.newFromScanHint')}</Banner>
        )}

        <Field label={t('inv.barcode')}>
          <Input
            value={barcode ?? ''}
            readOnly
            className={warning ? 'opacity-70 text-xs break-all' : 'tnum opacity-70'}
          />
        </Field>

        <Field label={t('inv.name')}>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} autoFocus />
        </Field>
        <Field label={t('inv.nameTa')}>
          <Input value={nameTa} onChange={(e) => setNameTa(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('inv.price')}>
            <Input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
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
          <Field label={t('inv.stock')}>
            <Input
              inputMode="decimal"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              disabled={!trackStock}
            />
          </Field>
        </div>

        <Toggle checked={trackStock} onChange={setTrackStock} label={t('inv.trackStock')} />

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            full
            onClick={save}
            disabled={saving || !nameEn.trim() || parseRupeeInput(price) === null}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
