# Cloudflare Workers (intake + submit)

Two separate Workers. Do not reuse names or wrangler files.

| Worker | Config | Role |
|--------|--------|------|
| **`prescope-intake`** | `wrangler.jsonc` (repo root) | Public Next.js `/intake` on Workers via OpenNext. **[Deploy the intake](intake.md).** |
| **`prescope-submit`** | `workers/prescope-submit/wrangler.toml` | Box orchestration (`POST /submit`). This page. |

Two tracks stay in this repo. Deploying one does not turn the other off.

| Track | Path | Box drop |
|-------|------|----------|
| **A — Azure / GCC** | Power Pages / Dataverse / Automate F1–F2b (`docs/maker/`) | Four-folder skeleton (`00 Internal` / `01 Answers` / `02 Uploads` / `03 Scoping call`). Leave those docs intact. |
| **B — Cloudflare** | Next.js intake + this Worker | **One flat drop** under `BOX_DROPS_PARENT_ID`: answers export + **three** filled eMASS xlsx in the folder root. No 00–03 children. |

---

# Submit Worker (Cloudflare + Box)

Technical service name: **`prescope-submit`** — keep it (deploy identifier). Secret key names (`PRESCOPE_SUBMIT_*`, `PSC_*`) stay as-is so existing `wrangler secret` values keep working.

Track B: a Cloudflare Worker that the Next.js intake (or any trusted caller) can `POST` after OSC Discovery. **Box is the protected store.** Intake may run outside the enclave; filled eMASS xlsx enter the protected environment when they land in the **drop root**.

This is the first slice: HTTP API, shared-secret auth, Box folder create + upload (CCG), fill via existing `fillEmassXlsxPack`, mail (`MAIL_PROVIDER=stub` default; `resend` for live send). No Microsoft runtime. Track A (Automate F1–F2b) remains the parallel Azure path — see `docs/maker/`.

| Path | Role |
|------|------|
| Next.js `/intake` + `POST /api/submit` | Public collection (already in this repo). May stay outside the enclave. |
| Worker `POST /submit` | Orchestration (this project). Trusted caller only. |
| Box drop | Protected store. Filled xlsx = **CUI (When Filled In)**. |

The Worker response is for the **trusted caller** (Next server, operator `curl`). Do not forward Box ids, mail stubs, or fill details to the OSC browser. The existing Next thank-you payload stays public-only.

Never put secrets in git. Never call live Box from CI.

## Create the Cloudflare account (manual)

