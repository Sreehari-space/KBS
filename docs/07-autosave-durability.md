# 07 — Auto-Save & Durability

> **Hard requirement.** Every bill and every transaction is saved automatically to the device.
> There is no Save button anywhere in the app, and no code path where a completed sale is shown
> to the user before it is on disk. This is not negotiable and takes priority over performance,
> UI polish, and code simplicity wherever they conflict.

Primary device is an **Android phone**. Everything below is designed for that first.

## Why IndexedDB and not the `localStorage` API

Both are on-device local storage. `localStorage` cannot meet the requirement above.

|                    | `localStorage`                      | IndexedDB                                     |
| ------------------ | ----------------------------------- | --------------------------------------------- |
| Capacity           | ~5 MB hard cap per origin           | Large share of free disk (Chrome: up to ~60%) |
| Data types         | Strings only                        | Structured objects + Blobs                    |
| Write model        | Synchronous, blocks the main thread | Async, transactional                          |
| Incremental writes | Must rewrite the entire value       | Insert/update a single record                 |
| Atomicity          | None                                | Multi-store transactions                      |

**Capacity.** A bill with Tamil item names is ~1–2 KB stored. At 100 bills/day that is
**36–70 MB/year**. `localStorage` would hit its 5 MB ceiling in roughly 6–8 weeks and then
throw `QuotaExceededError` — silently losing every bill after that point.

**Write cost is the bigger problem.** `localStorage` holds strings, so appending bill #4,000
means `JSON.stringify`-ing all 4,000 bills and rewriting the whole blob synchronously. The
freeze grows linearly with history and lands on the main thread of a low-end phone. The app
would be unusable months before it ran out of space.

`localStorage` is used for exactly one value: the theme flag, read before first paint to avoid
a flash of the wrong background. Nothing else.

## Storage budget

| Data               | Per unit            | 1 year @ 100 bills/day | 5 years    |
| ------------------ | ------------------- | ---------------------- | ---------- |
| Sales              | ~1–2 KB/bill        | 36–70 MB               | 180–350 MB |
| Ledger entries     | ~200 B              | < 5 MB                 | < 25 MB    |
| Products           | ~500 B              | < 1 MB                 | < 1 MB     |
| Customers          | ~300 B              | < 1 MB                 | < 1 MB     |
| **Product images** | **capped at 50 KB** | ~25 MB @ 500 products  | ~25 MB     |

Comfortably within a phone's budget. **Bills are never pruned** — see Retention below.

**Images are the only real quota risk.** An uncompressed phone photo is 2–5 MB; 500 of them
would be 1–2 GB and could trip eviction. So every image is resized to max 400 px on the long
edge and re-encoded as JPEG at ~50 KB **before** it reaches IndexedDB. Original files are never
stored.

## The commit protocol

The single most important sequence in the app. A completed sale touches four stores and they
must all land or none of them:

```
User taps [ பில் / BILL ]
        │
        ▼
┌───────────────────────────────────────────────┐
│ ONE IndexedDB transaction (readwrite):        │
│   • sales      insert the Sale record         │
│   • products   decrement stock for each line  │
│   • ledger     insert entry if creditPaise>0  │
│   • counters   increment the daily bill no.   │
│   • drafts     delete the open-cart draft     │
└───────────────────┬───────────────────────────┘
                    │
        ┌───────────┴────────────┐
     commits                   throws
        │                        │
        ▼                        ▼
 Show bill + share      Show error, KEEP THE CART,
 Clear cart from        offer Retry. Nothing is
 memory                 written. Nothing is lost.
```

Rules that fall out of this:

- **Nothing is shown as done before the transaction commits.** The receipt screen renders on
  the transaction's success callback, never optimistically. Reversing this order is the classic
  way to print a bill that isn't in the database.
- **The cart is cleared only after commit.** A failed write leaves the shopkeeper exactly where
  they were, able to retry, with the customer still standing there.
- **The bill number is allocated inside the same transaction**, so two fast taps can't produce
  duplicate numbers.
- **Assert `Σ payments + credit === total`** before opening the transaction. A sale that doesn't
  balance is rejected rather than written wrong.

**Disk durability.** IndexedDB transactions accept a `durability` hint, and Chrome defaults to
`"relaxed"` — the write may sit in OS buffers rather than being flushed. For the sale-commit
transaction specifically we want `"strict"`, so a battery pull a second after billing cannot
lose the last sale. The cost is a few milliseconds per bill, which is irrelevant at counter
speed. _(Confirm how Dexie exposes this at implementation time; fall back to a raw IDB
transaction for this one path if needed.)_

## Draft auto-save (the in-progress cart)

