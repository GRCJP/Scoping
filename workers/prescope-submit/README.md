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
npx wrangler deploy
```

Do not commit `.dev.vars` or real Box / Resend tokens. CI must keep `BOX_MODE=mock` and `MAIL_PROVIDER=stub`.

Live multi-xlsx 503s: **Containers (or a Node sidecar), not Paid Workers alone.** Committed Track B default is `FILL_MODE=container`. Local `wrangler dev` overrides to `node` via `.dev.vars`. Set `FILL_CONTAINER_URL` in the dashboard or at deploy time — do not commit an ephemeral sidecar hostname, and re-set the URL after a code-only deploy if wrangler.toml blanks it. Empty `FILL_CONTAINER_URL` is correct when `PRESCOPE_FILL` is bound. Same `PRESCOPE_SUBMIT_SECRET`. Steps: [container/README.md](container/README.md) and [docs/cloudflare/README.md](../../docs/cloudflare/README.md).
