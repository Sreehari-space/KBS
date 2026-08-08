import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Bill } from '@/domain/bill';

/**
 * 58mm bill, on screen and on paper.
 *
 * Uses the `.bill-print` stylesheet in styles/index.css, so `window.print()`
 * produces receipt-width output. This replaces the old handlePrint, which
 * opened a popup (frequently blocked on phones) and document.write'd an
 * A4-styled page that wasted most of a sheet.
 */
export const BillPreview: React.FC<{ bill: Bill; widthMm: 58 | 80 }> = ({ bill, widthMm }) => {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!bill.upiQrPayload) {
      setQr(null);
      return;
    }
    // Generated locally — the old code fetched from api.qrserver.com, which
    // fails offline, exactly when the shop still needs to take payment.
    void QRCode.toDataURL(bill.upiQrPayload, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [bill.upiQrPayload]);

  return (
    <div
      className="bill-print bg-white text-black rounded-md p-3 mx-auto border border-slate-300 shadow-sm"
      style={{
        ['--bill-width' as string]: `${widthMm}mm`,
        width: widthMm === 80 ? 300 : 240,
        fontFamily: '"Noto Sans Tamil", monospace',
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      <div className="text-center">
        <div className="font-bold text-base leading-tight">{bill.header.shopName}</div>
        {bill.header.addressLines.map((line, i) => (
          <div key={i} className="text-[10px]">
            {line}
          </div>
        ))}
        {bill.header.phone && <div className="text-[10px]">{bill.header.phone}</div>}
        {bill.header.gstin && <div className="text-[10px]">GSTIN: {bill.header.gstin}</div>}
      </div>

      <Dashed />

      <div className="text-[10px]">
        <div>{bill.meta.billNo}</div>
        <div>{bill.meta.dateTime}</div>
        {bill.meta.customerName && (
          <div>
            {bill.meta.customerName} {bill.meta.customerPhone}
          </div>
        )}
      </div>

      <Dashed />

      {bill.lines.map((line, i) => (
        <div key={i} className="mb-0.5">
          <div className="leading-tight">{line.name}</div>
          <div className="flex justify-between text-[11px] tnum">
            <span className="pl-2">{line.qtyLabel}</span>
            <span>{line.amountLabel}</span>
          </div>
        </div>
      ))}

      <Dashed />

      {bill.totals.map((row, i) => (
        <div
          key={i}
          className={`flex justify-between tnum ${
            row.emphasis ? 'font-bold text-base border-t border-black mt-1 pt-1' : 'text-[11px]'
          }`}
        >
          <span>{row.label}</span>
          <span>{row.value}</span>
        </div>
      ))}

      {bill.payments.length > 0 && (
        <>
          <Dashed />
          {bill.payments.map((row, i) => (
            <div key={i} className="flex justify-between text-[11px] tnum">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
        </>
      )}

      {/* Customers notice this, and it costs nothing. */}
      {bill.savings && (
        <div className="text-center font-semibold text-[11px] mt-1">{bill.savings}</div>
      )}

      {bill.credit && (
        <>
          <Dashed />
          <div className="text-[11px] tnum">
            <div>{bill.credit.previousBalance}</div>
            <div>{bill.credit.thisBill}</div>
            <div className="font-bold">{bill.credit.newBalance}</div>
          </div>
        </>
      )}

      {qr && (
        <>
          <Dashed />
          <img src={qr} alt="UPI QR" className="mx-auto w-28 h-28" />
        </>
      )}

      <Dashed />
      {bill.footerLines.map((line, i) => (
        <div key={i} className="text-center text-[11px]">
          {line}
        </div>
      ))}
    </div>
  );
};

const Dashed: React.FC = () => (
  <div className="my-1.5 border-t border-dashed border-black/60" />
);
