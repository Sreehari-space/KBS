# 08 — Deploying to Vercel

Vercel suits this app well: HTTPS is automatic, which the barcode scanner **requires**, and the
build output is plain static files with no server runtime.

## One-time setup

1. Push the repo to GitHub (already done — the branch is `claude/kbs-tamil-nadu-stores-hubqhp`).
2. In Vercel: **Add New → Project → Import** the GitHub repo.
3. Everything is pre-configured in [`vercel.json`](../vercel.json) — framework, build command,
   install command and output directory. Don't override them in the dashboard; the file wins
   and keeps the config in version control.
4. **No environment variables are needed.** The app has no server, no API keys, and no secrets.
   (AI is bring-your-own-key, entered by the shop owner in Settings — see D8.)

Vercel then deploys `main` to production and opens a preview deployment for every branch and
pull request.

## Two things that will bite if ignored

### 1. The production domain is permanent — pick it before a shop starts billing

IndexedDB is **origin-scoped**. Data saved at `kbs-xyz.vercel.app` does **not** follow you to
`kbs.myshop.in`. Moving domains later means every shop starts from an empty database, with
their bills and credit ledger stranded on the old origin.

So: attach the final custom domain **before** a real shop begins using it. If a shop has
already started on a `.vercel.app` URL, migrate them deliberately — export a backup on the old
origin, then import it on the new one ([doc 07](07-autosave-durability.md)).

### 2. Preview deployments have their own data

Every preview URL is a different origin, so a preview deployment sees an empty database and a
fresh service worker. That is correct and useful — you can test destructive things safely — but
don't be surprised when a shop's data isn't there, and never ask a shop to "just try the
preview link".

## Why the headers in `vercel.json`

JSON has no comments, so the reasoning lives here.

| Path | Cache-Control | Why |
|---|---|---|
| `/sw.js` | `max-age=0, must-revalidate` | **The important one.** A cached service worker means shops get stuck on an old build indefinitely. Workbox does its own versioning; the file itself must always be re-checked. |
| `/index.html` | `max-age=0, must-revalidate` | Points at content-hashed bundles, so it has to be revalidated every load. |
| `/manifest.webmanifest` | `max-age=0, must-revalidate` | Same reason; also pinned to the correct content type. |
| `/assets/*` | `1 year, immutable` | Vite content-hashes these filenames, so they can never go stale. |
| `/fonts/*`, `/icons/*` | `7 days` | Not content-hashed, but Workbox revisions them in the precache manifest. A week is a safe middle ground. |

Other headers:

- **`Permissions-Policy: camera=(self), microphone=(self)`** — camera is required by the
  scanner, microphone by Tamil voice billing. Both are same-origin only. Getting this wrong
  silently breaks the scanner, which is why it is set explicitly rather than left to defaults.
- **`X-Frame-Options: DENY`** — a POS should never be embedded in someone else's page.
- **`X-Content-Type-Options: nosniff`**, **`Referrer-Policy: strict-origin-when-cross-origin`** —
  ordinary hardening.

The single `rewrites` rule sends unknown paths to `index.html`. Vercel checks the filesystem
*before* applying rewrites, so real files still serve normally.

## Getting it onto a shopkeeper's phone

The app is only properly installed when it is on the home screen — that is what makes it feel
like an app, and (on iOS) what stops Safari wiping storage after ~7 days of not visiting.

- **Android / Chrome:** Settings → **Install app** (the button appears once Chrome fires
  `beforeinstallprompt`), or Chrome's ⋮ → *Add to Home screen*.
- **iOS / Safari:** Share → *Add to Home Screen*. Safari never shows an install prompt, so this
  has to be done by hand.

After installing, walk through the checks in
[doc 07](07-autosave-durability.md#acceptance-criteria) on the actual device — especially
billing in aeroplane mode and force-stopping the browser right after a sale.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs typecheck, the 93 unit tests and
a build on every push and pull request. Vercel builds independently, so this exists to fail a
PR at the pull request rather than at the deployment.

## Rollback

Vercel keeps every deployment. Promoting an older one from the dashboard rolls the app back
immediately.

Note what a rollback does **not** touch: data on shop devices. The schema in
[doc 02](02-data-model.md) only ever moves forward via `.version(n).upgrade()`, so a rolled-back
build could meet a newer database. Keep that in mind before shipping a schema change — a
migration is much harder to undo than a deployment.
