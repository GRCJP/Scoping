# `prescope-submit` Worker

Cloudflare Worker for Scoping · OSC Discovery → Box. Technical service name `prescope-submit` stays as-is (deploy identifier).

Full setup, secrets, Track B flat Box drop, fill-then-create + idempotent retry, and dual-track notes: **[docs/cloudflare/README.md](../../docs/cloudflare/README.md)**. Automate F1–F2b (Track A) stays in `docs/maker/`. Admin smoke is **serial** — do not run parallel submits (Worker 503). Same-attempt retry: `Idempotency-Key` or `drop.folderId`.

The public Next.js intake is a **different** Worker (`prescope-intake`, `wrangler.jsonc` at the repo root). Do not deploy this package as the intake. Intake hosting: **[docs/cloudflare/intake.md](../../docs/cloudflare/intake.md)**.

```
# From repo root first (exceljs is a root dependency used by src/lib/emass-xlsx.ts)
npm install
cd workers/prescope-submit
npm install
cp .dev.vars.example .dev.vars
npx wrangler login
npx wrangler dev
npm test
npm run deploy
# equivalent: npx wrangler deploy --keep-vars
```

Always deploy with `--keep-vars` (`npm run deploy` already does). Committed `[vars]` are mock/stub placeholders. A bare `wrangler deploy` wipes live dashboard Box / mail / fill settings.

Do not commit `.dev.vars` or real Box / Resend tokens. CI must keep `BOX_MODE=mock` and `MAIL_PROVIDER=stub`.

Live multi-xlsx 503s: **Containers (or a local Node sidecar), not Paid Workers alone.** Cloudflare Containers / `PRESCOPE_FILL` also require **Workers Paid** (~$5/mo) — the free plan cannot bind Containers. Free/demo: `FILL_MODE=node` on local `wrangler dev`. Production always-on fill = uncomment the Containers block on Paid and leave `FILL_CONTAINER_URL` **empty forever**. Do not use trycloudflare as the production path. Same `PRESCOPE_SUBMIT_SECRET`. Steps: [container/README.md](container/README.md) and [docs/cloudflare/README.md](../../docs/cloudflare/README.md).
