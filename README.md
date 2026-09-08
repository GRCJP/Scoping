# Scoping · OSC Discovery

Public 8-step environment intake so a C3PAO can identify **what is being assessed** (people, sites, where FCI/CUI lives, ESPs, enclave vs enterprise). Not a certification. Not an identifier lookup. The OSC does not log in and is never asked for a CMMC UID.

White-label by default: another C3PAO or company can drop a **local** name and logo pack without forking every string. GitHub, CI, and a fresh clone always look like generic **Scoping**. The intake chrome (navy `#021E47` / `#12366C`, gold `#FBBF24`, Barlow + Public Sans, stepper, fill well) stays as designed — company packs do not restyle the product.

- No OSC account
- Never collect a CMMC UID / CUID
- No LLM in scoring — deterministic red-flag rules only
- OSC never sees go/no-go, red flags, or assessor chrome
- Box is not connected in this app (evidence folders are simulated)
- Do not enter CUI, CMMC UIDs, or SPRS scores

Phase II paused **13 Jul 2026**: new designations are **L1 Self** or **L2 Self** only. DFARS 252.204-7012 remains in force.

## Architecture

First build: Power Pages + Dataverse + Automate + Box in Azure / GCC High. Product path: the same intake UX on Next.js (Worker service name `prescope-intake`) plus a Cloudflare submit Worker (service name `prescope-submit`). Both tracks stay in this repo — the Maker kit and Power Pages HTML are not retired. Short narrative: [`docs/architecture-journey.md`](docs/architecture-journey.md).

## How to run

```
git clone https://github.com/GRCJP/Assessment-Scoping.git
cd Assessment-Scoping
npm install
npm run dev
```

Open http://127.0.0.1:43127

`package.json` pins hostname and port on the `dev` and `start` scripts. To verify a production compile, run `npm run build`.

**Cloudflare (public intake):** Worker **service name** `prescope-intake` (`wrangler.jsonc` at the repo root) is a deploy identifier — keep it. `npm run deploy` builds with OpenNext and publishes to Workers. Set `PRESCOPE_SUBMIT_WORKER_URL` and `PRESCOPE_SUBMIT_SECRET` as **secrets on that Worker** (not in git). Full steps: [`docs/cloudflare/intake.md`](docs/cloudflare/intake.md). The Box Worker `prescope-submit` is separate (`workers/prescope-submit/`). Those names and `PRESCOPE_*` / `PSC_*` secret keys stay stable so existing `wrangler secret` values keep working. Merging this repo does **not** redeploy production.

Answers live in an in-memory Map on the server process. Restarting the server (or a Workers isolate recycle) clears intakes. Durable drops go through `prescope-submit` → Box.

## Company branding

Committed defaults in `src/lib/brand.ts` and `public/brand/mark.svg` are **Scoping only**. Customer logos never ship in this repo. A local pack is gitignored; `git status` stays clean after you add one.

1. Add `org-logos/<id>/brand.json` and a logo file next to it (see `org-logos/README.md`). Fallback: `brands/<id>/`. Example id: `acme`. Prompt: `Use logo acme located in the project org-logos section.`
2. Copy `.env.local.example` to `.env.local` and set `BRAND=acme` (or `NEXT_PUBLIC_BRAND=acme`).
3. Restart the dev server. The intake header, document title, and brand helper use that company's name and logo.

To brand it for someone else later, drop a second folder and change `BRAND`. If the env var is unset, or the pack / json / logo is missing, the app keeps Scoping and does not throw.

Cloudflare Worker service name `prescope-intake`: Workerd cannot see gitignored `org-logos/`. Two paths — a deploy-only demo (`NEXT_PUBLIC_BRAND_*` + a local copy under `public/brand/`), and the runtime `BRAND` + R2/ASSETS loader. Details: [`docs/cloudflare/intake.md`](docs/cloudflare/intake.md) § Company branding.

Do not put theme or color overrides in the pack — navy/gold chrome is the product. Do not commit real customer art.

Optional env vars (still work; a valid pack wins for name + logo):

