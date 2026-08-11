# 05 — Credit Ledger, Tamil, Day Close & Backup

## Credit ledger (கடன்)

**Why this is P0 (D9).** Kirana shops run on monthly credit. Regulars take goods through the
month and settle on salary day. Today this lives in a paper notebook behind the counter, and
that notebook is the single most important object in the shop — more than the cash box, because
it represents money not yet collected.

A POS that can't replace the notebook gets used for printing bills and abandoned for everything
else. The owner ends up maintaining both. So the ledger isn't a feature bolted on after
billing; it's the reason the app stays open.

### Model

Append-only, as specified in [doc 02](02-data-model.md). Corrections are new `adjustment`
rows, never edits to history. If a customer disputes their balance, the shop walks the entries
with them — that argument is the ledger's whole job.

```
balance(customer) = Σ ledger.amountPaise where customerId = c

  credit_sale     +₹450    goods taken
  payment         −₹200    part settlement
  adjustment      −₹50     rounding waived / dispute settled
  opening_balance +₹1200   migrated from the paper notebook
```

`Customer.balancePaise` caches this sum for fast list rendering. A "recalculate balances"
action in Settings rebuilds every cache from the ledger — the escape hatch if a cache ever
drifts.

### Screens

**Ledger list (கடன் பட்டியல்)**

- Customers with a non-zero balance, sorted by amount owed
- Header totals: total outstanding, count of customers, oldest unsettled bill
- Per row: name, balance, days since last payment
- Rows past ~30 days are visually flagged — not with alarming red, just enough to be noticed

**Customer statement**

- Running balance, newest first, each row showing the delta and the resulting balance
- Tap a `credit_sale` row → opens the original bill
- **[ பணம் வசூல் / Collect ]** — record a full or part payment
- **[ WhatsApp நினைவூட்டல் ]** — send the statement as a reminder

**During billing**

- Selecting a customer shows their current balance inline, before the sale is committed —
  the shopkeeper needs to know _before_ handing over more goods
- Past the credit limit: a warning, never a block. The shopkeeper knows their customers better
  than the app does, and a hard block would just get worked around

### Migrating the paper notebook

A shop switching over already has balances. Import path: add each customer with an
`opening_balance` entry dated the switchover day. A bulk-entry screen (name, phone, amount)
makes this a 20-minute job rather than a reason not to adopt.

## Tamil / English (i18n)

**Default language is Tamil.** English is the toggle, not the other way round.

### Implementation

No i18next. Two language objects and a hook — about 60 lines total, versus ~40 KB of library
for a two-language app with no pluralisation rules or runtime locale loading.

```ts
// i18n/ta.ts
export const ta = {
  'nav.billing': 'பில்லிங்',
  'nav.inventory': 'சரக்கு',
  'nav.ledger': 'கடன்',
  'billing.scan': 'ஸ்கேன்',
  'billing.total': 'மொத்தம்',
  'billing.bill': 'பில் போடு',
  // ...
} as const;

// i18n/useT.ts
export const useT = () => {
  const lang = useLanguage();
  return (key: keyof typeof ta) => (lang === 'ta' ? ta : en)[key] ?? en[key];
};
```

`en.ts` is the key authority; typing `ta` against `keyof typeof en` makes a missing Tamil
string a compile error rather than a blank label discovered by a shopkeeper.

### Beyond string swapping

- **Products carry both names.** `nameTa` and `nameEn`. Search matches either, so typing
  "rice" or "அரிசி" both find பொன்னி அரிசி. Staff who type faster in English aren't punished.
- **Bills print in the selected language**, with `nameEn` as fallback when `nameTa` is empty.
- **Font must be self-hosted.** `public/fonts/NotoSansTamil-{Regular,Bold}.woff2`, subset to
  Tamil + Latin + digits. A Google Fonts `<link>` renders boxes offline — unacceptable when
  offline is the normal state.
- **Tamil text is taller than Latin.** Buttons and table rows need vertical padding tuned with
  real Tamil strings in place, not designed in English and translated after.
- **Numbers stay Western** (`123`, not `௧௨௩`). Tamil numerals are not used in commerce.
- **Language toggle in the header**, one tap, not buried in Settings. Staff switch mid-shift.

## Day close (கடை சாத்து)

The end-of-day ritual: count the cash box, check it against the day's sales, note what's
missing. Every shop does this on paper. It takes fifteen minutes and it's where theft and
mistakes surface.

**Screen:**

```
    இன்றைய கணக்கு — 08/08/2026
────────────────────────────────
விற்பனை / Sales          42 bills
மொத்தம் / Total        ₹18,450.00
────────────────────────────────
ரொக்கம் / Cash          ₹9,200.00
UPI                     ₹6,750.00
Card                    ₹1,200.00
கடன் / Credit           ₹1,300.00
────────────────────────────────
எதிர்பார்த்த ரொக்கம்      ₹9,200.00
எண்ணிய ரொக்கம்    [  9,150  ]     ← owner types the counted amount
வித்தியாசம்               −₹50.00
────────────────────────────────
கடன் வசூல் / Collected   ₹2,400.00
புதிய கடன் / New credit  ₹1,300.00

   [ WhatsApp-ல் அனுப்பு ]
   [ முடி / Close day ]
```