The commit protocol protects _completed_ bills. The open cart needs its own protection, and on
Android it needs it badly: **the OS kills backgrounded browser tabs on low-RAM phones routinely**.
A shopkeeper who takes a phone call halfway through a 20-item bill comes back to a dead tab.

- Every cart mutation writes to a `drafts` store, **debounced 300 ms** so rapid `+` taps don't
  cause a write storm.
- On app boot, an existing draft restores automatically with a "முடிக்கப்படாத பில் / Unfinished
  bill" banner — resume or discard.
- Held bills ([doc 03](03-billing-scanner.md)) use the same store with `status: 'held'`, so
  parking a bill and crashing mid-bill are the same mechanism.

Covers: browser killed by Android, battery death, accidental back-navigation, phone call
interruption, tab closed by mistake.

## Append-only, never delete

- **Sales are immutable once written.** A mistake is corrected with a _return_ bill linked via
  `returnOfSaleId` — the original stays. An interrupted write can therefore never corrupt an
  existing bill.
- **Ledger entries are append-only.** Corrections are new `adjustment` rows ([doc 05](05-ledger-tamil-dayclose.md)).
- **Products and customers are soft-deleted** (`deletedAt`), never removed, so old bills always
  resolve.
- **`db.delete()` is never called anywhere in the app.** No "reset app" button exists.

## Retention

**Bills are kept forever.** No automatic pruning, no rolling window, no "archive bills older
than a year". At the volumes above, five years of history costs a few hundred MB on a device
with tens of GB free — the storage saving would be meaningless and the risk of deleting
something a shop needed is not.

If a device ever genuinely runs short, the escape hatch is an explicit, user-initiated export-
then-archive of a chosen date range — never automatic, never silent.

## Protecting the database

- **`navigator.storage.persist()`** requested on first run. Exempts the database from the
  browser's automatic eviction under storage pressure. Grant odds are much higher for an
  installed PWA, which is one more reason to push installation.
- **`navigator.storage.estimate()`** checked on startup. Warn at 80% of quota, before writes
  start failing rather than after.
- **Incognito detection.** Private/incognito mode discards storage on close. If detected, show
  a blocking warning — billing in incognito would lose the entire day.
- **PWA install prompt** surfaced clearly. On iOS this is critical: Safari wipes script-writable
  storage after ~7 days of not visiting a site, and Home Screen web apps are exempt.
- **Write failures are never silent.** A `QuotaExceededError` or a failed transaction shows a
  blocking error with the cart preserved. The one unacceptable outcome is a shopkeeper
  believing a bill saved when it didn't.

## What auto-save does _not_ cover

Auto-save fully solves crashes, forgetting to save, interrupted bills, and low-memory tab
kills. It cannot solve **the phone being lost, stolen, broken, or wiped** — the data lives in
one browser profile on one device.

The local-only mitigation that fits the no-server constraint, in priority order:

1. **Day-close backup prompt.** The day-close screen ([doc 05](05-ledger-tamil-dayclose.md))
   ends with a one-tap "send today's backup" through the OS share sheet — the owner sends the
   JSON to their own WhatsApp or Drive. One tap, attached to a ritual they already perform
   daily, rather than a reminder they'll dismiss.
2. **Desktop auto-backup.** On a laptop, the File System Access API can hold a folder handle
   and write a daily backup with no prompt after one-time setup. Point it at a synced Drive or
   OneDrive folder and backup becomes fully automatic. _(Not available on Android Chrome, so
   phones stay on the share-sheet path.)_
3. **Visible backup age.** "Last backup: 3 days ago" in Settings and on the dashboard.

The credit ledger is the data whose loss is unrecoverable — it is money owed that no customer
will volunteer. If off-device backup is ever revisited, that's the reason.

## Acceptance criteria

Phase 1 is not done until all of these pass on a real Android phone:

| #   | Test                                                       | Expected                                                      |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Complete a bill, force-stop the browser immediately        | Bill present on reopen, stock decremented                     |
| 2   | Complete a bill in aeroplane mode                          | Saves normally; no network involved                           |
| 3   | Add 10 items, background the app, let Android kill the tab | Draft restores with all 10 items                              |
| 4   | Bill 500 sales, then bill one more                         | Save latency unchanged; no UI freeze                          |
| 5   | Fill storage to quota, then bill                           | Blocking error shown, **cart preserved**, retry works         |
| 6   | Two fast taps on [BILL]                                    | Exactly one sale, one bill number                             |
| 7   | Credit sale                                                | Sale + ledger entry + customer balance all update, or none do |
| 8   | Kill the app mid-transaction (dev-tools throttle)          | No partial sale; stock not decremented without a bill         |
| 9   | Reopen after 30 days idle, PWA installed                   | Data intact                                                   |
| 10  | Export, wipe site data, import                             | Every bill, ledger entry and product returns                  |
