# Automate F2 — `psc-osc-on-drop-created-template-and-notify`

Build F2 **only after** the TEST drop permission check passes (dummy OSC cannot see `00 Internal`).

First screen: **Create** → **Automated cloud flow** → Box trigger **When a folder is created** on parent **`psc_BoxDropsParentId`**.

## Trigger

- Box: folder created in `OSC Discovery Drops`
- Condition immediately:
  - Name **contains** `OSC Discovery`
  - Name **does not contain** `TEST` (case-insensitive)
  - If fail → Terminate Succeeded (ignore)

## Lookup the Dataverse row

- List rows `psc_oscdiscovery` where `psc_boxdropfolderid` eq the new Box folder id
- If none (manual drop): still apply template, but skip emails that need `psc_ao_email` unless you find the row another way
- Happy path: one row, `orchstatus` = `DropCreated`

## Beat 4 — Apply TEMPLATE

1. Box **Copy folder items** (or copy each child) from **`psc_BoxTemplateFolderId`** into the new drop.
   - Must result in exactly: `00 Internal` · `01 Answers` · `02 Uploads` · `03 Scoping call`
   - Do not add extra folders. Do not copy eMASS stubs (template should not have them).
2. Get child folder ids: `Folder00`, `Folder01`, `Folder02`, `Folder03`
3. Idempotency: if `01 Answers` already contains `*OSC Discovery Answers*`, skip file writes; continue to share/email if needed.

## Beat 2 (in F2) — Deterministic SCOPE

**No LLM. No AI Builder. No GPT connector.** Compose + conditions only. Source: demo `src/lib/scoring.ts` → `runScope` / `collectRedFlags`.

Initialize array `RedFlags` (empty). Append a label when the condition fires. Labels must match `psc_redflag` exactly.

| If | Then append |
|----|-------------|
| `psc_ssp_exists` ≠ Yes | No SSP |
| `psc_ssp_exists` is Yes **or** Partial / in progress **AND** `psc_ssp_artifacts_exist` ≠ Yes | SSP claimed without supporting artifacts |
| `psc_inventory_exists` ≠ Yes | No asset inventory with categories |
| `psc_boundary_defined` ≠ Yes **OR** `psc_network_diagram` ≠ Yes | No network diagram / CUI boundary unidentified |
| ESP listed (`psc_has_sps` = Yes **OR** `psc_esp_kinds` has a value other than None) **AND** `psc_esp_crm_names_inherited` ≠ Yes **AND** ≠ N/A | ESP without CRM |
| Any selected CUI host that is not on-prem / N/A has FedRAMP = `Not authorized` **or** `SPD only` | CSP holding CUI without FedRAMP Moderate/equiv |
| `psc_cui_locations` contains a gov path (M365 GCC High, PreVeil, Azure Government, AWS GovCloud) **AND** contains `M365 Commercial` | Mixed GCC High and Commercial CUI hosts |
| `psc_mfa_coverage` = Not enforced **OR** Some accounts only | No MFA on remote/privileged |
| `psc_fix_during_assessment` = Yes | Expects to fix gaps during the assessment |
| `psc_scopemode` = Enclave **AND** `psc_env_mode` = Broader environment | CUI across whole enterprise with no enclave when they thought they had one |
| `psc_scopemode` = Enclave **AND** CUI locations include M365 Commercial or Email (non-PreVeil) **AND** no gov path | same flag |
| `psc_crma_handles_cui` = Yes | CRMA is actually a CUI Asset |
| `psc_oos_can_reach_cui` = Yes | Claimed OOS can still reach CUI |
| `psc_esp_admin_access` = Yes **AND** `psc_esp_crm_names_inherited` ≠ Yes | ESP access without a CRM that names inherited vs OSC-owned |
| `psc_cui_backup_commercial` = Yes | CUI backups in a commercial location |
| `psc_migrate_during_assessment` = Yes | Migration or freeze planned during the assessment window |

Optional (demo also tracks these in notes; add if you want them on the multi-select):

