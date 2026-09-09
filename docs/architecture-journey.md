# Architecture journey

Scoping OSC Discovery has **two live tracks**. The first build proved the product inside Azure / GCC High. The product path is now Next.js on Cloudflare plus a submit Worker. This repo keeps both. Do not delete the Maker kit or the Power Pages HTML.

White-label by default: GitHub and a fresh clone look like generic Scoping. Do not treat any `*.workers.dev` URL as a production custom domain.

## The problem

A C3PAO needs the OSC to describe **what is being assessed** before a scoping call: people, sites, where FCI/CUI lives, ESPs, enclave vs enterprise. Today that work is slow, uneven, and then re-typed into eMASS.

| Need | Constraint |
|------|------------|
| Public 8-step intake | No OSC login. Never ask for a CMMC UID / CUID / SPRS score. No CUI on the form. |
| Scoping efficiency | Call is confirmation, not discovery. Deterministic red flags only — no LLM in scoring. |
| eMASS prefill | Same answers fill official Pre-Assessment / Required Data workbooks. Filled xlsx is **CUI (When Filled In)**. |
| Protected store | Box holds the drop. OSC never sees go/no-go, red flags, or `00 Internal`. |

## Track A — Azure / GCC High (folder-tree era)

**Power Pages → Dataverse → Automate F1 / F2a / F2b → Box**

Built to run in a Microsoft tenant (commercial dry-run, then GCC High). Power Pages cannot run this Next.js app, so the public form is a paste port. GitHub cannot create the table or the flows.

```
OSC browser  →  Power Pages (osc-discovery.html)
                    POST Dataverse  psc_oscdiscovery
                         │
                         ▼
                 Automate F1     empty DROP under OSC Discovery Drops
                         │
                         ▼
                 Automate F2a    copy TEMPLATE → 00 Internal / 01 Answers / 02 Uploads / 03 Scoping call
                 Automate F2b    answers + SCOPE + eMASS files into the tree
                 Automate F2c    OSC email (01+02 Box link) + assessor email (00 + outcome)
```

| Piece | Role |
|-------|------|
| Power Pages | Anonymous 8-step form. Create-only on `psc_oscdiscovery`. |
| Dataverse | System of record. Form columns + `psc_int_*` SCOPE fields locked off the form. |
| F1 | Empty folder `{Customer} - OSC Discovery - {yyyy-MM-dd}`. Stop. |
| F2a | Template copy. Four named children. Permission-test TEST first: dummy OSC must not see `00`. |
| F2b | Customer-visible answers in `01`. Scope + filled eMASS in `00 Internal` only. |
| Box | Dedicated Scoping parent. Never an assessment / CUI library. New folder IDs on GCC High — do not copy commercial IDs. |

**What this proved under GCC constraints**

- Anonymous Create-only Dataverse works for no-login intake (OSC cannot enumerate other rows).
- Automate + Box can mint the drop and write files from the tenant without a custom Node host.
- The `00 Internal` vs `01`/`02` split is enforceable. If a dummy OSC can see `00`, stop.
- Deterministic SCOPE (Compose + conditions, no AI Builder) is enough for go/no-go.
- Power Pages is not Node: look ships as `docs/design/intake.css` + a single HTML paste.
- Designer Bot cannot deploy this stack. The paste kit in `docs/maker/` is the delivery vehicle.

F1–F2b stays the live Power Pages path until an explicit cutover. Leave those docs in place.

## Why the pivot

The Microsoft front end was the right first host. It is not the long-term product host.

- **Leave the MS front end** — Pages, Dataverse, and Automate are a tenant paste job. New work should not start there.
- **Company handoff** — a C3PAO can take the Next.js app and the Worker without inheriting a Power Platform solution, environment variables, or GCC High connection references.
- **Same UX on Next.js** — navy/gold chrome, stepper, pills, and the 8-step spine already live in this repo (`docs/design/`). Pages was a port of that IA, not a second product.
- **Simpler Box dump** — Track A’s value was the permission tree. Track B’s product payload is a readable intake export plus the two filled workbooks, not a second copy of TEMPLATE markdown.

## Track B — Cloudflare product path

**Worker service names `prescope-intake` → `prescope-submit` → Box drop** (deploy identifiers, not the product name)

