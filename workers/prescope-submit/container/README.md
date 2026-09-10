# Fill sidecar (Cloudflare Containers / Node)

exceljs fill stays **off** the Worker isolate. The mapper is still `src/lib/emass-xlsx.ts` → `fillEmassXlsxPack`. Do not add a second map.

Committed Worker default is `FILL_MODE=container` (Track B live). Local `wrangler dev` overrides to `node` via `.dev.vars`. Tests set `FILL_MODE` themselves (`BOX_MODE=mock` stays the CI default).

Official Assessment Results bytes must be POSTed as `templates.assessmentResults.base64` (Worker downloads Box `BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID`). The container does **not** read a disk Assessment Results blank and **never** invents a Cover stub (`createAssessmentResultsStubWorkbook` is disabled when `assessmentResultsFromBytesOnly` is set). Missing, stub-shaped, or Cover-shaped *filled* bytes skip Assessment Results (`assessmentResultsSkipped`) instead of shipping thin tabs. The Worker also refuses Cover-shaped sidecar output so a stale fill image cannot upload `CUI-Assessment-Results` with a Cover tab. `FILL_CONCURRENCY` defaults to `1` (serial workbooks).

## Protocol

`POST /fill`

```
Authorization: Bearer <PRESCOPE_SUBMIT_SECRET>
Content-Type: application/json

{ "answers": { …FormAnswers… }, "templates": { "assessmentResults": { "base64": "…" } } }
```

`templates` is optional. Live Box **must** send official v3.9 blank bytes (`BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID`). Without them, Assessment Results is skipped — never stubbed. `GET /health` needs no secret.

Response (trusted caller only — filled xlsx is **CUI when filled**; never email it):

```json
{
  "preAssessment": { "filename": "CUI-Pre-Assessment-….xlsx", "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "base64": "…" },
  "requiredData": { "filename": "CUI-Required-Data-OSC-….xlsx", "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "base64": "…" },
  "assessmentResults": { "filename": "CUI-Assessment-Results-….xlsx", "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "base64": "…" }
}
```

## Run locally

From the **repo root** (needs `docs/emass/` + `src/lib/`):

```
PRESCOPE_SUBMIT_SECRET=dev-only-change-me HOST=127.0.0.1 FILL_CONCURRENCY=1 \
  node --experimental-strip-types workers/prescope-submit/container/server.ts
```

Then set **local** Worker `FILL_MODE=container` and `FILL_CONTAINER_URL=http://127.0.0.1:8788` (`.dev.vars` / `wrangler dev` only). Same secret as `PRESCOPE_SUBMIT_SECRET`. Do not set this URL on the production Worker.

## Docker (build context = repo root)

```
docker build -f workers/prescope-submit/container/Dockerfile -t prescope-fill .
docker run --rm -p 8788:8788 \
  -e PRESCOPE_SUBMIT_SECRET=dev-only-change-me \
  -e FILL_CONCURRENCY=1 \
  prescope-fill
```

Point **local** `wrangler dev` at `FILL_CONTAINER_URL=http://127.0.0.1:8788`. Production Containers keep that var empty.

## Cloudflare Containers (production fill)

**Workers Paid required** (~$5/mo). The free plan cannot bind Containers / `PRESCOPE_FILL`. Paid **alone** is not enough — exceljs still runs on the isolate and multi-xlsx fill 503s. Containers (this image) move fill off the isolate. A local Node sidecar / trycloudflare tunnel is for **local/dev only**, not production. Workers Paid still helps orchestrator CPU (Box + JSON).

1. Upgrade to Workers Paid. Uncomment the `[[containers]]` / `PRESCOPE_FILL` / `[[migrations]]` block in `workers/prescope-submit/wrangler.toml` (public clones ship it commented — that is OK).
2. Docker Desktop (or another engine) must be running — `wrangler deploy` builds `container/Dockerfile` with `image_build_context = "../.."` (repo root).
3. Keep `FILL_CONCURRENCY=1`. Serial Admin smokes only.
4. Set vars (dashboard or `[vars]`). **`FILL_CONTAINER_URL` stays empty forever** in production — the Worker uses the `PRESCOPE_FILL` binding:

```
FILL_MODE=container
FILL_CONTAINER_URL=
FILL_CONCURRENCY=1
```

5. Same secret: `npx wrangler secret put PRESCOPE_SUBMIT_SECRET` (already required for `POST /submit`). The Durable Object passes it into the container.
6. Live Assessment Results: set `BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID`. The Worker downloads those bytes and POSTs them to `/fill`.
7. Deploy from `workers/prescope-submit` (`--keep-vars` so committed mock/stub `[vars]` do not wipe dashboard Box/mail/fill settings):

```
npx wrangler deploy --keep-vars --containers-rollout=immediate
```

`[dev] enable_containers = false` so local `wrangler dev` can override `FILL_MODE=node` in `.dev.vars` without Docker.

See `docs/cloudflare/README.md` § exceljs / Containers.
