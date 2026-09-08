# Deploy the Next.js intake on Cloudflare Workers

Public OSC Discovery (`/intake`) runs on its own Worker, **`prescope-intake`**, via [@opennextjs/cloudflare](https://opennext.js.org/cloudflare/get-started). `prescope-intake` / `prescope-submit` are **technical Worker service names** (deploy identifiers) — keep them, and keep `PRESCOPE_*` / `PSC_*` secret key names so existing `wrangler secret` values keep working. That is the supported Next 15 path. Cloudflare’s newer vinext adapter targets Next 16; do not switch this app to vinext until the Next major moves.

This is **not** `prescope-submit`. Keep `workers/prescope-submit/` as the Box orchestration Worker. Power Automate **F1–F2b** stays the live Power Pages path until an explicit cutover (`docs/maker/`). Both tracks can stay live.

```
OSC browser  →  prescope-intake (this Next app)
                    POST /api/submit
                         │  server-only
                         ▼
                 prescope-submit  →  Box
```

Never put secrets in git. Never put `PRESCOPE_SUBMIT_*` in `NEXT_PUBLIC_*` or the browser bundle.

## Wrangler project

| | Intake | Submit |
|--|--------|--------|
| Worker name | `prescope-intake` | `prescope-submit` |
| Config | `wrangler.jsonc` (repo root) | `workers/prescope-submit/wrangler.toml` |
| Command | `npm run deploy` from repo root | `cd workers/prescope-submit && npx wrangler deploy` |
| Public URL | `https://prescope-intake.<account>.workers.dev` | `https://prescope-submit.<account>.workers.dev` |

`workers_dev` is on so the first deploy gets a `*.workers.dev` URL. Custom domain is optional (dashboard later).

## Build locally (no Cloudflare login)

From the repo root, after `npm install`:

```
npm run build
npx opennextjs-cloudflare build
```

`npm run build` is the Next production compile (`next build`). OpenNext runs that same script, then writes `.open-next/` for Workers. `.open-next/` is gitignored.

Preview the Worker runtime on loopback (still no deploy):

```
cp .dev.vars.example .dev.vars
# uncomment and set PRESCOPE_SUBMIT_* if you want the forward to run
npm run preview
```

`next dev` (port 43127) is unchanged for day-to-day UI work.

## Deploy the public intake

1. Log into the owner Cloudflare account (account A):

   ```
   npx wrangler login
   npx wrangler whoami
   ```

   Account creation and OAuth cannot be automated from this repo.

2. Build and deploy from the **repo root** (not `workers/prescope-submit/`):

   ```
   npm run deploy
   ```

   Equivalent: `npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy`.

3. Note the printed `*.workers.dev` URL. That is the public intake host.

4. Set **runtime** secrets on **`prescope-intake`** (values are prompted; they never go in git):

   ```
   npx wrangler secret put PRESCOPE_SUBMIT_WORKER_URL
   npx wrangler secret put PRESCOPE_SUBMIT_SECRET
   ```

   | Secret | Value |
   |--------|--------|
   | `PRESCOPE_SUBMIT_WORKER_URL` | Origin of the already-deployed submit Worker, e.g. `https://prescope-submit.example.workers.dev` (no path). Public URL, stored as a secret so it is not committed and can differ per account. |
   | `PRESCOPE_SUBMIT_SECRET` | Same value already on `prescope-submit` (`Authorization: Bearer`). |

   Optional, only if assessors will use `/assessor` on this public host:

   ```
   npx wrangler secret put PSC_ASSESSOR_KEY
   ```

   Without it, the assessor gate **fails closed** on a non-loopback host (404 / login). That is intended.

   Company mark: see [Company branding on Workers](#company-branding-on-workers). The **deploy-only demo** uses `NEXT_PUBLIC_BRAND_*` at build time. Runtime **`BRAND` + R2/ASSETS** is Path B.

5. Redeploy is not required after `secret put` — Wrangler publishes a new version with the secret. Confirm:

   ```
   curl -sS https://prescope-intake.<account>.workers.dev/intake
   ```

   Submit through the form. The Next process still writes the in-memory store, then forwards `{ answers }` to `prescope-submit` when both secrets are set. The OSC thank-you stays public-only (no Box ids).

If you set secrets in the dashboard instead of the CLI, deploy with `--keep-vars` so Wrangler does not wipe dashboard vars: `npx opennextjs-cloudflare deploy -- --keep-vars`.

## Env vars — where they live

| Name | Intake host | Submit Worker | Notes |
|------|-------------|---------------|--------|
| `PRESCOPE_SUBMIT_WORKER_URL` | Secret on `prescope-intake` | — | Server-only. Blank = skip the forward (local demo). |
| `PRESCOPE_SUBMIT_SECRET` | Secret on `prescope-intake` | Secret on `prescope-submit` | Same shared secret. Never `NEXT_PUBLIC_*`. |
| `PSC_ASSESSOR_KEY` | Optional secret on `prescope-intake` | — | Required off-loopback for `/assessor` and `/api/submissions`. |
| `BRAND` | Runtime var or secret on `prescope-intake` | — | Path B pack id (`acme`). Empty / unset = Scoping (or Path A `NEXT_PUBLIC_*`). Read per request. |
| `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_BRAND_LOGO` | Build-time only | — | Path A deploy-only demo. Inlined at `next build`. Not required once Path B is attached. |
| Box CCG / folder ids | — | `prescope-submit` only | Do not copy Box tokens onto the intake Worker. |

`layout.tsx` calls `loadBrand()` on the server and passes the result through `BrandProvider`. `generateMetadata()` sets the document title and the tab icon: overlay → `GET /api/brand/icon`; otherwise the committed Scoping reticle at `/icon.svg`. Empty `BRAND` does not throw; committed Scoping remains the default unless Path A baked `NEXT_PUBLIC_*` or Path B finds a pack.

## Company branding on Workers

GitHub stays white-label Scoping. Company folders (`org-logos/<id>/`, `brands/<id>/`) are gitignored. **Never commit logos.**

Workerd cannot read those folders. Two supported ways to show a company pack (example **Acme Assessments**) on `prescope-intake`. They can coexist: Path A is rebuild-baked; Path B is a runtime pack. `npm run deploy` is unchanged so Path A is not blocked.

### Path A — deploy-only demo (Admin, now)

Temporary. Does **not** need `BRAND`, R2, or the overlay loader. Name and logo are compiled into the client during `next build`.

1. On the deploy machine only, copy the gitignored logo next to the committed Scoping mark (do not `git add`):

   ```
   cp org-logos/acme/logo.png public/brand/acme.png
   ```

   Extra files under `public/brand/` (everything except `mark.svg`) are gitignored.

2. Export build-time overrides in the same shell as deploy (or Workers Builds variables). Do not commit them:

   ```
   export NEXT_PUBLIC_BRAND_NAME="Acme Assessments"
   export NEXT_PUBLIC_BRAND_LOGO="/brand/acme.png"
   npm run deploy
   ```

3. Confirm `/intake` shows **Acme Assessments** and `/brand/acme.png`. Path A does **not** swap the browser tab icon (that stays the Scoping reticle unless Path B overlay is attached).

To go back to Scoping, omit those env vars and do not copy a customer file into `public/brand/`, then deploy again. This path is rebuild-baked: changing the mark requires another `next build`.

### Path B — runtime `BRAND` + R2 or ASSETS

`loadBrand()` reads **`BRAND=acme`** per request (`force-dynamic`). The pack is **not** inlined via `NEXT_PUBLIC_*`. Empty `BRAND` stays Scoping (Path A still applies if those build vars were set).

Need both: the Worker var **and** the pack attached (R2 or ASSETS). Either one alone stays Scoping.

**1. Set the Worker var** (plain text is enough; secret also works):

```
npx wrangler secret put BRAND
# value: acme
```

Or dashboard → `prescope-intake` → Settings → Variables and Secrets → `BRAND=acme`. If vars are dashboard-managed, deploy with `--keep-vars`. Do **not** put `BRAND=acme` in committed `wrangler.jsonc`.

**2a. R2 (preferred — swap the pack without a rebuild)**

Create a bucket, then bind it (only after the bucket exists; a missing bucket fails deploy):

```jsonc
"r2_buckets": [{ "binding": "BRAND_PACK", "bucket_name": "prescope-brand-pack" }]
```

Upload, then set `BRAND` (no `next build` required after the binding is live):

```
acme/brand.json
acme/logo.png
acme/icon.png    # optional square favicon; generated 123 mark if omitted
```

`brand.json` is the same shape as `org-logos/README.md`. The logo is served from `GET /api/brand/logo`. The tab icon is `GET /api/brand/icon` (pack `icon.png` / `favicon.png`, else a generated navy + silver/gold mark from `shortName`). Do not upload a wide wordmark as the only favicon and expect it to look right at 16×16.

**2b. ASSETS (attach the pack without baking `NEXT_PUBLIC_*`)**

After a normal OpenNext build, copy the gitignored pack into the Worker assets tree, then deploy. This does **not** change `npm run deploy` and does not inline `NEXT_PUBLIC_*`:

```
npx opennextjs-cloudflare build
npm run attach-brand-assets
npx opennextjs-cloudflare deploy -- --keep-vars
```

`attach-brand-assets` copies complete `org-logos/<id>/` (then `brands/<id>/`) into **`.open-next/assets/brand-overlay/<id>/`** (gitignored), including optional `icon.png` / `favicon.png`. The header loads `/brand-overlay/acme/<logo>`. The tab icon is `/api/brand/icon`. Confirm `git status` does not list the pack.

Optional: `npm run prepare-brand` copies into `public/brand-overlay/` before a full rebuild if you want that folder present during `next build`. Not required for Path A.

**3. Check** `https://prescope-intake.<account>.workers.dev/intake` for **Acme Assessments**, either `/api/brand/logo` (R2) or `/brand-overlay/acme/…` (ASSETS), and a tab icon from `/api/brand/icon` (not the navy + gold Scoping reticle). Hard-refresh the tab — browsers cache favicons aggressively.

Workers Builds / GitHub Actions cannot see gitignored packs. Path B from CI needs R2 (or a host that has `org-logos/acme/` and runs `attach-brand-assets`). Do not commit the logo to unblock CI.

### Company handoff

Give the customer `org-logos/<id>/` on a private channel. They keep it local. Path A: copy into `public/brand/` + `NEXT_PUBLIC_*` on that machine’s deploy. Path B: set `BRAND=<id>` and attach via R2 or `attach-brand-assets`. Logos never go in git. A fresh clone without a pack and without Path A env is always Scoping.

## Dashboard clicks still required

Wrangler covers build + deploy + secrets. These stay manual:

1. **Create / pick the Cloudflare account** and complete `wrangler login`.
2. **`wrangler secret put`** (or Workers → *prescope-intake* → Settings → Variables and Secrets) for `PRESCOPE_SUBMIT_WORKER_URL` and `PRESCOPE_SUBMIT_SECRET`.
3. **Custom domain** (optional): Workers & Pages → `prescope-intake` → Settings → Domains & Routes → add a hostname on a zone in the same account. Not required for `*.workers.dev`.
4. **Workers Builds** (optional CI): connect this GitHub repo, set the deploy command to `npm run deploy` (Path A can add `NEXT_PUBLIC_BRAND_*` as **Build** variables). Use `--keep-vars` if runtime vars are dashboard-managed. CI will **not** include `org-logos/` — Path B from CI needs R2 `BRAND_PACK`.
5. **R2 incremental cache** (optional): not required for this SSR intake. To add later, create a bucket and follow [OpenNext caching](https://opennext.js.org/cloudflare/caching). Optional **brand** R2 (`BRAND_PACK`) is Path B — see [Company branding on Workers](#company-branding-on-workers).
6. **Paid Workers** only if the gzip Worker size exceeds the [free plan limit](https://opennext.js.org/cloudflare) (3 MiB gzip). A `wrangler deploy --dry-run` of this app is about **7.1 MiB / 1.4 MiB gzip** (under the free limit). Re-check the `Total Upload` line if dependencies grow.

Do **not** turn off Power Automate F1–F2b from this deploy. Cutover is a separate, explicit step (`docs/cloudflare/README.md` § Cutover).

## Runtime notes on Workers

- Answers in the Next process are still an **in-memory Map**. Isolates do not share it and it does not survive recycling. Durable drops are created by `prescope-submit` → Box when the two secrets are set.
- Assessor `/api/assessor/emass` fill reads `docs/emass/` from disk. That path is for local/Node. Production filled xlsx are produced on `prescope-submit` (`FILL_MODE=container` Track B live; local may use `node`) and land in the **Box drop root** (Track B). Track A / Automate still uses `00 Internal` (`docs/maker/`).
- Middleware is the standard Next.js Edge matcher (assessor gate). Node Middleware (Next 15.2+) is not used and is not supported by the adapter.
- `exceljs` stays a server package for the assessor/local fill. It is the heavy dependency; the submit Worker already documents the same size concern.

## Project files

```
wrangler.jsonc           # name = prescope-intake
open-next.config.ts      # defineCloudflareConfig()
.dev.vars.example        # local preview template (no secrets)
public/_headers          # immutable /_next/static cache
scripts/prepare-brand-overlay.ts   # optional; not on npm run deploy
scripts/attach-brand-assets.ts     # Path B: copy pack (logo + optional icon) into .open-next/assets
src/lib/load-brand.ts              # disk → overlay → R2 / ASSETS; empty BRAND = Scoping
src/lib/brand-icon.ts              # tab icon: overlay → /api/brand/icon; else /icon.svg
src/app/api/brand/icon/route.ts    # pack icon.png or generated shortName mark
workers/prescope-submit/           # unchanged Box Worker
```
