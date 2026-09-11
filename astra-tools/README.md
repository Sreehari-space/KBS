# Astra Tools

Nine Chrome/Edge extensions and a hosted RevisionDesk workspace. This folder is independent of the KBS retail application.

Public website: https://astra-tools.villanpotter.chatgpt.site

RevisionDesk: https://astra-tools.villanpotter.chatgpt.site/revisiondesk.html

## Local setup

Use Node.js 24 or later. Run npm ci, then node scripts/build.mjs and node scripts/dev.mjs from this folder. The preview runs at http://127.0.0.1:4173/. Run node --test tests/*.test.mjs for checks. Python with Pillow is needed only when regenerating icons.

## Contents

The public folder contains the website, extension-src contains background scripts, extensions contains nine installable packages, and public/downloads contains their ZIPs. RevisionDesk uses the server, db and drizzle folders for hosted persistence. See docs/revisiondesk-business-case.md for the product research.

## Deployment and privacy

The existing .openai/hosting.json identifies the live Astra Tools site; reuse it only when deliberately managing that site. A separate deployment needs its own registration. Hosted RevisionDesk needs DB and BUCKET bindings, migrations and trusted Sites identity headers. Public visitors can browse and download; saved projects require sign-in and remain owner-scoped. Review links grant access to issued proposals. Some interface text still describes the earlier private preview.

This import excludes private .dev.vars, credentials, local SQLite data, temporary files and source Git history. Never commit private signing or payment keys. Keep the current public verification key unchanged for the live deployment.

Pricing remains as in the deployed preview; checkout is disabled. The proposed switch to all-free tools and online promotion is paused.


## ListMatch
Free browser-based CSV comparison: https://astra-tools.villanpotter.chatgpt.site/listmatch.html . Compare two exports by key and value columns, flag duplicate or missing IDs, and export results locally. The storefront also links to KBS at https://kbs-alpha.vercel.app .