1. Open [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) and create an account (or use an existing sandbox).
2. The intake Worker and this submit orchestrator run on the **free** Workers plan. **Cloudflare Containers / `PRESCOPE_FILL` require Workers Paid** (~$5/mo). The free plan cannot bind Containers. Paid alone does **not** fix multi-xlsx 503s — Containers (or a local Node sidecar) move exceljs off the isolate. Paid still helps orchestrator CPU. Free/demo: `FILL_MODE=node` locally. Production always-on fill = Containers on Paid. See [exceljs / Containers](#exceljs-and-cloudflare-containers).
3. Develop and prove the flow in **this sandbox account**.
4. Later, log into the **owner** account (`wrangler logout` / `wrangler login`), set the same secrets there, and `npm run deploy` (or `wrangler deploy --keep-vars`) again. Do not copy production Box tokens into the sandbox.

Account creation cannot be automated from this repo.

## Install and log in

`src/lib/emass-xlsx.ts` imports `exceljs` from the **repo root** (it is already in the root `package.json`). Install there first, then the Worker package:

```
npm install
cd workers/prescope-submit
npm install
npx wrangler login
```

`cd workers/prescope-submit && npm test` still works if only the Worker `node_modules` has exceljs — tests register a resolve hook that looks in the Worker package, then the repo root.

`wrangler login` opens a browser OAuth to the account you want to deploy to. Confirm with:

```
npx wrangler whoami
```

## Local `wrangler dev`

```
cd workers/prescope-submit
cp .dev.vars.example .dev.vars
# set PRESCOPE_SUBMIT_SECRET=dev-only-change-me
npx wrangler dev
```

Committed `wrangler.toml` `[vars]` default to `BOX_MODE=mock` and `FILL_MODE=container` (Track B live). Local `wrangler dev` overrides `FILL_MODE=node` in `.dev.vars`. Mock Box does not call `api.box.com`.

Health (no secret):

```
curl -s http://127.0.0.1:8787/health
```

Submit (secret required). Body is the same `{ "answers": FormAnswers }` DTO as `POST /api/submit` in the Next app (`src/lib/submit-body.ts`).

```
curl -sS -X POST http://127.0.0.1:8787/submit \
  -H "Authorization: Bearer dev-only-change-me" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{ "answers": { …FormAnswers… } }
EOF
```

Auth also accepts `X-Prescope-Fill-Key: <secret>`. Query `?key=` is ignored.

Admin retries may send `Idempotency-Key` and/or `{ "answers", "drop": { "folderId" } }` (Worker only — see [Admin smoke](#admin-smoke-serial-only)). Public Next intake still sends `{ answers }` only.

`FILL_MODE=node` (local `.dev.vars` / tests) uses the same blanks as `docs/emass/` (bundled as Wrangler Data modules — workerd cannot read the host disk). Live Box file ids override the bundle when set. Node tests fall back to reading `docs/emass/` from disk. Track B live stays `FILL_MODE=container`.

`FILL_MODE=skip` no-ops fill, then writes the flat drop + answers markdown (still fill-then-create order).

## Required configuration

### `[vars]` (wrangler.toml — placeholders, not secrets)

| Name | Purpose |
|------|---------|
| `BOX_MODE` | `mock` (default, CI / local) or `live` |
| `FILL_MODE` | `container` (committed Track B live default) · `node` (local `.dev.vars` / tests) · `skip` |
| `BOX_AUTH_MODE` | `ccg` (implemented) · `jwt` (reserved) |
| `BOX_SUBJECT_TYPE` | `enterprise` (CCG) |
| `BOX_DROPS_PARENT_ID` | OSC Discovery Drops folder id (former `psc_BoxDropsParentId`) |
| `BOX_TEMPLATE_FOLDER_ID` | TEMPLATE folder; used to find blank xlsx by name. Set in the dashboard — do not commit a live id (placeholder `000000000000`) |
| `BOX_PREASSESSMENT_TEMPLATE_FILE_ID` | Optional file id for `CMMC-L2-Pre-Assessment-Form-v3.9.xlsx` |
| `BOX_REQUIRED_DATA_TEMPLATE_FILE_ID` | Optional file id for `Required-Data-OSC.xlsx` |
| `BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID` | **Required for live Assessment Results.** File id of the official CMMC L2 AR v3.9 blank (~163KB; tabs Assessment / Requirements / Requirement Objectives / OSC SSP(s) / … — **no Cover**) in your Templates folder. Prefer this over folder name-match. Live has shipped a Cover stub because the file id was empty and name-match hit `CMMC_Level2_AssessmentResults_Template.xlsx` (in-repo and Box copies of the stub). Name-match of a Cover stub is **rejected**. |
| `MAIL_PROVIDER` | `stub` (default, CI/tests) or `resend` |
| `MAIL_CUSTOMER_TEMPLATE_ID` | Published Resend template **alias or UUID** for `customer_confirmation` only. Default `intake-submission-confirmation`. Not a secret. `internal_box_link` stays plain text. |
| `EMASS_TEMPLATE_ROOT` | Local repo root for `wrangler dev` filesystem templates |
| `FILL_CONTAINER_URL` | HTTP sidecar origin when `FILL_MODE=container` and `PRESCOPE_FILL` is **not** bound. **Production with Containers / `PRESCOPE_FILL`: stay empty forever.** Localhost (or a temporary trycloudflare tunnel) is for local/dev only — do not use trycloudflare as the production fill path. Stay empty in git. |
| `FILL_CONCURRENCY` | `1` (default) · `2` · `3`. Workbooks filled at once. Keep `1` so a single submit does not spike Worker CPU. |

### Secrets (`wrangler secret put` / `.dev.vars` — never commit)

| Name | Purpose |
|------|---------|
| `PRESCOPE_SUBMIT_SECRET` | Shared secret for `Authorization: Bearer` / `X-Prescope-Fill-Key` |
| `BOX_CLIENT_ID` | Box app client id (CCG) |
| `BOX_CLIENT_SECRET` | Box app client secret |
| `BOX_ENTERPRISE_ID` | Box enterprise id (CCG subject) |
| `BOX_JWT_PRIVATE_KEY` | Reserved for JWT/service auth |
| `BOX_JWT_PASSPHRASE` | Reserved |
| `BOX_JWT_PUBLIC_KEY_ID` | Reserved |
| `MAIL_FROM` | Resend From: address (verified domain). Required when `MAIL_PROVIDER=resend`. Owner DNS steps: [resend-sending-domain.md](resend-sending-domain.md). |
| `MAIL_API_KEY` | Resend API key. Required when `MAIL_PROVIDER=resend`. Never log or return. |
| `ASSESSOR_MAILBOX` | `internal_box_link` To:. May be comma- or semicolon-separated. Deploy: `assessors@example.com`. |

```
npx wrangler secret put PRESCOPE_SUBMIT_SECRET
npx wrangler secret put BOX_CLIENT_ID
npx wrangler secret put BOX_CLIENT_SECRET
npx wrangler secret put BOX_ENTERPRISE_ID
npx wrangler secret put MAIL_API_KEY
npx wrangler secret put MAIL_FROM
npx wrangler secret put ASSESSOR_MAILBOX
```

Box folder ids can stay in `[vars]` (they are not credentials). Rotate the submit secret if it ever lands in a client bundle or a screenshot.

## Box app (CCG)

1. [Box Developer Console](https://app.box.com/developers/console) → Create App → **Server Authentication (Client Credentials Grant)**.
2. Authorization: enterprise, with scopes **Read and write all files and folders** stored in Box (least privilege later: a collaboration on the Scoping parent only).
3. Authorize the app as the enterprise admin.
4. Invite the app’s service account as **Co-owner** (or Editor) on the Scoping parent / `OSC Discovery Drops` only. Never on an existing CMMC assessment / CUI library.
5. Paste folder ids into the dashboard (preferred) or `[vars]`. Upload the **blank** UNCLASSIFIED templates into the TEMPLATE folder (or set the file ids): Pre-Assessment, Required-Data-OSC, and the official Box `CMMC_Level2_AssessmentResults_Template` (v3.9; `.xlsx` suffix optional). **Do not** upload the test fixture / Cover stub as that file. **Cloudflare Admin (live):** set `BOX_TEMPLATE_FOLDER_ID` and `BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID` to your Box folder/file ids (never commit live ids), then `npm run deploy` from `workers/prescope-submit` (`--keep-vars`). Confirm the file’s tabs are Assessment, Requirements, Requirement Objectives, Example, OSC SSP(s), Instructions, Glossary, Version History, Lookup Values — not Cover. The official CAC blank is not committed. Live `FILL_MODE=container` POSTs those bytes into `/fill` (`assessmentResultsFromBytesOnly`). Missing or stub-shaped bytes skip Assessment Results. Mock/dev may still use `allowAssessmentResultsStub`.

JWT/service-account apps are documented via the reserved `BOX_JWT_*` secrets. This slice implements **CCG only**. Prefer CCG unless the owner already has a JWT app.

## Deploy

Always use **`--keep-vars`**. Committed `[vars]` are mock/stub placeholders (`BOX_MODE=mock`, `MAIL_PROVIDER=stub`, empty Box folder ids, empty `FILL_CONTAINER_URL`). A bare `wrangler deploy` replaces dashboard Box / mail / fill settings with those empties and wipes a live account. `npm run deploy` in `workers/prescope-submit` already passes `--keep-vars`. Secrets are never deleted by deploy.

Live Cloudflare **free** sandboxes can be blocked at account creation (email verify / Trust & Safety). Until an **owner** Cloudflare account (or another host) is available, keep Power Automate **F1–F2b** live. The prove path is local `wrangler dev` + `BOX_MODE=mock` — do not wait on a personal free-tier deploy.

Sandbox first (when the account can run Workers):

```
cd workers/prescope-submit
npm run deploy
# equivalent: npx wrangler deploy --keep-vars
```

Promote to the owner account later:

1. `npx wrangler logout` then `npx wrangler login` as the owner.
2. Recreate `[vars]` (dashboard preferred) with **that** account’s Box folder ids. Do not commit live ids.
3. `wrangler secret put` each secret again (secrets do not copy between accounts).
4. `npm run deploy` (or `npx wrangler deploy --keep-vars`).
5. Point the **intake host** at the new Worker URL. Production: `wrangler secret put PRESCOPE_SUBMIT_WORKER_URL` and `wrangler secret put PRESCOPE_SUBMIT_SECRET` on **`prescope-intake`** ([intake.md](intake.md)). Local `next dev` still uses `.env.local`. Do **not** put those values in the Next.js client / `NEXT_PUBLIC_*`.

## Next.js wire (optional)

Power Automate **F1–F2b** remains the live Power Pages path. This hook is only the Next.js `/intake` → `POST /api/submit` track so both can run. Host the Next app on Cloudflare under Worker service name **`prescope-intake`** — [intake.md](intake.md).

| Env (server-only) | Role |
|-------------------|------|
| `PRESCOPE_SUBMIT_WORKER_URL` | Worker origin. Blank = skip (local/demo still works). Production: secret on `prescope-intake`. |
| `PRESCOPE_SUBMIT_SECRET` | Same secret as `wrangler secret put PRESCOPE_SUBMIT_SECRET` on `prescope-submit`. |

After a successful in-process store write, Next `POST /api/submit` forwards `{ answers }` (`src/lib/submit-body.ts`) to Worker `POST /submit` with `Authorization: Bearer`. A Worker failure is logged and stamped on the assessor beat; the OSC thank-you still uses the public payload (`id`, `firstName`, `customerLink`, `redirect`) — never Box ids, mail stubs, or secret-bearing errors.

Live sandbox health (no secret):

```
curl -sS https://prescope-submit.example.workers.dev/
# {"ok":true,"service":"prescope-submit"}
```

Wired path (Next server → Worker). Set the two env vars, `npm run dev`, then:

```
curl -sS -X POST http://127.0.0.1:43127/api/submit \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{ "answers": { …same FormAnswers DTO as src/lib/submit-body.ts… } }
EOF
```

Direct Worker (operator / trusted caller only — do not run from the browser):

```
curl -sS -X POST "$PRESCOPE_SUBMIT_WORKER_URL/submit" \
  -H "Authorization: Bearer $PRESCOPE_SUBMIT_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{ "answers": { …FormAnswers… } }
EOF
```

Auth also accepts `X-Prescope-Fill-Key: <secret>`. Query `?key=` is ignored.

## How Track B maps former F1 / F2a / F2b / F2c

Power Automate (Track A) still uses two cloud flows plus a SCOPE child (`docs/maker/03-automate-f1.md`, `04-automate-f2.md`, `docs/scoping-field-map.md`) — leave those docs as the Azure pivot. The Worker is one `POST /submit`. Beats stay named so a later cutover is auditable. **CF product shape is a flat drop**, not the 00–03 skeleton.

| Former | Track A (Automate) | Track B (this Worker) |
|--------|--------------------|------------------------|
| **F1** | Dataverse on-create → empty DROP under `psc_BoxDropsParentId`. Status `DropCreated`. No template, no files, no email. | **After fill succeeds**, create folder `{Customer} - OSC Discovery - {yyyy-MM-dd}` (America/New_York, same sanitize as `src/lib/docs.ts`) under `BOX_DROPS_PARENT_ID`. Track B does **not** mint an empty folder first — that left orphans on FailedFill / Worker 503. |
| **F2a** | Box folder-created → copy TEMPLATE → `00 Internal` / `01 Answers` / `02 Uploads` / `03 Scoping call`. | **Not used.** No four-child folders. `BOX_TEMPLATE_FOLDER_ID` (and the three file ids) only locate **blank** xlsx for fill. `BOX_MODE=mock` invents the same flat folder so demos match live. |
| **F2b** | Write answers (customer-visible) to `01`; scope + eMASS + **filled** xlsx to `00 Internal`. | Call `fillEmassXlsxPack` **first** (same cells as the Next assessor path; `FILL_CONCURRENCY=1` by default). Then create the drop and upload `{Org} - OSC Discovery Answers - {Day}.md` plus the filled workbooks into that same root in one phase. Skip-fill still writes the answers export. If Box create fails after fill, the response is `FailedBox` with **no** folder. If upload fails after create, the Worker best-effort **deletes** the partial drop (or renames it `Failed- …`). |
| **F2c** | Email 1: OSC with 01+02 Box link. Email 2: assessors with 00 + Dataverse. | Confirmation to AO/TPOC — **no Box link** (intake may be outside the enclave). When `MAIL_PROVIDER=resend`, customer mail uses the published template alias `intake-submission-confirmation` (`MAIL_CUSTOMER_TEMPLATE_ID`) instead of subject/text. Internal mail to `ASSESSOR_MAILBOX` — **Box folder URL only**, still plain text. Neither message attaches or links the filled xlsx. `MAIL_PROVIDER=stub` records hooks (CI default). `MAIL_PROVIDER=resend` POSTs via Resend; hooks return `sent` / `failed` without API keys. |

SCOPE / go-no-go still lives in `src/lib/scoring.ts` for the Next assessor console. This Worker slice does **not** write red flags into the answers export or the customer email. Do not add an LLM.

Filled xlsx handling (Track B): **CUI (When Filled In). Box drop only. Never email.** Track A still places filled xlsx in `00 Internal` — that is documented only under `docs/maker/`.

## Running both tracks / later cutover

1. Keep Pages/Dataverse/F1/F2 (Track A) running until you explicitly cut over. Their TEST drop still uses the four-folder ACL check (`docs/scoping-box-claude.md` §5): dummy OSC cannot see `00 Internal`.
2. Prove Track B separately: a Worker TEST drop is **one** folder `{Customer} - OSC Discovery - {date}` containing the answers markdown and (unless `FILL_MODE=skip`) the **three** filled xlsx. Mock and live must match that shape.
3. When Track B should be the only folder factory, turn off F1 (Dataverse on-create) so a Next submit does not also create a second drop.
4. Turn off F2 (Box folder-created). A leftover F2 would copy `00`–`03` onto the Worker’s flat drop.
5. Retire Dataverse as the system of record when the intake no longer POSTs there. Box + the Worker response (and later an assessor store of your choice) replace `psc_oscdiscovery`.
6. Track B customer email never carries a Box URL. Do not mint an open shared link on the drop (filled xlsx are CUI).
7. Leave Power Platform docs in `docs/maker/` as the live Azure track (and the pivot story). New Cloudflare work goes here and in `workers/prescope-submit/`.

Do not connect this Worker’s Box app to an assessment / CUI library. Drops parent stays the dedicated Scoping tree.

## Admin smoke (serial only)

exceljs fill is CPU-heavy. **Do not fire five parallel `POST /submit`s.** Cloudflare will 503 (resource limit). A 503 plus a blind retry used to mint a second folder for the same attempt.

Run **three serial submits**. Wait for each `200` / `502` before the next. `FILL_CONCURRENCY` defaults to `1` (one workbook at a time). That is not a substitute for serial Admin curls.

Same-attempt retry (Worker 503, `FailedFill`, `FailedBox`):

```
# 1) Send a stable key on every try of this attempt
curl -sS -X POST "$PRESCOPE_SUBMIT_WORKER_URL/submit" \
  -H "Authorization: Bearer $PRESCOPE_SUBMIT_SECRET" \
  -H "Idempotency-Key: harborline-retest-1" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{ "answers": { …FormAnswers… } }
EOF

# 2) Or resume the folder from a FailedBox body (only if cleanup could not delete it)
# { "answers": { … }, "drop": { "folderId": "123456789" } }
```

`Idempotency-Key` (1–128 printable ASCII) is remembered in the isolate: a later POST with the same key reuses the folder and skips files that already exist. `drop.folderId` is the durable resume if the isolate recycled. Distinct tests (the clean 3-submit retest) should use **different** keys or omit the header.

Public Next `POST /api/submit` still sends `{ answers }` only. Resume / keys are for the trusted Worker caller (Admin `curl`).

## Security

- **Secret header only.** `PRESCOPE_SUBMIT_SECRET` via `Authorization: Bearer` or `X-Prescope-Fill-Key`. Fail closed if unset. No query-string keys.
- **Box credentials stay on the Worker.** CCG client secret and JWT material are `wrangler secret`s. The Next.js browser bundle must never see them. The existing `PSC_BOX_ACCESS_TOKEN` in `.env.example` is a Next-side placeholder for answers-markdown handoff — do not reuse it in client code; prefer the Worker for production writes.
- **No CORS `*`.** This API is server-to-server. Browsers should not call it.
- **No filled xlsx in HTTP responses or email.** Responses may include Box file **ids** and names for the trusted caller.
- **Do not mint an open shared link on the drop.** Filled xlsx in the root are CUI (When Filled In). Internal mail uses `https://app.box.com/folder/{id}` (login required). Track A still keeps `00 Internal` off the customer share — see `docs/maker/`.
- Responses use `Cache-Control: no-store` and `Strict-Transport-Security` (HSTS).
- CI uses `BOX_MODE=mock`. Do not put live Box tokens in GitHub Actions.
- Track B header / session-login notes: [`docs/security/owasp-track-b.md`](../security/owasp-track-b.md).

## exceljs and Cloudflare Containers

`src/lib/emass-xlsx.ts` uses **exceljs** and the official blanks under `docs/emass/`. That is the only mapping. Do not fork a second spreadsheet map.

`FILL_MODE=node` (local `.dev.vars` / tests) imports that module on the Worker isolate (nodejs_compat is on for `compatibility_date` ≥ 2026-08-04). Live Box file ids override bundled `docs/emass/` blanks. Assessment Results official blank is not committed — live must download it from Box (`BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID`) and POST those bytes into `/fill`. Track B live committed default is `FILL_MODE=container`. The sidecar never reads a disk Assessment Results blank and never builds the Cover stub unless both `EMASS_ALLOW_ASSESSMENT_RESULTS_STUB=1` and the POST opts in.

Live Box never ships the mapping stub. If the official v3.9 blank is missing or the bytes look like Cover / Assessment Information / Record of Assessment, the Worker skips that upload and records `assessmentResultsSkipped`. The Worker also refuses Cover-shaped *filled* sidecar output (stale Assessment-Scoping-redeploy images that still call `createAssessmentResultsStubWorkbook` when they ignore POSTed Box bytes).

**Why live 503s:** filling three workbooks with exceljs is CPU-heavy. Cloudflare resource-limits the Worker isolate. **Workers Paid alone is not the fix** — it buys more orchestrator CPU (auth, Box, JSON) but exceljs still runs on the request path. The architecture fix is `FILL_MODE=container`: Worker accepts submit → `POST /fill` (auth) on a Cloudflare Container (or a **local** Node sidecar) that calls the same `fillEmassXlsxPack` → then Box drop (fill-first). Keep `FILL_CONCURRENCY=1` and serial Admin smokes.

**Workers Paid is required to bind Containers.** Cloudflare Containers / `PRESCOPE_FILL` need the Paid plan (~$5/mo). The free plan cannot bind Containers. Free/demo can keep `FILL_MODE=node` on local `wrangler dev`. Production always-on fill = uncomment the Containers block on Paid and leave `FILL_CONTAINER_URL` empty.

### Admin: production fill (Containers)

Committed `FILL_MODE=container`. Same `PRESCOPE_SUBMIT_SECRET` on Worker and fill process. Never commit secrets.

**Production path — Cloudflare Containers on Workers Paid.** `FILL_CONTAINER_URL` must stay **empty forever** once `PRESCOPE_FILL` is bound. Do **not** point production at trycloudflare or any ephemeral sidecar hostname.

1. Upgrade the account to **Workers Paid**. Docker engine running on the deploy machine.
2. In `workers/prescope-submit/wrangler.toml`, uncomment `[[containers]]` (`class_name = "PrescopeFill"`, `image = "./container/Dockerfile"`, `image_build_context = "../.."`), the `PRESCOPE_FILL` Durable Object binding, and the `v1-prescope-fill` migration. Public clones ship that block commented — that is OK until Paid is on.
3. Dashboard / `[vars]`:

```
FILL_MODE=container
FILL_CONTAINER_URL=
FILL_CONCURRENCY=1
```

Leave `FILL_CONTAINER_URL` empty — the Worker uses `env.PRESCOPE_FILL`. `npx wrangler secret put PRESCOPE_SUBMIT_SECRET` (already required). Set `BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID` so the Worker can POST official blank bytes into `/fill`.

4. From `workers/prescope-submit`:

```
npx wrangler deploy --keep-vars --containers-rollout=immediate
```

`[dev] enable_containers = false` so local `wrangler dev` can override `FILL_MODE=node` in `.dev.vars` without Docker.

### Local / dev sidecar only

A Node sidecar (Docker on localhost, or `node … container/server.ts`) is for **local proof**. A trycloudflare tunnel is also local/dev only — never the production fill path.

```
# repo root
docker build -f workers/prescope-submit/container/Dockerfile -t prescope-fill .
docker run --rm -p 8788:8788 -e PRESCOPE_SUBMIT_SECRET="$SECRET" -e FILL_CONCURRENCY=1 prescope-fill
```

Local `wrangler dev` / `.dev.vars`: `FILL_MODE=container` and `FILL_CONTAINER_URL=http://127.0.0.1:8788` (no trailing `/fill`). The Worker sends `Authorization: Bearer <PRESCOPE_SUBMIT_SECRET>`.

Without Docker: `PRESCOPE_SUBMIT_SECRET=… HOST=127.0.0.1 node --experimental-strip-types workers/prescope-submit/container/server.ts` and the same localhost URL. Do not commit that URL. Do not set it on the production Worker.

Protocol and image notes: `workers/prescope-submit/container/README.md`.

Local proof of the mapper does not require the Worker:

```
npm run emass:fill
```

## Tests

From the repo root (`npm install` so root `node_modules/exceljs` exists), or from `workers/prescope-submit` after that package’s `npm install`:

```
cd workers/prescope-submit
npm test
```

`FILL_MODE=node` loads `src/lib/emass-xlsx.ts`. Node would otherwise resolve `exceljs` only from the repo root; the Worker test hook also accepts `workers/prescope-submit/node_modules/exceljs`.

Covers auth, `{ answers }` JSON shape (shared `parseSubmitBody`), fill-then-create order, no orphan folder on fill failure, idempotent retry (`Idempotency-Key` / `drop.folderId`), `FILL_MODE=container` client (mocked `fetch`), sidecar `/fill` auth, a mock-Box submit that stubs mail, and a Resend unit test that mocks `fetch` (no network). No live Box. Root `npm test` also runs these files.

## Project layout

```
workers/prescope-submit/
  wrangler.toml              # [vars] placeholders
  .dev.vars.example          # secrets template
  src/index.ts               # GET /health · POST /submit · POST /api/submit
  src/auth.ts
  src/box.ts                 # CCG + folders + upload/download
  src/fill.ts                # node | skip | container (HTTP or PRESCOPE_FILL)
  src/prescope-fill.ts       # Cloudflare Containers Durable Object
  src/mail.ts                # stub (default) or Resend (no Box link to OSC; no xlsx)
  src/submit.ts              # fill first → flat drop + answers md + xlsx → mail hooks
  container/                 # Node fill sidecar (Dockerfile from repo root)
  test/
docs/emass/                  # blank UNCLASSIFIED templates (source of fill)
src/lib/emass-xlsx.ts        # fillEmassXlsxPack — do not fork
```