| If | Then append |
|----|-------------|
| `psc_cui_leaves_portable` = Yes | CUI leaves on paper/USB/printer |
| `psc_vdi_download_print` = Yes | VDI can download or print |

Deduplicate the array.

**Go / no-go**

```
if empty(RedFlags) then GOOD TO GO else NEEDS REVIEW
```

**Determination**

- If `psc_env_mode` in {GCC High tenant, PreVeil, Other named enclave} **OR** CUI locations include a gov path → `Dedicated CUI enclave (L2 environment)`
- Else if `psc_env_mode` = Broader environment **OR** `psc_scopemode` = Enterprise → `Enterprise CUI environment (L2)`
- Else → `L2 environment (confirm on call)`

**Confidence**

- 3+ flags → Low
- 1–2 flags → Medium
- 0 flags **AND** `psc_ssp_matches` = Yes **AND** `psc_inventory_current` = Yes → High
- Else → Medium

**Effort** start 0

- +2 if Enterprise **or** Broader environment
- +1 per red flag
- +2 if CUI users (or employees) > 50
- +1 if CUI users > 15
- ≥6 XL · ≥4 L · ≥2 M · else S

**Three lines** (Compose, then write to `psc_int_assess_line1/2/3`):

Line 1:

```
What is being assessed: {scopemode} · {env_mode}. CUI lives in {cui_locations}. People who access CUI: {cui_users}.
```

Line 2:

```
Boundary defined: {boundary_defined}. Network diagram: {network_diagram}. Separation: {separation}. FedRAMP: {each host: auth}. MFA: {mfa_solution} ({mfa_coverage}). Paper/USB/home: {cui_leaves_portable}. VDI download/print: {vdi_download_print}.
```

Line 3 if GOOD TO GO:

```
Call is confirmation: walk CUI flow, asset counts, and evidence-share path. Primary outcome: GOOD TO GO.
```

Line 3 if NEEDS REVIEW:

```
Call is confirmation of red flags ({join flags with "; "}). Primary outcome: NEEDS REVIEW. Do not treat this as a certification.
```

**L2 five-category** (multiline):

```
CUI Assets: {count_cui_assets}
SPA: {count_spa}
CRMA: {count_crma} ({crma_enforce}) — can handle CUI even by accident: {crma_handles_cui}
Specialized (GFE/OT/IoT/test): {specialized_kinds} {specialized_notes}
Out of scope: {count_oos} — can still reach CUI: {oos_can_reach_cui} — {oos_justification}
```

**ESP table:** one bullet per `psc_oscdiscovery_sp` child, plus ESP kinds / CRM / admin lines from E4.

Patch the Dataverse row: all `psc_int_*`, `psc_orchstatus` = `ScopeComputed` then continue (do not stop).

## Beat 4 continued — write files

Sanitize `{Org}` the same way as F1 (80 chars, no `\ / : * ? " < > |`).

`{Day}` = Eastern `yyyy-MM-dd` of submit.

### `01 Answers` — customer-visible

Filename: `{Org} - OSC Discovery Answers - {Day}.md`

Body: public fields only. **No** gonogo, red flags, effort, confidence, Box ids, Dataverse URLs.

Header to paste:

```
# OSC Discovery Answers

This is a copy of what you submitted to Scoping on {long Eastern datetime}. It is environment information so we can identify **what is being assessed**. It is **not** a CMMC assessment, designation, identifier lookup, or SPRS posting.

The Box folder (01 Answers + 02 Uploads) is for evidence and is FedRAMP authorized or equivalent.
```

Then one heading per step, Q = display name, A = choice label or text, blank → `—`. Include “Evidence share method: Box (required)”. Do not include consent raw text beyond “consented”.

### `00 Internal` — assessor only — **five files, not one blob**

1. `{Org} - OSC Discovery Internal Scope - {Day}.md` — outline from demo `internalMarkdown`: Header, Outcome (**GOOD TO GO** or **NEEDS REVIEW**), three lines, scope, red flags, confirmation-call checklist.
2. `Scoping-Guide-{Org}.md`
3. `Pre-Assessment-{Org}.md`
4. `Data-Template-{Org}.md`
5. `Assessment-Results-stub-{Org}.md`