| Variable | Default | What it changes |
|----------|---------|-----------------|
| `BRAND` / `NEXT_PUBLIC_BRAND` | (empty) | Loads `org-logos/<id>/`, then `brands/<id>/` |
| `NEXT_PUBLIC_BRAND_NAME` | Scoping | Header, titles, footer (when no pack) |
| `NEXT_PUBLIC_PRODUCT_NAME` | OSC Discovery | Product label |
| `NEXT_PUBLIC_C3PAO_LEGAL_NAME` | the C3PAO | Certificate identity / eMASS C3PAO Name |
| `NEXT_PUBLIC_BRAND_LOGO` | `/brand/mark.svg` | Wordmark when no pack |
| `NEXT_PUBLIC_PUBLIC_SITE_URL` | `/` | Exit link on the thank-you page |
| `NEXT_PUBLIC_ASSESSOR_MAILBOX` | assessors@example.com | Simulated assessor email To: |
| `NEXT_PUBLIC_CONTACT_EMAIL` | assessors@example.com | Public thank-you “questions” mailbox |

Copy `.env.example` to `.env.local` if you also need assessor-gate or Box placeholders. Do not change `tailwind.config.ts` or `globals.css` unless you intend to restyle the product.

## Design pack

`docs/design/` holds the locked look of the public intake so a rebuild on another host does not drift.

| File | What it is |
|------|------------|
| `docs/design/DESIGN.md` | Visual spec: tokens, type, chrome, controls, and what not to ship |
| `docs/design/intake.css` | Portable CSS (`.psc-*`) for Power Pages or any host that cannot run this app |
| `docs/design/screenshots/` | Five reference states captured from this app: intro, Company, CUI path, Assets, Review |

Logo is not the design. Swap the mark; leave navy, gold, type, stepper, and pills alone.

## Screens

| Path | Who | What |
|------|-----|------|
| `/` | Public | Redirects to `/intake` |
| `/intake` | Public (no login) | Eight sections: Company, Officials, Providers, Interview roles, CUI path, Assets, Monitoring, Review |
| `/success/[id]` | Customer | Generic thank-you (no server PII lookup). Submit goes here with the id. |
| `/drop/[id]/customer` | Customer | Simulated evidence / **02 Uploads**. No official/TPOC email. **00 Internal** hidden. |
| `/assessor/login` | Internal | Sets the assessor session cookie. Do not put the key in the URL. |
| `/assessor` | Internal | Intake list (assessor chrome — not linked from public pages) |
| `/assessor/[id]` | Internal | Scope brief, four separate eMASS files, three assessment lines, red flags, effort, orchestration log, both emails |
| `/drop/[id]/internal` | Internal | Full DROP tree including **00 Internal** |

Public footer: do not enter CUI, UIDs, or SPRS scores.

## Example environments

`src/lib/samples.ts` has two fixtures for local checks (not shown on the public form):

1. **GCC High enclave** — dedicated GCC High enclave, SSP, inventory, diagram, MFA on remote/privileged, CRM on file. Assessor outcome: **GOOD TO GO**. Customer page does not show that badge.
2. **Red-flag commercial** — no SSP, commercial M365, no MFA, no diagram, ESP without CRM, expects to fix during the assessment, Part 1 said Enclave but the environment is the whole org. Assessor outcome: **NEEDS REVIEW**.

Both consents must be true or submit is rejected (`POST /api/submit`).

## Form spine

Linear. No FCI fork. No CUID field.

1. **Company** — HQ, UEI, OSC, address. We do not ask for a CMMC UID.
2. **Officials** — Assessment Official and Technical POC.
3. **Providers** — MSPs, SOCs, MDRs, or cloud providers.
4. **Interview roles** — whether interview titles can be named. No people or device inventory.
5. **CUI path** — where CUI is stored and how it enters and leaves.
6. **Assets** — CMMC asset categories (32 CFR 170.19).
7. **Monitoring** — continuous monitoring, MFA, ESPs.
8. **Review** — SSP, inventory, POA&M, and two confirmations.

Assessor primary badge: **GOOD TO GO** vs **NEEDS REVIEW** from the not-ready list. OSC never sees it.

## Orchestration (simulated seven beats)

1. Collect (public form)
2. Write + SCOPE (deterministic)
3. Create **empty** DROP under dedicated Scoping parent
4. Apply TEMPLATE: `00 Internal` / `01 Answers` / `02 Uploads` / `03 Scoping call`
5. Email customer (01+02 link)
6. Email assessors (internal brief)
7. Call is confirmation, not discovery