Notes:

- **Expected cash** = cash payments + cash credit collections − cash refunds. Not just sales.
- The difference is recorded, not judged. A running history of differences is what reveals a
  pattern.
- One tap sends the summary to the owner's WhatsApp — genuinely useful when the owner isn't at
  the shop, which is the common case for a second outlet or an evening shift.
- Closing the day is a **record, not a lock**. A late sale after close must still work; it
  simply belongs to the next day's tally. Locking would push staff to work around the app.

## Backup & restore (D7)

Client-only means the shop's entire business lives in one browser's IndexedDB. Clearing site
data, losing the phone, or a corrupted profile wipes everything. **Backup is not optional.**

### Chosen approach: JSON export/import + Web Share

```ts
// Export — one file, everything
{
  kbsVersion: 1,
  exportedAt: "2026-08-08T08:20:00Z",
  products: [...], customers: [...], sales: [...],
  ledger: [...], settings: {...}
  // images excluded by default (size); "full backup" option includes them base64-encoded
}
```

- **Export** → `navigator.share({ files: [json] })` → the owner sends it to their own WhatsApp,
  Google Drive, email, or just saves it to the phone. Zero configuration, works everywhere.
- **Import** → file picker → preview (counts per table, export date) → **replace** or **merge**.
  Never silent. Restoring the wrong file over live data would be catastrophic.
- **Automatic reminder** — if no export has happened in 7 days, a dismissible banner appears on
  the dashboard. Not a modal; nagging gets apps uninstalled.

### Why not the Google Drive API

The option that was selected mentioned Drive backup, so this is a deliberate deviation worth
flagging.

Drive API needs a Google Cloud project, an OAuth consent screen (with verification if it's
distributed beyond a test list), a client ID compiled into public JS, and a live internet
connection at backup time. For one shop owner installing a web app, that is a wall.

Web Share to Drive achieves the same outcome — the file lands in Drive — with two taps and no
setup, because the Drive _app_ is already signed in on their phone. Proper Drive API sync stays
on the Phase 4 list if multi-device restore is ever wanted.

### Additional safety nets

- **Never call `db.delete()`** anywhere in the app.
- `navigator.storage.persist()` requested on first run, so the browser is far less likely to
  evict the database under storage pressure.
- Warn if `navigator.storage.estimate()` shows the quota running low.
- Settings shows **"Last backup: 3 days ago"** in plain sight, because a backup system nobody
  can see is one nobody trusts.

## Automatic Tamil names (English / Tanglish / Tamil)

Product names fill themselves in as the shopkeeper types, in all three
directions:

| Typed       | English field | Tamil field              |
| ----------- | ------------- | ------------------------ |
| `Tomato`    | Tomato        | தக்காளி                  |
| `thakkali`  | **Tomato**    | தக்காளி                  |
| `தக்காளி`   | **Tomato**    | தக்காளி                  |
| `Britannia` | Britannia     | பிரிடணிய _(sound-alike)_ |

### Why not a translation API

A cloud translator cannot sit on this path. The item is added mid-bill with a
customer waiting, and the whole app is built to work with no signal — an
offline call would just fail at the worst moment. So this is done locally, in
two layers:

1. **Lexicon** (`domain/tamil/lexicon.ts`) — ~130 kirana terms with their Tamil
   spellings and the Tanglish spellings a shopkeeper is likely to type. This is
   real translation, and it covers what a provision store actually sells.
   Matching is loose: doubled letters and vowel length are folded away, so
   `thakkali`, `takkali` and `thakkaali` all resolve to தக்காளி.
2. **Transliteration** (`domain/tamil/transliterate.ts`) — a phonetic Latin →
   Tamil renderer for anything the lexicon does not know, mostly brand names.

Multi-word names are resolved word by word and rejoined, so `Aachi rice`
becomes `ஆசி அரிசி` even though that phrase is not listed. Sizes and units
(`500ml`, `1kg`) pass through untouched.

### The limitation, stated plainly

Layer 2 converts **sound, not meaning**. `Britannia` becomes பிரிடணிய, which
reads correctly aloud but is not a translation — there is nothing to translate.
That is exactly what shops write on their own labels for brand names, so it is
useful, but it is a suggestion rather than an answer. Those cases are flagged
with an amber border and "Sound-alike only. Please check the Tamil name."

Two rules stop it becoming annoying:

- **Manual edits win.** Once the Tamil field is typed in by hand, nothing
  overwrites it. A wrong Tamil name on a printed bill is worse than a blank one.
- **English is only rewritten for Tanglish.** Typing `Tomato` must not have the
  field rewritten under the cursor; typing `thakkali` should resolve to
  `Tomato`, because that is plainly what was meant.

If a shop wants proper translation of arbitrary text, that needs a network call
and belongs behind the optional Gemini key — never on the billing path.
