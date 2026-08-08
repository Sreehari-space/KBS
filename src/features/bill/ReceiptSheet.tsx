import React, { useEffect, useMemo, useState } from 'react';
import { Banner, Button, Sheet } from '@/components/ui';
import { IconPrint, IconShare, IconWhatsApp } from '@/components/icons';
import { BillPreview } from './BillPreview';
import { billToText, whatsAppLink, whatsAppShareLink } from './billToText';
import { billToCanvas, shareBillImage } from './billToCanvas';
import { printViaBluetooth, isBluetoothPrintingAvailable } from './escpos';
import { buildBill } from '@/domain/bill';
import { getCustomer } from '@/data/repositories/customerRepo';
import { toWhatsAppNumber } from '@/data/repositories/customerRepo';
import { useSettings } from '@/hooks/useSettings';
import { useT } from '@/i18n/useT';
import type { Customer, Sale } from '@/domain/types';

/**
 * Post-sale bill: preview, print, and send.
 *
 * All four outputs come from the same Bill model (docs/04), so the printed
 * paper, the WhatsApp text and the WhatsApp image always agree.
 */
export const ReceiptSheet: React.FC<{ sale: Sale | null; onClose: () => void }> = ({
  sale,
  onClose,
}) => {
  const { t, lang } = useT();
  const settings = useSettings();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setNote(null);
    if (!sale?.customerId) {
      setCustomer(null);
      return;
    }
    void getCustomer(sale.customerId).then((c) => setCustomer(c ?? null));
  }, [sale]);

  const bill = useMemo(() => {
    if (!sale) return null;
    return buildBill(sale, settings, {
      lang,
      customer: customer
        ? { name: customer.name, phone: customer.phone, balancePaise: customer.balancePaise }
        : undefined,
    });
  }, [sale, settings, lang, customer]);

  if (!sale || !bill) return null;

  const sendText = () => {
    const text = billToText(bill);
    const url = customer?.phone
      ? whatsAppLink(toWhatsAppNumber(customer.phone), text)
      : whatsAppShareLink(text);
    window.open(url, '_blank');
  };

  const sendImage = async () => {
    setBusy('image');
    try {
      const blob = await billToCanvas(bill, { widthMm: settings.printer.widthMm });
      await shareBillImage(bill, blob);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const print = async () => {
    if (settings.printer.mode === 'bluetooth' && isBluetoothPrintingAvailable()) {
      setBusy('print');
      try {
        await printViaBluetooth(bill, settings.printer.widthMm, settings.printer.copies);
      } catch (err) {
        // Browser printing always remains available as the fallback.
        setNote(`${(err as Error).message} — ${t('bill.print')}`);
        window.print();
      } finally {
        setBusy(null);
      }
      return;
    }
    window.print();
  };

  return (
    <Sheet open onClose={onClose} title={t('bill.title')}>
      {note && (
        <div className="mb-3 no-print">
          <Banner tone="warning" onDismiss={() => setNote(null)}>
            {note}
          </Banner>
        </div>
      )}

      <BillPreview bill={bill} widthMm={settings.printer.widthMm} />

      <div className="mt-4 space-y-2 no-print">
        {/* Delivery options are peers; "New sale" is the one action that
            clears the counter, so it alone gets the primary weight. */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="ghost"
            onClick={() => void print()}
            disabled={busy === 'print'}
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-xs"
          >
            <IconPrint className="w-5 h-5" />
            {t('bill.print')}
          </Button>
          <Button
            variant="ghost"
            onClick={sendText}
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-xs"
          >
            <IconWhatsApp className="w-5 h-5" />
            {t('bill.whatsapp')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void sendImage()}
            disabled={busy === 'image'}
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-xs"
          >
            <IconShare className="w-5 h-5" />
            {busy === 'image' ? '…' : t('bill.share')}
          </Button>
        </div>
        <Button full onClick={onClose}>
          {t('bill.newSale')}
        </Button>
      </div>
    </Sheet>
  );
};