This app does **not** connect to real Box from the browser. Folder trees and emails in the Next process are simulated so a C3PAO can adopt the IA.

**Two orchestration tracks** (both can stay live):

| Track | Who submits | Who creates the Box drop |
|-------|-------------|--------------------------|
| Power Pages | OSC on the tenant form | Power Automate **F1–F2b** (`docs/maker/`) |
| Next.js `/intake` | OSC on this app | Optional Cloudflare Worker when `PRESCOPE_SUBMIT_WORKER_URL` is set |

The Worker (`workers/prescope-submit/`) is server-to-server only: Next `POST /api/submit` forwards `{ answers }` with `PRESCOPE_SUBMIT_SECRET`. The OSC thank-you stays public-only (no Box ids, fill details, or Worker errors). Production hosts the Next app on Cloudflare under Worker service name `prescope-intake` and sets those two values with `wrangler secret put` ([`docs/cloudflare/intake.md`](docs/cloudflare/intake.md)). `.env.example` leaves `PRESCOPE_SUBMIT_WORKER_URL` empty; use your own origin such as `https://prescope-submit.<account>.workers.dev` in local `.env.local` only. The secret stays a blank server-only placeholder. Clear the URL for local/demo without a Worker. Submit Worker setup and curl: [`docs/cloudflare/README.md`](docs/cloudflare/README.md).

## Four eMASS files (assessor only)

One OSC submit produces **four separate** markdown files on `/assessor/[id]`. eMASS needs each template uploaded on its own — do not merge them into one blob. They live in **00 Internal**; the customer folder never gets them. Certificate of CMMC Status is **not** generated from intake (identity can be noted later).

| File | Contents |
|------|----------|
| `Scoping-Guide-{org}.md` | Filled Level 2 Scoping Call Discovery Script |
| `Pre-Assessment-{org}.md` | eMASS v3.9 Pre-Assessment fields the OSC provided; C3PAO contract/dates/fee/C3PAO UID/lead assessor blank |
| `Data-Template-{org}.md` | OSC Information (HQ, UEI, CAGE, sector, officials, ESPs) |
| `Assessment-Results-stub-{org}.md` | OSC Name, SSP stub if given, ESP names, Standards Acceptance hint (FedRAMP High if GCC High/Azure Gov, Moderate if GCC), interview names. No Score, MET/NOT MET, hash, CPN, CMMC UID |

After Submit, code also fills the official **xlsx** from the same answers (`fillEmassXlsxPack` — Pre-Assessment, Required Data OSC, and Assessment Results). **Those filled workbooks** go to the Track B Box drop (or Track A `00 Internal`) — not the blanks in `docs/emass/`. Assessment Results keeps every official v3.9 tab (Assessment, Requirements, Requirement Objectives, OSC SSP(s), …), leaves Score / MET / NOT MET blank, and prefills Requirement Objectives Overall Comments (H) and Findings (P) with the standard assessor boilerplate. Live Box must supply official `CMMC_Level2_AssessmentResults_Template` bytes (`BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID`); the mapper will not upload a Cover stub. Filled xlsx is **CUI (When Filled In)**. Never email it. The Cloudflare Worker (`POST /submit`) calls the same fill and uploads.

```
npm run emass:fill
```

writes Harborline (`?demo=1`) copies under `tmp/emass-demo/`. Assessor harness: `GET /api/assessor/emass?demo=1`.

Banner: **CUI** when identity is filled.

`POST /api/submit` fingerprints `JSON.stringify(answers)` and, if the same fingerprint was stored in the last 60 seconds, returns the existing submission instead of creating a new id (React Strict Mode / double POST).

## API

`POST /api/submit` `{ answers }` → `{ id, path, orchstatus, redirect }` (Next, in-process). When `PRESCOPE_SUBMIT_WORKER_URL` is set, the **server** also `POST`s the same `{ answers }` DTO to the Worker. The browser never sees the Worker URL or secret.

Worker `POST /submit` (shared secret) — Box drop + answers JSON + filled xlsx. See `docs/cloudflare/README.md`.

`GET /api/submissions` list for the console

`GET /api/submissions/[id]` full record (includes SCOPE internals — customer pages do not render those fields)

## Stack

Next.js App Router, TypeScript, Tailwind, shadcn/ui-style primitives (Radix).
