# 09 — Making it feel like a professional till

The app was correct before this pass and still felt like an app rather than a
till. This document records what changed and, more usefully, the rules the
changes follow — so the next screen added to KBS matches without anyone having
to guess.

Nothing here changes what the app *does*. Every change is additive to the
touch path: a shopkeeper on a ₹8,000 Android phone gets the same flow they had,
with fewer dead frames and better-set numbers.

---

## 1. Keyboard-first billing

A till is fast because a trained hand never leaves the keys. On the counter
tablet with a Bluetooth keyboard — or on a laptop — this is the difference
between "an app" and "a till".

| Key | Action |
|---|---|
| `/` | Jump to search |
| `F2` | Open the scanner |
| `↑ ↓ ← →` | Move the highlight through the product grid |
| `Enter` | Add the highlighted item (the top search match by default) |
| `+` / `−` | One more / one fewer of the last item |
| `F4` | Open the cart |
| `F9` | Take payment |
| `Esc` | Close the topmost sheet, or clear the search |
| `?` | Show the shortcut list |

Three rules keep this from fighting the person typing (`src/hooks/useHotkeys.ts`):

- **Printable characters never fire while the caret is in a field.** `+`, `−`
  and `/` are things someone may legitimately be typing.
- **`←` and `→` never fire while typing either** — that is how the caret moves
  inside the search box, and stealing it is worse than the shortcut is worth.
  `↑`/`↓` are safe (a single-line input has nowhere vertical to go) and they
  are the search-then-pick path, which is the most-used one.
- **`?` always fires**, including while typing. It is Shift+`/`, nobody types
  it into a product search, and a lost operator is exactly the person who will
  be sitting in the search box when they go looking for help.

While any sheet is open, the sheet owns the keyboard; `Esc` is handled inside
`Sheet` itself, on the capture phase, so it closes exactly one level.

**Discoverability.** Shortcuts nobody can find are a feature for the person who
wrote them. The `?` chip in the header and the `/` chip in the search box only
appear once a hardware keyboard has demonstrably been used (`useKeyboardUser`),
so a phone never carries them.

---

## 2. Motion language

Four verbs, one vocabulary, defined once in `tailwind.config.js`:

| Verb | Used by | Timing |
|---|---|---|
| **Rise** | Sheets, from the edge they belong to | 200 ms in, 140 ms out |
| **Settle** | A new cart line, a new scan hit, a new split-payment row | 180 ms |
| **Fade** | Banners, panels, disclosures | 160 ms |
| **Breathe** | Skeletons, the scanner's warm-up frame | 1.4 s loop |

Rules:

- **Nothing runs longer than 260 ms.** Slow animation on a low-end Android
  feels worse than none.
- **Dismissal is faster than arrival.** A sheet that leaves in 140 ms reads as
  having obeyed you instantly.
- **Motion never carries state on its own**, so the whole vocabulary is
  disabled wholesale under `prefers-reduced-motion` (one block in `index.css`,
  plus `useReducedMotion` for the JS-driven count-up).

A new cart row animates and a quantity change does not — that falls out of the
React key, not from tracking "which row just changed". The running total
counts up over 260 ms with an ease-out and always lands exactly on the target
value; the last frame writes the real number, never an interpolation.

---

## 3. Loading states

Screens used to render `null` (Day close) or pop in fully formed (Reports).
Both flash. Every screen that reads IndexedDB now shows the *shape* of what is
coming.

The mechanism is deliberately simple: drop the third argument to
`useLiveQuery`, so `undefined` means "still loading" and can be told apart from
"loaded and empty". The old default of `[]` rendered "no items found" for a
frame on every mount. The loading region carries `aria-busy`; the skeletons
themselves are shapes with no text and no labels.

---

## 4. Reports as an instrument

A number on its own is data. A number with a baseline is information.

- **Every stat carries a comparison** with the immediately preceding window of
  the same length. Growing from zero is reported as *"no earlier period"*, not
  as infinity percent — see `percentChange`.
- **Sparklines** are built from one bucket per day *including days with no
  sales*, so a closed Sunday does not look like a normal trading day.
- **Hour-of-day** is the thing no paper notebook can produce: a kirana owner
  genuinely does not know whether the 7–9 pm rush beats the morning one.
- **Profit** is the most valuable line the app can show and the one it must
  never overstate. Only lines whose product has a cost price are counted;
  revenue with no cost behind it is reported separately rather than silently
  booked as pure profit.