Do **not** merge the four eMASS files. Do **not** write a Certificate file. No scores, hashes, CPNs, CUID. Filled identity is CUI-when-filled — keep 00 off the customer share.

eMASS body: use the demo generators in `src/lib/emass.ts` as the field list (Prefill from OSC answers; leave C3PAO contract/dates/fee/C3PAO UID/lead assessor blank). If v1 is too heavy, write structured markdown with those headings and `TODO (confirm on call)` for blanks — still **four separate files**.

**Pre-Assessment xlsx:** after Submit, call `fillEmassXlsxPack(answers)` in `src/lib/emass-xlsx.ts` and upload **those filled bytes** to `00 Internal` (`CUI-Pre-Assessment-{org}.xlsx` and `CUI-Required-Data-OSC-{org}.xlsx`). Do **not** upload the blank templates from `docs/emass/`. Filled files are **CUI (When Filled In)**. Never email them. Production upload is the Cloudflare Worker (`docs/cloudflare/README.md`), not this Automate flow.

Do **not** write outcome into `01` or `02`.

Stamp `psc_orchstatus` = `TemplateApplied`.

## Beat 5–6 — share, then two emails

**Share (least privilege)**

- Invite `psc_ao_email` as **Editor** on **`01 Answers` and `02 Uploads` only**
- Invite `psc_AssessorMailbox` (or assessor group) as Editor on **`00 Internal`**
- Never invite the OSC to 00, 03, the drop root (if root would expose 00), or the template
- No open shared link on 00
- Write `psc_boxinternalurl` (00) and `psc_boxcustomerlink` (01+02 shared link **or** a short note that collab email is the access path)

If Box cannot split the share, put `00 Internal` **outside** the drop (sibling under an Internal parent) and link it only in email 2.

**Email 1 — customer**

- From: `psc_ServiceMailbox`
- To: `psc_ao_email`
- Subject: `OSC Discovery received — {oscname}`
- Body (paste):

```
Thank you. We received the OSC Discovery questionnaire for {oscname}.

This is a copy of what you submitted, not a CMMC assessment. It is environment information so Acme Assessments can identify what is being assessed.

Your Box folder (01 Answers + 02 Uploads) is for evidence and is FedRAMP authorized or equivalent:
{psc_boxcustomerlink}

Do not upload CUI, CMMC UIDs, or SPRS scores. A short confirmation call comes later. No other OSCs can see this folder.
```

- Do **not** include: go/no-go, red flags, Dataverse URL, 00 Internal, assessor names
- Stamp `psc_orchstatus` = `CustomerEmailed`

**Email 2 — assessors** (always send even if email 1 failed; then stamp `FailedEmail` and say which)

- From: `psc_ServiceMailbox`
- To: `psc_AssessorMailbox`
- Subject: `INTAKE {oscname} — {GOOD TO GO|NEEDS REVIEW}`
- Body (paste):

```
Outcome: {psc_int_gonogo}
Determination: {psc_int_infodetermination} ({psc_int_confidence})

Line 1: {psc_int_assess_line1}
Line 2: {psc_int_assess_line2}
Line 3: {psc_int_assess_line3}

Red flags: {join or "none"}
Effort: {psc_int_effort}

Record: {psc_DataverseAppUrl}{row id}
Box 00 Internal: {psc_boxinternalurl}
DROP: {psc_boxdropfolderurl}
Assessment Official: {ao_first} {ao_last} <{ao_email}>

Call is confirmation, not discovery.
```

- Stamp `psc_orchstatus` = `AssessorsEmailed`

## Must not do

- LLM / AI Builder in scoring
- Share 00 or 03 with the OSC
- Put go/no-go on the customer email or answers file
- Create folders under the CUI assessment library
- Connect this Box connection to Grok / Designer Bot
