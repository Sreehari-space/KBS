# KBS Design Docs

Technical design for upgrading KBS into a POS that a **kirana / provision store in
Tamil Nadu** can actually run its counter on.

Nothing here is implemented yet. This is the plan to review before any code changes.

## Read in this order

| Doc | Covers |
|---|---|
| [01-architecture.md](01-architecture.md) | Offline-first client architecture, PWA, repository layer, target file structure, migration from today's code |
| [02-data-model.md](02-data-model.md) | Full TypeScript schema, IndexedDB stores, indexes, migrations, money handling |
| [03-billing-scanner.md](03-billing-scanner.md) | Barcode + QR scanning, learn-as-you-scan, weight-based selling, billing screen |
| [04-bill-print-whatsapp.md](04-bill-print-whatsapp.md) | Bill model, 58mm thermal print, WhatsApp text + image, UPI QR, ESC/POS |
| [05-ledger-tamil-dayclose.md](05-ledger-tamil-dayclose.md) | Credit ledger (கடன்), Tamil/English i18n, day close, backup/restore |
| [06-roadmap.md](06-roadmap.md) | Phased delivery, PR-sized tasks, acceptance criteria, risks |
| [07-autosave-durability.md](07-autosave-durability.md) | **Auto-save guarantees**, commit protocol, draft recovery, storage budget |
| [08-deployment.md](08-deployment.md) | Deploying to Vercel, cache headers, installing on a phone, rollback |
| [09-premium-ui.md](09-premium-ui.md) | Keyboard-first billing, motion language, loading states, report comparisons, receipt paper, numerals, first run |

## Scope decisions (agreed)

| Question | Decision |
|---|---|
| **Target shop** | Kirana / provision store first. Other shop types are mostly a subset. |
| **Backend** | None. Client-only, offline-first. IndexedDB + PWA. Zero server cost. |
| **This deliverable** | Design docs only. Implementation starts after review. |
| **Auto-save** | **Hard requirement, no compromise.** Every bill and transaction saved to the device automatically. No Save button. Mobile-first. See [doc 07](07-autosave-durability.md). |

## Decision log

Choices made in these docs that are worth arguing about before we build.

| # | Decision | Rationale | Doc |
|---|---|---|---|
| D1 | Money stored as **integer paise**, never floats | `0.1 + 0.2 !== 0.3`. Rupee totals must be exact. Today's code uses floats throughout. | [02](02-data-model.md) |
| D2 | Bundle React/Tailwind instead of loading from CDN | The app **cannot work offline today** — React itself is fetched from `aistudiocdn.com` at runtime. Blocks the whole PWA goal. | [01](01-architecture.md) |
| D3 | Repository interfaces over Dexie | ~1 day of extra work now; lets a server slot in later without touching UI. | [01](01-architecture.md) |
| D4 | Learn-as-you-scan catalogue | No free universal Indian product database exists. Shop builds its own catalogue while billing normally. | [03](03-billing-scanner.md) |
| D5 | One `Bill` model, four renderers (HTML / text / PNG / ESC-POS) | Bill layout logic written once. Print, WhatsApp text, and WhatsApp image can never drift apart. | [04](04-bill-print-whatsapp.md) |
| D6 | GST **off** by default; plain Estimate bill | Most target shops are under the ₹40L threshold or on composition scheme and charge no GST. | [02](02-data-model.md) |
| D7 | Backup = JSON export/import + Web Share, **not** Google Drive API | Drive API needs a GCP project, OAuth consent screen, and internet. Too much friction for a single-shop owner. Drive stays a Phase 4 option. | [05](05-ledger-tamil-dayclose.md) |
| D8 | Gemini becomes **bring-your-own-key**, entered in Settings | A client-only app cannot hold a secret. Today's key is compiled into public JS. | [01](01-architecture.md) |
| D9 | Credit ledger is P0, not a nice-to-have | Kirana shops run on monthly credit. A POS without it won't be adopted. | [05](05-ledger-tamil-dayclose.md) |
| D10 | On-device storage uses **IndexedDB**, not the `localStorage` API | Both are local and serverless, but `localStorage` caps at ~5 MB (≈6 weeks of bills) and its synchronous whole-blob rewrites would freeze a low-end phone on every sale. | [07](07-autosave-durability.md) |
| D11 | Sale commit is **one atomic transaction**; the receipt renders only after it succeeds | A bill must never be shown as complete unless it is on disk. On failure the cart survives so the shopkeeper can retry. | [07](07-autosave-durability.md) |
| D12 | Bills are **never pruned** and sales are **immutable** | "Every bill stored" means forever. Corrections are return bills, so an interrupted write can't corrupt existing history. | [07](07-autosave-durability.md) |
| D13 | Keyboard shortcuts are **additive and never steal a printable key from a focused field** | The touch path is the one that must never regress; a shortcut that eats a character the operator was typing costs more than it saves. | [09](09-premium-ui.md) |
| D14 | Motion is capped at **260 ms** and disabled wholesale under `prefers-reduced-motion` | Nothing conveys state through movement alone, so it can all be switched off; on a low-end phone slow animation is worse than none. | [09](09-premium-ui.md) |
| D15 | `useLiveQuery` on the billing path takes **no default value** | `undefined` is the loading state. A default of `[]` renders an empty-state for a frame on every mount. | [09](09-premium-ui.md) |
| D16 | Profit is reported **only over lines with a recorded cost price** | Treating a missing cost as zero would flatter the shop and make the number useless. | [09](09-premium-ui.md) |
| D17 | The bill number shown while billing is a **peek, not an allocation** | The real number is still handed out inside the commit transaction, so two fast taps can never share one. | [09](09-premium-ui.md) |
| D18 | Payment-sheet decisions live in a **tested pure module**, not in component state | A UI-polish commit silently made every credit and split-payment sale unreachable, and no test could see it. | [09](09-premium-ui.md) |