```
OSC browser  →  prescope-intake   (Next.js /intake on Workers via OpenNext)
                    POST /api/submit     server-only
                         │
                         ▼
                 prescope-submit  →  Box
                      answers JSON (readable export)
                      filled Pre-Assessment xlsx
                      filled Required Data xlsx
                      OSC confirm mail (no Box link)
                      internal mail (Box folder link only)
```

| Piece | Role |
|-------|------|
| Worker service name `prescope-intake` | Public form. Repo-root `wrangler.jsonc`. `npm run deploy`. Thank-you stays public-only (no Box ids, fill details, or Worker errors). |
| Worker service name `prescope-submit` | Trusted `POST /submit`. Shared secret. Fills eMASS first (`FILL_MODE=container` Track B live default; local `.dev.vars` may use `node`), then Box CCG drop + upload. Not called from the browser. Serial Admin smokes only (`Idempotency-Key` / `drop.folderId` on retry). |
| Box dump | Readable `{Org} - OSC Discovery Answers - {Day}.json` plus filled `CUI-Pre-Assessment-*.xlsx` and `CUI-Required-Data-OSC-*.xlsx`. Filled workbooks land in `00 Internal` only. Never emailed. |
| Mock Box | Committed default `BOX_MODE=mock`. No `api.box.com` until the company authorizes a CCG app and switches to `live`. |
| Mail | OSC: confirmation only, no Box URL (intake may sit outside the enclave). Internal: Box folder link, no xlsx. `MAIL_PROVIDER=stub` default; `resend` for live send. |

The Worker still **names** the former F1 → F2a → F2b → F2c beats so a Track A cutover stays auditable, and it can still mint the four folder names so `00 Internal` stays off any customer share. The product dump is the export + two workbooks, not a new Automate template.

Intake answers in the Next process are an in-memory Map (cleared on recycle). Durable drops exist only after `prescope-submit` writes Box.

## What stayed shared

The host changed. The contract did not.

| Shared | Where |
|--------|--------|
| Form / questions | `src/components/form/`, `src/lib/path.ts`, `src/lib/beats.ts`, `src/lib/validate.ts`. Pages re-port when these change. |
| eMASS mapping | `src/lib/emass-xlsx.ts` → `fillEmassXlsxPack`. Blanks in `docs/emass/`. Do not fork a second spreadsheet map. |
| Box as protected store | Dedicated Scoping parent. Service account on that parent only. Never an assessment / CUI library. |
| CUI-when-filled | Filled xlsx banner stays. `00 Internal` only. Never in HTTP to the OSC, never in email. |
| Scoring rules | `src/lib/scoring.ts`. OSC never sees GOOD TO GO / NEEDS REVIEW. |
| Design tokens | `docs/design/DESIGN.md` + `intake.css`. Logo is not the design. |

## Where to read more

| Topic | Doc |
|-------|-----|
| Maker paste kit (Track A) | [`docs/maker/README.md`](maker/README.md) — walkthrough, Dataverse, Pages, F1, F2, env vars |
| Power Pages HTML | [`docs/powerpages/README.md`](powerpages/README.md) + [`osc-discovery.html`](powerpages/osc-discovery.html) |
| Box folder contract | [`docs/scoping-box-claude.md`](scoping-box-claude.md) |
| Submit Worker (Track B) | [`docs/cloudflare/README.md`](cloudflare/README.md) · [`workers/prescope-submit/`](../workers/prescope-submit/) |
| Intake Worker deploy | [`docs/cloudflare/intake.md`](cloudflare/intake.md) |
| Resend sending domain (DNS verify) | [`docs/cloudflare/resend-sending-domain.md`](cloudflare/resend-sending-domain.md) |
| eMASS fill | [`docs/emass/README.md`](emass/README.md) |
| Locked look | [`docs/design/DESIGN.md`](design/DESIGN.md) |

**Documented sandbox URLs** (not a custom domain; account-specific `*.workers.dev`):

- Submit health (no secret): `https://prescope-submit.example.workers.dev`
- Intake: `https://prescope-intake.<account>.workers.dev/intake` after `npm run deploy` — see [`intake.md`](cloudflare/intake.md). This repo does not publish a production hostname.

Local UI remains `http://localhost:43127`.