- **Every figure is a way in.** Tapping a stat or a day opens the bills behind
  it, so no number is a dead end.

All of this lives in `src/features/reports/analytics.ts` as pure functions with
tests. Money stays integer paise; quantities may be fractional (2.5 kg), so
each line's cost is rounded at the point it is computed, exactly as
`lineAmount` does for the price.

---

## 5. The receipt is paper

The on-screen receipt is what the customer looks at over the counter, which
makes it the shop's face. It now has a torn thermal-roll edge (two conic
gradients in a CSS mask) and a drop shadow on the wrapper — a mask clips its
own element's shadow, but `filter: drop-shadow` on the parent follows the
masked silhouette exactly.

Both are screen affordances and both are switched off under `@media print`,
where the teeth would crop the first and last lines of the bill.

---

## 6. Numerals

One component, `<Money>`, renders every amount in the app:

- Tabular figures and slightly tighter tracking, so a column of amounts scans
  as a column.
- **The paise are smaller and lighter** (`0.82em`, 62% opacity). `₹1,240.00`
  reads as "twelve forty" and the `.00` stops competing with the rupees. Every
  serious finance UI does this.
- **Counts are not money.** `.count` gives tabular figures without the
  tightening or the weight, so "12 items" never carries the visual weight of
  "₹1,240".

---

## 7. Settings

Settings is where the shopkeeper comes to ask "is my data safe?", so it opens
with the answer, not with a form: shop name, storage used with a bar,
protected-from-eviction state, and a colour-coded backup age.

Two edits beyond that:

- **No control repeats its own section's title.** "Appearance" inside
  "Appearance", "Scan" inside "Scan" and a second "Restore backup" all read as
  placeholders nobody finished.
- **Advanced is collapsed.** A Gemini API key sitting in the open in a kirana
  till was the single most out-of-place element in the app. It is real and it
  works; it is just not something the shopkeeper should see on an ordinary day.

No `uppercase tracking-wide` anywhere: uppercase is a no-op in Tamil, and the
extra letter-spacing pulls its glyph clusters apart.

---

## 8. Trust signals

This audience has been burned by apps losing data. Small permanent statements
of fact do more for perceived quality than any amount of visual polish.

- **A "Saved" state beside the total**, never a toast — a toast implies
  something happened; this is just the truth. It flips to "Saving…" the instant
  the cart changes and only back once the write resolves, and a write that
  finishes after the cart has moved on cannot claim the newer state is safe.
- **The next bill number is visible before the sale completes**, so the
  sequence reads as a ledger. It is explicitly a peek: the real number is still
  allocated inside the commit transaction, so two fast taps can never collide.
- **Offline is a dot, not a banner.** Being offline is the normal state for
  this app. Banners stay reserved for things that are actually wrong.

---

## 9. Empty states do work

An icon and two lines of sympathy is a dead end. Every empty screen knows the
one thing the shopkeeper came there to do and offers it — and an empty catalogue
is a different problem from an empty search result, so they get different
offers. The Bills screen additionally shows, greyed out, what a bill will look
like.

---

## 10. First run

A fresh install used to drop the shopkeeper onto an empty billing screen —
technically correct, completely unwelcoming. Three questions and about four
minutes later the till has their shop's name on it, knows whether it charges
GST, and has their fastest sellers waiting on the front screen.

Everything is skippable and everything is editable later, so this is a head
start and never a gate. Completion is recorded in `settings.ui.onboardedAt`,
and the gate only opens once settings have genuinely been read off disk —
otherwise every cold start would flash the setup flow.

---

## Decision log additions

| # | Decision | Rationale |
|---|---|---|
| D13 | Keyboard shortcuts are **additive and never steal a printable key from a focused field** | The touch path is the one that must never regress. A shortcut that eats a character the operator was typing costs more than it saves. |
| D14 | Motion is capped at **260 ms** and disabled wholesale under `prefers-reduced-motion` | Nothing in this app conveys state through movement alone, so it can all be switched off; on a low-end phone slow animation is worse than none. |
| D15 | `useLiveQuery` on the billing path takes **no default value** | `undefined` is the loading state. A default of `[]` renders an empty-state for a frame on every mount, which is what made screens feel cheap. |
| D16 | Profit is reported **only over lines with a recorded cost price** | Treating a missing cost as zero would flatter the shop and make the number useless. Uncosted revenue is shown separately instead. |
| D17 | The next bill number shown on the billing screen is a **peek, not an allocation** | The number must still be handed out inside the commit transaction, or two fast taps could share one. |
