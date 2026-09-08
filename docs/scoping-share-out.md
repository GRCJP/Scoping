# Scoping OSC Discovery — share-out (form + evidence folders)

Operational contract for a C3PAO that adopts this product. The Next.js App Router app in this repo **is** the public 8-step intake. Evidence folders in the app are simulated. Do **not** connect real Box from this host. Do not collect CUI. Never collect a CMMC UID, SPRS score, or CUI content.

## What this is

Public OSC Discovery form + evidence drop. Not an assessment. Not a CUI library. **No CUID.**

## What this Next.js app does

Eight-step public intake (no login), deterministic scoring, four eMASS stubs on the assessor record. Production C3PAOs run this app (or port the same IA to Power Pages + Dataverse + Automate). The field map in `docs/scoping-field-map.md` is the column contract if they port.

## Order — do in this order

### 1. Evidence folders first

Isolated parent. Not under any assessment / CUI / client evidence library. If root already has `Scoping` with children that are **not** exactly `OSC Discovery Drops` + `TEMPLATE - OSC Discovery`, create `Scoping-DEV` instead and say so. PROD uses `Scoping` only after confirming no collision.

```
All Files
  Scoping/                            # or Scoping-DEV
    OSC Discovery Drops/               # F1 creates empty drops here. Keep empty except TEST.
      TEST - OSC Discovery - 2026-08-28/
    TEMPLATE - OSC Discovery/          # F2 copies these four children. No extra folders.
      00 Internal/     README-internal.txt
      01 Answers/
      02 Uploads/      README-uploads.txt
      03 Scoping call/ README-call.txt
```

Do not pre-create eMASS stubs, a Certificate file, or real customer drops in the template.

**README-internal.txt** — ASSESSOR ONLY. Do not share with the OSC. Receives go/no-go (GOOD TO GO | NEEDS REVIEW, never shown to the customer), internal scope brief, and four separate eMASS files written at submit (do not merge): `Scoping-Guide-{org}.md`, `Pre-Assessment-{org}.md`, `Data-Template-{org}.md`, `Assessment-Results-stub-{org}.md`. No scores, hashes, CPNs, or CMMC UID/CUID. Certificate of CMMC Status is preview-only — not a fifth file. Filled identity is CUI-when-filled.

**README-uploads.txt** — Non-CUI artifacts only (redacted architecture, unlabeled diagrams). No CUI, UIDs, SPRS scores, server names, machine names, file paths, or credentials.

**README-call.txt** — Scoping call notes later. Call is confirmation, not discovery. Discovery was on the public form. No CUI here.

**Service account.** Dedicated evidence-store user (not a CCA login). Co-owner or Editor on **this parent only**. Never invite it onto CUI assessment folders.

**Permission-test TEST before Automate.** Duplicate template into Drops as `TEST - OSC Discovery - 2026-08-28`. Dummy OSC = Editor on **01 + 02 only** (must not see 00 or 03). Assessor on **00 Internal**. Delete TEST when proven. If a customer can see 00, **stop** — do not wire Automate.

F1 name later (do not create now): `{Customer} - OSC Discovery - {yyyy-mm-dd}` (America/New_York). Sanitize `\ / : * ? " < > |`. Cap 80. Example: `Alder Precision - OSC Discovery - 2026-08-28`.

### 2. Dataverse table `psc_oscdiscovery` (optional port)

Display **OSC Discovery**. Prefix `psc_`. Primary `psc_name` auto `{legalname} - {yyyy-MM-dd}`. Anonymous web role: **Create only**. App user for F1/F2: Organization Read/Write.

Columns follow the field map (`FormAnswers`): Company (hqname, uei, oscname, dba, address1/2, city, state, zip, country, businessphone, website, sector, sectorother, employees, hlocage, cageinscope, scopemode, scopedesc); Officials (ao_last/first/title/email/phone, tpoc_*); Providers (has_sps + repeating sps: name, poc, phone, email, enclave, cmmcstatus, sector); People/devices (employees_total, cui_users, interview_roles_namable, interview_role_names, device_classes, devices_workstations/laptops/servers/mobile/home); CUI path (cui_locations, cui_locations_note, cui_host_fedramp rows, cui_flow, cui_leaves_portable, vdi_download_print, cui_off_hq + note, cui_backup_commercial, virtual_tour_exposes_cui, dlp_blocks_screenshare, env_mode, enclave_what, enclave_fedramp, boundary_defined, network_diagram, diagram_vs_matrix, separation); Assets (count_cui_assets, count_spa, count_crma, crma_enforce, crma_handles_cui, specialized_kinds, count_specialized, specialized_notes, count_oos, oos_can_reach_cui, oos_justification); Monitoring (contmon_tool/who/howoften, mfa_solution/coverage/uncovered, esp_kinds/who/csp/fedramp, csp_needs_own_cmmc, esp_crm, vendor_srm_on_file, esp_admin_access, esp_crm_names_inherited, ssp_exists/updated/matches, ssp_artifacts_exist, inventory_exists/current, poam_open/conditional/notes, fix_during_assessment, migrate_during_assessment); Review (consent_nocui, consent_notassessment). Prefix every column `psc_`.

