# 04 — Bill, Print & WhatsApp

## One model, four renderers (D5)

The bill must look identical whether it's printed, WhatsApped as text, WhatsApped as an image,
or sent to a Bluetooth printer. So layout is decided **once**, in a pure function, and each
renderer only formats an already-decided structure.

```
                  ┌──────────────────┐
   Sale + Settings│  domain/bill.ts  │
   ───────────────▶   buildBill()    │
                  └────────┬─────────┘
                           │ Bill  (pure data, no JSX, no strings-with-layout)
        ┌──────────────┬───┴────────┬──────────────┐
        ▼              ▼            ▼              ▼
  BillPreview     billToText   billToCanvas   billToEscPos
   (58mm HTML)     (WhatsApp)   (PNG image)    (Bluetooth)
   screen+print       text       WhatsApp       Phase 4
```

```ts
export interface Bill {
  header: { shopName: string; addressLines: string[]; phone: string; gstin?: string };
  meta:   { billNo: string; dateTime: string; customerName?: string; customerPhone?: string };
  lines:  { name: string; qtyLabel: string; rateLabel: string; amountLabel: string }[];
  totals: { label: string; value: string; emphasis?: boolean }[];
  payments: { label: string; value: string }[];
  credit?: { previousBalance: string; thisBill: string; newBalance: string };
  savings?: string;
  upiQrPayload?: string;
  footerLines: string[];
}
```

`buildBill` also handles language: when `settings.ui.language === 'ta'` it picks `nameTa`
(falling back to `nameEn` when the Tamil name is empty) so a Tamil bill never has blank rows.

## Bill layout (58mm thermal)

58mm paper is ~32 monospace characters wide. That constraint drives everything.

```
      கே.பி.எஸ். ஸ்டோர்ஸ்
        KBS STORES
   12, பெரிய கடை வீதி, மதுரை
        📞 98765 43210
   GSTIN: 33XXXXXXXXXXXZX          ← only when GST mode is on
--------------------------------
Bill: 080826-014
08/08/2026  1:50 PM
Customer: ராஜா  9876543210        ← only when a customer is attached
--------------------------------
பொருள்          அளவு    தொகை
--------------------------------
பொன்னி அரிசி
  5 kg x 58.00           290.00
தக்காளி
  2.5 kg x 40.00         100.00
Maggi 70g
  4 x 14.00               56.00
--------------------------------
              மொத்தம்    446.00
              தள்ளுபடி   -10.00
              ரவுண்ட்     -0.60
                        --------
              மொத்தம்    435.40   ← double height on thermal
--------------------------------
ரொக்கம் / Cash          300.00
UPI                     135.40
--------------------------------
நீங்கள் மிச்சம்: ₹10.00           ← savings line, only if a discount was given

        [ UPI QR CODE ]            ← only if printUpiQr
      Scan to pay ₹435.40

     நன்றி! மீண்டும் வருக
        Thank you! Visit again
--------------------------------
```

Rules the renderers share:

- Amounts **right-aligned** in a fixed column. Misaligned amounts are the single most common
  reason a printed bill looks amateur.
- Long item names wrap to a second line; qty × rate goes on the wrap line, indented.
- Grand total in double-height / bold — it's the number the customer looks at.
- **Round-off line always shown when non-zero.** Silent rounding causes arguments.
- **Savings line** when a discount was given. Customers notice it and it costs nothing.
- Bill number and date/time always present — needed for returns and for the shop's own records.

**Credit bills** get an extra block, because this is the number the customer needs:

```
--------------------------------
பழைய கடன்              1,250.00
இந்த பில்                435.40
                       ---------
மொத்த கடன்             1,685.40
--------------------------------
```

## Printing

### Path 1 — Browser print with a thermal stylesheet (Phase 2)

Works with any printer — USB thermal, Bluetooth via the OS, or a normal A4 printer.

```css
@media print {
  @page { size: 58mm auto; margin: 0; }
  body * { visibility: hidden; }
  .bill-print, .bill-print * { visibility: visible; }
  .bill-print {
    position: absolute; left: 0; top: 0;
    width: 58mm; padding: 2mm;
    font-family: 'Noto Sans Tamil', monospace;
    font-size: 9pt; line-height: 1.25; color: #000;
  }
}
```

This replaces the current `handlePrint` in `Sales.tsx:153`, which opens a popup window,
`document.write`s an A4-styled page, and produces a bill that wastes most of a sheet. It also
depends on a popup that phone browsers frequently block.

