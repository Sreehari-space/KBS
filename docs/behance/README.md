# Behance case study — KBS

Eighteen boards plus the project cover, exported at **2× (2800 px wide, 1400 px
display)**. Upload in filename order; Behance stacks images in the order you add
them and that order is the reading order.

| File                    | Board                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `00-behance-cover.png`  | Project cover — 808×632 at 2×. Not part of the sequence.    |
| `01-cover.png`          | Opening statement                                          |
| `02-the-counter.png`    | Context: the constraints the counter imposes               |
| `03-scope.png`          | Role, platform, stack, what shipped                        |
| `04-principles.png`     | The four rules                                             |
| `05-colour.png`         | Palette, with the measured ratios                          |
| `06-money.png`          | Money typography, and integer paise underneath             |
| `07-two-scripts.png`    | Tamil as the default, not a translation layer              |
| `08-the-till.png`       | The billing screen, annotated                              |
| `09-one-sale.png`       | The five moves of a sale                                   |
| `10-loose-goods.png`    | Weighing, and selling by amount                            |
| `11-khata.png`          | Credit modelled as the absence of payment                  |
| `12-the-bill.png`       | One bill model, four renderers                             |
| `13-reports.png`        | Reports and day close                                      |
| `14-offline.png`        | No server, atomic commits, storage arithmetic              |
| `15-dark.png`           | Dark mode                                                  |
| `16-first-run.png`      | The pastel/ink onboarding                                  |
| `17-what-broke.png`     | Five defects that shipped, and what each cost              |
| `18-close.png`          | Outcome and what is still open                             |

## Two things to edit before publishing

- **`03-scope.png` names the role** as "product design, UI system and front-end
  implementation". Change it if you want to describe your part differently —
  it is the one board making a claim about you rather than about the work.
- **The year is 2026** on the cover and the closing board.

Both live in `src/boards.html`; rebuild the inlined assets with `src/bassets.py`,
then re-render with `src/render.mjs`.

## How these were made

Every screen is a real capture of the built app driven through an actual
session — a shop set up, products weighed into a cart, sales completed, one
put on khata — not a mockup. The reports, the ledger balance and the bill
numbers on these boards are the numbers that session produced.

The case study is set in Archivo; the Tamil is the app's own Noto Sans Tamil.