`evidence_share` is **always Box**. System default. **Not a customer question. Do not put it on the form.**

System-only (lock off the form): `psc_orchstatus`, `psc_submittedon`, evidence-store ids/URLs (`psc_boxdropfolderid`, `psc_boxdropfolderurl`, `psc_boxinternalurl`, `psc_boxcustomerlink`), all `psc_int_*` SCOPE outputs (gonogo, reclevel, confidence, three assess lines, red flags, effort). No columns for CUID, SPRS score, CUI excerpts, hostnames, IPs, or file uploads.

### 3. Public form (this repo, or a Power Pages port)

Rebuild or run the **8 steps** from this app. Linear. No FCI fork, COTS stop, login, file upload, company slogan, or demo fills.

1. Company — Company information
2. Officials — Assessment Official and Technical POC
3. Providers — Service providers
4. Interview roles
5. CUI path — How CUI moves
6. Assets — Asset categories
7. Monitoring — Monitoring and access
8. Review — Review and submit

Pills for 2–6 option sets. **Sector** = CISA dropdown (Defense Industrial Base … Other). **CUI locations** = multi-select (M365 GCC High / GCC / Commercial, PreVeil, Azure Government, AWS GovCloud, on-prem, email, Other, N/A). CUI warning **on the form only** (“Do not include CUI”). Exit → the C3PAO public site URL (`NEXT_PUBLIC_PUBLIC_SITE_URL`). Thank-you: **Open evidence folder** (01 + 02 only). Both consents required to submit.

### 4. Automate F1 — `psc-osc-oncreate-drop`

Trigger: Dataverse **When a row is added** → `psc_oscdiscovery`. Create an **EMPTY** folder under `OSC Discovery Drops` named `{Customer} - OSC Discovery - {yyyy-mm-dd}`. Write folder id/URL onto the row. Stamp `DropCreated`. **Stop.** Do not copy the template, email, or write files.

### 5. Automate F2 — `psc-osc-on-drop-created-template-and-notify`

Trigger: folder created in `OSC Discovery Drops` (name contains `OSC Discovery`; ignore TEST). Copy the four TEMPLATE children into the new drop. Then deterministic SCOPE only (Compose + conditions from `runScope` / red-flag list). **No LLM in scoring.** Write:

- `01 Answers` — `{Customer} - OSC Discovery Answers - {yyyy-mm-dd}.md` (public fields only; no outcome, no red flags)
- `00 Internal` — scope brief **plus the four separate eMASS files** named in §1. Do not merge. No scores, hashes, CPNs, CUID.

Share **01 + 02** with the OSC (Editor). Share **00** with assessors only. Never share 00 or 03 with the OSC. No open shared link on 00.

**Customer email** — `OSC Discovery received — {org}`. Thanks; environment info not an assessment; link to 01+02; do not upload CUI/UIDs/SPRS; confirmation call later. **No go/no-go. No red flags. No 00 link.**

**Assessor email** — `INTAKE {org} — GOOD TO GO|NEEDS REVIEW`. Outcome, three assessment lines, red flags, 00 Internal link. Call is confirmation.

### 6. Share-out

Send customers the **public intake URL only**. Do not send `/assessor`, 00 Internal, or Dataverse row URLs.

## Hard rules

- No CUID / UID field / SPRS score field. No LLM in scoring. OSC never sees GOOD TO GO / NEEDS REVIEW.
- Four eMASS files stay separate. Certificate is preview-only, not a fifth download.
- Evidence store must be FedRAMP authorized or equivalent when connected. The form itself is **not** the CUI store.
- Never invite the Scoping service account onto existing CUI assessment folders.
- This Next.js app does not connect real Box.

## Interim

If GCC High is not ready: keep the Next.js intake (in-memory drops) or build in commercial Power Platform + a commercial DEV parent, then port by hand (new env vars, folder IDs, connections). Do not copy commercial IDs into GCC High.

## When done, report

Parent name (`Scoping` vs `Scoping-DEV`) and ACCOUNT. Folder IDs + URLs for parent, Drops, Template, four template children, TEST (or deleted). Service-account collab or skipped. Permission test PASS / FAIL / SKIPPED. If ported: Dataverse table + environment, Power Pages form URL (the only customer URL), flow names F1 / F2 and env vars `psc_BoxDropsParentId`, `psc_BoxTemplateFolderId`. Anything refused (root folder names only, no contents).