**80mm support** is the same stylesheet with a different `@page` width and column count,
switched by `settings.printer.widthMm`.

### Path 2 — Web Bluetooth + ESC/POS (Phase 4)

The ₹1,500–3,000 Bluetooth thermal printers TN shops actually buy speak ESC/POS. Talking to
them directly skips the print dialog entirely — tap "Print", paper comes out. That's the
difference between "a website" and "our billing machine".

```ts
navigator.bluetooth.requestDevice({ filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }] })
// then write ESC/POS byte sequences:
//   ESC @        initialise
//   ESC a 1      centre align
//   GS  ! 0x11   double width+height (for the total)
//   GS  V 0      full cut
```

**Tamil on thermal printers is the catch.** Most cheap ESC/POS printers have no Tamil font in
ROM. Solution: render the Tamil portion to a canvas and send it as an **ESC/POS raster image**
(`GS v 0`). Slower per bill but it prints correctly. Latin-only bills can use the fast text
path. This is exactly why `billToCanvas` is built in Phase 2 — Phase 4 reuses it.

Web Bluetooth is Android-Chrome only. iOS Safari has no support and won't. Path 1 remains the
universal fallback and is never removed.

## WhatsApp

Three tiers. **Ship A and B; C only if shops ask.**

### Tier A — `wa.me` text bill (Phase 2, zero cost)

```ts
const url = `https://wa.me/91${phone}?text=${encodeURIComponent(billToText(bill))}`;
window.open(url, '_blank');
```

Opens WhatsApp with the bill pre-typed; the shopkeeper taps send. Works on every device, needs
no account, no approval, no internet beyond WhatsApp's own.

Constraints that shape `billToText`:
- Wrap in a ``` code block ``` so the monospace columns survive WhatsApp's renderer
- Keep under ~4000 characters (long bills truncate the item list with a total-only summary)
- Tamil text passes through fine — WhatsApp handles Unicode correctly

### Tier B — bill as an image (Phase 2, zero cost)

Text bills are functional; image bills look like a real receipt and get forwarded to family.

```ts
const blob = await billToCanvas(bill);          // 384px wide = 58mm at 203 dpi
const file = new File([blob], `bill-${bill.meta.billNo}.png`, { type: 'image/png' });

if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({ files: [file], title: `Bill ${bill.meta.billNo}` });
} else {
  downloadBlob(blob);                            // desktop fallback
}
```

`navigator.share` opens the OS share sheet; the user picks WhatsApp (or Telegram, or email —
a free bonus). Supported on Android Chrome and iOS Safari 15+.

Rendering with a plain `<canvas>` — no `html2canvas`, no dom-to-image. Those libraries are
heavy, render Tamil unreliably, and we already have the `Bill` model in a form that's easy to
draw. 384px width matches thermal printer resolution, so the same canvas feeds Phase 4's
ESC/POS raster path.

### Tier C — WhatsApp Cloud API (Phase 4, only on demand)

Auto-sends with no user tap and gives delivery receipts. Requires: a Meta Business account,
business verification, a registered number, pre-approved message templates, a **server** to
hold the token, and per-message fees.

That contradicts the client-only decision and asks a single-shop owner to complete Meta
business verification. **Not recommended** unless a chain with many outlets asks for it.

### Where WhatsApp shows up elsewhere

Once `billToText` and Web Share exist, the same plumbing powers:

- **Credit reminders** — "உங்கள் கடன் ₹1,685. தயவுசெய்து செலுத்தவும்" with the statement
- **Day-close summary** to the owner's own number
- **Reorder list** to a supplier, straight from the low-stock screen

## UPI QR

Generated **locally** with a small QR library (`qrcode` npm, ~15 KB). Today's code fetches
from `api.qrserver.com` (`Sales.tsx:300`), which fails with no internet — and offline is
precisely when the shop still needs to take payment.

```
upi://pay?pa=<vpa>&pn=<payeeName>&am=<amount>&cu=INR&tn=Bill%20<billNo>
```

Two placements:
- **Payment sheet** — big QR on screen, customer scans and pays
- **Printed bill footer** — customer can pay later from the paper bill (useful for credit)

`pa` comes from `settings.shop.upiVpa`. If it's unset, UPI payment mode is hidden rather than
generating a QR pointing at a placeholder address that would send the shop's money to a
stranger.
