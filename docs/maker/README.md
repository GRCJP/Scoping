# Scoping maker kit

Paste-and-build files for Power Pages + Dataverse + Automate. **F1–F2b stays the live Power Pages path** — do not turn those flows off for this Worker wire.

The Next.js `/intake` demo path can also call the Cloudflare Worker (`PRESCOPE_SUBMIT_WORKER_URL`) — [`../cloudflare/README.md`](../cloudflare/README.md). Host that Next app on Cloudflare as `prescope-intake` — [`../cloudflare/intake.md`](../cloudflare/intake.md). Both tracks can run. IA source is the Next.js app.

These maker files stay as the Power Platform cutover reference. Do not start new F1/F2 work.

Start here: **[00-walkthrough.md](00-walkthrough.md)**.

| File | Studio |
|------|--------|
| [00-walkthrough.md](00-walkthrough.md) | Order and first screens |
| [01-dataverse.md](01-dataverse.md) | Choice sets + columns |
| [02-power-pages.md](02-power-pages.md) | 8-step form paste list |
| [03-automate-f1.md](03-automate-f1.md) | Empty DROP only |
| [04-automate-f2.md](04-automate-f2.md) | Template, SCOPE, files, emails |
| [05-env-vars.md](05-env-vars.md) | Box IDs after you create folders |

Box tree (create yourself): `../../scoping-box-claude.md` §3–4.

Ignore `../../scoping-field-map.md` for columns and branching (older A–G). Tenant Claude can still execute `../../scoping-share-out.md` if you want an in-tenant agent; Designer Bot cannot deploy from this repo.
