# Scoping OSC Discovery — Field Map & Automate Runbook

**Product:** Scoping CMMC OSC discovery (public anonymous questionnaire).
**Audience:** Power Platform / Automate / Box maker. Build from this; do not treat it as a legal memo.
**Date locked:** 2026-08-28 (America/New_York).
**Runtime rules in force:** 32 CFR 170 (CMMC 2.0). Phase II paused **13 Jul 2026** — new designations are **L1 Self** or **L2 Self** only. DFARS 252.204-7012 and Phase I self-assessment remain in force. Primes may still demand a C3PAO commercially. Level 3 is paused for new designations. Scoping = 32 CFR 170.19. **Never collect CUI, CMMC UID values, or SPRS scores.**

**This is a commercial dry-run design kit.** GCC High port is manual later (Power Pages **or** Azure Gov form if unlicensed + Dataverse + Automate + Box FedRAMP service account). Do not treat commercial IDs as GCC High IDs.

**Publisher prefix:** `psc_`
**Table:** `psc_oscdiscovery` / display **OSC Discovery**
**Primary column:** `psc_name` (auto: `{legalname} - {yyyy-MM-dd}`)
**Power Pages:** Anonymous web role, table permission **Create only** (no Read/Write/Append/Delete). No OSC login.
**v1 scoring:** Automate child flow using the decision table in §4. No model/plugin required. If confidence is Low/Uncertain, **still continue** — never block Box or email on scoring.

---

## 0. Automate runbook (do not flatten)

Two Box steps. Two emails. Two documents. Seven beats, in this order. Each beat is a **trigger or a clear output** of the previous beat. Do not merge (1)+(2), do not merge the two Box steps, do not send one combined email, do not stuff the internal brief into the customer answers file.

| # | Beat | What fires it | What it does | Output that the next beat needs |
|---|------|----------------|--------------|---------------------------------|
| 1 | **Collect** | Human, public form | OSC fills **all** discovery on the anonymous form. No meeting required to gather it. No file upload on the form. | Complete `psc_oscdiscovery` payload + submitter email |
| 2 | **Write + SCOPE** | Dataverse **on create** of `psc_oscdiscovery` | Flow **F1** writes/confirms the row, then **immediately** calls child flow **SCOPE**. SCOPE computes internal columns on the **same row**. | Row GUID; `psc_orchstatus = ScopeComputed`; internal scope fields populated |
| 3 | **Create DROP** | End of F1, after SCOPE returns | F1 creates an **empty** Box folder under the Drops parent, name `{Customer} - OSC Discovery - {yyyy-MM-dd}`. Writes `psc_boxdropfolderid` / URL. Sets `psc_orchstatus = DropCreated`. **Stops.** | New Box folder id (the DROP) |
| 4 | **Apply TEMPLATE** | Box **folder created** in the Drops parent (Flow **F2**) | F2 copies/applies the TEMPLATE into that DROP: `00 Internal`, `01 Answers`, `02 Uploads`, `03 Scoping call`. Generates the two documents. Builds the **customer** shared link (01+02 only). Sets `psc_orchstatus = TemplateApplied`. | Folder tree + two files + two URLs |
| 5 | **Email CUSTOMER** | End of F2, customer link exists | Send **email 1** to `psc_submitteremail` with the customer Box link (answers + uploads). Set `psc_orchstatus = CustomerEmailed`. | Customer has a drop to read/upload |
| 6 | **Email ASSESSORS** | End of F2, after email 1 (separate send) | Send **email 2** to the internal assessor mailbox with intake complete + link to the **internal** scope view (Dataverse row + Box `00 Internal`). Set `psc_orchstatus = AssessorsEmailed`. | Assessors can prep without a call |
| 7 | **Confirm later** | Human, after intake | Scoping call is a **quick reference confirmation**, not learning the environment. Notes go in `03 Scoping call`. | Optional status `CallComplete` |

```
PUBLIC FORM  ──create──►  DATAVERSE row
                              │
                              ▼
                         F1: SCOPE (child)
                              │
                              ▼
                         F1: create empty DROP folder
                              │
                              │  (F1 ends)
                              ▼
              F2 ← Box "folder created" in Drops parent
                              │
                              ├─ copy TEMPLATE (00/01/02/03)
                              ├─ write customer ANSWERS doc → 01 Answers
                              ├─ write INTERNAL SCOPE doc  → 00 Internal
                              ├─ customer shared link = 01 + 02 only
                              │
                              ├─ EMAIL 1  customer  (Box drop: answers+uploads)
                              └─ EMAIL 2  assessors (internal scope view)
```

### 0.1 Flows — create these as two flows plus one child

| Artifact | Type | Trigger | Must not do |
|----------|------|---------|-------------|
| **F1** `psc-osc-oncreate-scope-and-drop` | Cloud flow | Dataverse: **When a row is added** → table OSC Discovery | Do not copy the template. Do not email. |
| **SCOPE** `psc-osc-scope-compute` | Child flow | Called by F1 with row GUID | Do not create Box folders. Do not email. Writes internal columns only. |
| **F2** `psc-osc-on-drop-created-template-and-notify` | Cloud flow | Box: **When a folder is created** (Drops parent) **or** Box webhook on that folder | Do not re-run SCOPE unless internal columns are empty (retry path only). Filter: folder name contains `OSC Discovery`. |

**Why two Box steps:** a manually created drop (assessor exception path) still gets the template. Template copy is reusable. Permissions on the TEMPLATE stay read-only to the service account; DROPs get the per-customer collab.

### 0.2 Environment variables (capture again on GCC High; do not copy commercial IDs)

| Name | Purpose |
|------|---------|
| `psc_BoxDropsParentId` | Parent folder that receives empty DROPs |
| `psc_BoxTemplateFolderId` | TEMPLATE with `00 Internal`, `01 Answers`, `02 Uploads`, `03 Scoping call` + placeholder Readmes |
| `psc_BoxServiceAccount` | Box (commercial now; FedRAMP SA on GCC High port) |
| `psc_CustomerLinkItems` | Only `01 Answers` and `02 Uploads` (never `00 Internal`) |
| `psc_AssessorMailbox` | Internal To: (distribution list) |
| `psc_ServiceMailbox` | From: for both emails |
| `psc_DataverseAppUrl` | Model-driven app form URL prefix for the assessor email |
| `psc_Tz` | `America/New_York` — use this for folder/file dates, not UTC |

### 0.3 Box TEMPLATE (source of copy)

```
TEMPLATE - OSC Discovery
├── 00 Internal/          ← NEVER in the customer shared link
│   └── README-internal.txt    (assessor-only; "scope brief lands here")
├── 01 Answers/
│   └── README-answers.txt     (customer-visible)
├── 02 Uploads/
│   └── README-uploads.txt     (no CUI; see §6)
└── 03 Scoping call/
    └── README-call.txt        (agenda/notes later; not required to start)
```

DROP after F2 (name: `{psc_legalname} - OSC Discovery - {yyyy-MM-dd}`):

```
{Customer} - OSC Discovery - {yyyy-MM-dd}
├── 00 Internal/
│   └── {Customer} - OSC Discovery Internal Scope - {yyyy-MM-dd}.docx
├── 01 Answers/
│   └── {Customer} - OSC Discovery Answers - {yyyy-MM-dd}.docx
├── 02 Uploads/
│   └── README-uploads.txt
└── 03 Scoping call/
    └── README-call.txt
```

Optional PDF twins of both DOCX files, same stem. v1 = DOCX only is fine.

**Customer shared link / collab:** invite `psc_submitteremail` as **Editor** (or Viewer+upload) on **`01 Answers` + `02 Uploads` only**. Do **not** collab them on the DROP root if that would expose `00 Internal`. Prefer: collab on 01 and 02, **or** a Box shared link whose item set is 01+02. If Box plan cannot split, put `00 Internal` **outside** the DROP (sibling under an Internal parent) — still triggered by F2, still linked only in email 2. **Never** put the internal brief in `01` or in the customer link.

`03 Scoping call` stays in the DROP for the team. Include it on the customer link only if the C3PAO later wants them to drop call artifacts; **v1 default = not on the customer link.**

### 0.4 Two documents (generate in F2, after template copy)

| Doc | Path | Source columns | Audience |
|-----|------|----------------|----------|
| **Answers** (customer-facing) | `01 Answers/{Customer} - OSC Discovery Answers - {yyyy-MM-dd}.docx` | **Public-form fields only** (§1 sections A–G + submitter). Mirror what they typed. No recommended level, no red flags, no effort, no confidence, no assessor notes. | Customer |
| **Internal scope** | `00 Internal/{Customer} - OSC Discovery Internal Scope - {yyyy-MM-dd}.docx` | SCOPE outputs (§1 `int_*` + selected public fields as evidence). | The C3PAO's assessors |

Word templates: content controls named = logical names. F2: populate → convert → upload. v1 may dump a Markdown/HTML body into DOCX via Encodian / Word Online / OneDrive convert. Keep the two templates separate files in the TEMPLATE or in a SharePoint kit folder.

### 0.5 Two emails (F2, sequential, never combined)

**Email 1 — customer**

- From: `psc_ServiceMailbox`
- To: `psc_submitteremail`
- Subject: `OSC Discovery received — {psc_legalname}`
- Body must include: thank you; Box link to **01 Answers + 02 Uploads**; "this is a copy of what you submitted, not a CMMC assessment"; **do not upload CUI, CMMC UIDs, or SPRS scores** to 02; a short confirmation call comes later; no other OSCs can see this folder.
- Do **not** include: recommended level, red flags, Dataverse URL, `00 Internal` URL, assessor names beyond a generic "our team".

**Email 2 — internal assessors**

- From: `psc_ServiceMailbox`
- To: `psc_AssessorMailbox`
- Subject: `INTAKE {psc_legalname} — {psc_int_reclevel} ({psc_int_confidence})`
- Body must include: `psc_int_infodetermination`; rec level + confidence; three assessment lines (short); red-flag list; effort; Dataverse row URL; Box `00 Internal` URL (and DROP URL); submitter name/email for the confirmation call; note **call is confirmation, not discovery**.
- Do **not** send this to the customer.

### 0.6 Orchestration status (`psc_orchstatus`)

F1/F2 stamp this. Do not skip values.

| Value | Set by |
|-------|--------|
| `Submitted` | Form / Dataverse create (default) |
| `ScopeComputed` | SCOPE child, success |
| `DropCreated` | F1, after Box folder create |
| `TemplateApplied` | F2, after copy + both docs uploaded + customer link minted |
| `CustomerEmailed` | F2, after email 1 |
| `AssessorsEmailed` | F2, after email 2 (happy path end) |
| `StoppedCOTS` | SCOPE, out-of-path; **still run Box + both emails** with stop language in the internal brief |
| `FailedScope` / `FailedBox` / `FailedEmail` | Catch; alert assessors; do not retry blindly |

### 0.7 Failure / retry

- SCOPE fails → stamp `FailedScope`, email assessors only, **do not** create a drop until an assessor re-runs SCOPE (button on the row: "Retry SCOPE + Drop").
- DROP created but F2 does not fire → assessor button "Retry template" (F2 child, folder id in).
- Email 1 fails → do not skip email 2; stamp `FailedEmail` and say which send failed.
- Idempotency: F2 keys on `psc_boxdropfolderid`. If 01 already contains the answers DOCX, do not duplicate; skip to emails if needed.

### 0.8 What this runbook is not

Not a GCC High deployment playbook. Not a C3PAO. Not legal advice. Commercial dry-run first; port connectors and env vars by hand to GCC High.

---

## 1. Dataverse columns

**Conventions**

- Logical names are what makers create. Display names are form labels.
- **Type:** `choice` = local or global choice; `choices` = multi-select; `yesno` = Two Options (Yes=1/No=0); `text` = Single line (4000 if noted); `multiline`; `number`; `datetime` (time-zone independent **date only** unless noted); `email`; `url`.
- **Required** = Power Pages form required (Dataverse can stay "optional" so SCOPE/F2 can patch). Business-required on: `psc_legalname`, `psc_submitteremail`, `psc_consent_nocui`.
- **Section** `sys` = hidden from public form (system + SCOPE + Box).
- Never store CUI, UID **values**, SPRS **scores**, passwords, or document bodies from 02 Uploads.

### 1.1 Global choice sets (create these first)

Option values start at `100000000`. Labels are the only values the form shows.

**`psc_yesnodk`** — Yes | No | Don't know

**`psc_yesnounsure`** — Yes | No | Unsure

**`psc_yesnopartial`** — Yes | Partial / in progress | No

**`psc_role`** — Prime | Subcontractor | Both

**`psc_needfirst`** — Scoping | Readiness | Self-assessment support | Third-party prep

**`psc_7021level`** — Not in the contract / blank | Level 1 (Self) | Level 2 (Self) | Level 2 (C3PAO) | Level 3 (DIBCAC) | Don't know | Other / unclear

**`psc_peopleband`** — 1–10 | 11–50 | 51–200 | 200+

**`psc_emailfileshost`** — M365 Commercial | M365 GCC | M365 GCC High | Google Workspace | On-premises | Mixed | Other

**`psc_consultcomputers`** — OSC computers | Consultant computers | Mixed | Don't know

**`psc_enterprisemode`** — Whole enterprise | Dedicated enclave | Unclear

**`psc_isolatedmixed`** — Isolated | Mixed | Unclear

**`psc_vdiprint`** — No VDI | VDI, download/print allowed | VDI, download/print blocked | Unsure

**`psc_infodetermination`** — FCI only | CUI | Mixed FCI+CUI | Uncertain | Out of path (COTS / no FCI / no CUI)

**`psc_reclevel`** — L1 Self | L2 Self | Stop (out of path)

**`psc_confidence`** — High | Medium | Low

**`psc_effort`** — S | M | L | XL

**`psc_orchstatus`** — Submitted | ScopeComputed | DropCreated | TemplateApplied | CustomerEmailed | AssessorsEmailed | StoppedCOTS | FailedScope | FailedBox | FailedEmail | CallComplete

**`psc_redflag`** (multi-select) — use **exactly** these labels:

1. 7012 but "no CUI"
2. Commercial M365 with CUI path
3. Cloud CUI without FedRAMP Moderate (or equiv)
4. MSP / ESP with no written CRM
5. Whole-enterprise when enclave would shrink
6. Home printers / cabinets / servers in play
7. VDI with download/print treated as out of scope
8. No Affirming Official
9. Treating Phase II pause as a pause of 7012
10. Foreign / international access
11. Multi-entity on one network

### 1.2 Column table

| Logical name | Display name | Type | Section | Required | Notes |
|---|---|---|---|---|---|
| `psc_name` | Name | text (100) | sys | auto | F1 sets `{legalname} - {yyyy-MM-dd}`. Primary column. |
| `psc_orchstatus` | Orchestration status | choice `psc_orchstatus` | sys | no | See §0.6. Default Submitted. |
| `psc_submittedon` | Submitted on | datetime | sys | no | Form or F1; store UTC, display Eastern. |
| `psc_sourcechannel` | Source channel | choice (Power Pages / Azure Gov form / Other) | sys | no | F1 default Power Pages. |
| `psc_scopecomputedon` | Scope computed on | datetime | sys | no | SCOPE stamp. |
| `psc_boxdropfolderid` | Box drop folder id | text (100) | sys | no | F1. Never on customer doc. |
| `psc_boxdropfolderurl` | Box drop folder URL | url | sys | no | Internal. |
| `psc_boxinternalurl` | Box 00 Internal URL | url | sys | no | Email 2 only. |
| `psc_boxcustomerlink` | Box customer link | url | sys | no | Email 1. 01+02 only. |
| `psc_customeremailedon` | Customer emailed on | datetime | sys | no | |
| `psc_assessoreemailedon` | Assessor emailed on | datetime | sys | no | |
| `psc_flowrunurl` | Last flow run URL | url | sys | no | Debug. |
| `psc_legalname` | Legal name | text (400) | A | **yes** | Entity that would be the OSC. No CAGE lookup. |
| `psc_othernames` | Other legal names / DBAs | text (400) | A | no | Comma-separated. Multi-entity → red flag 11 if they also share a network (E/F). |
| `psc_cagecodes` | CAGE code(s) | text (100) | A | no | Comma-separated. **Not** a CMMC UID. |
| `psc_role` | Prime, sub, or both | choice `psc_role` | A | **yes** | Both → treat as prime for flow-down questions. |
| `psc_headcount` | Company headcount (band ok) | text (50) | A | no | Free text so they can say "~80". Not a system count. |
| `psc_dodheadcount` | Headcount touching DoD work | text (50) | A | no | |
| `psc_needfirst` | What they need first | choice `psc_needfirst` | A | **yes** | Intake routing, not a CMMC level. |
| `psc_hascmmcuid` | Already have a CMMC UID? | choice `psc_yesnodk` | A | **yes** | **Yes/No/Don't know only. Do not collect the UID.** |
| `psc_hassprsstatus` | Already have SPRS status posted? | choice `psc_yesnodk` | A | **yes** | **Yes/No/Don't know only. Do not collect the score.** |
| `psc_submittername` | Submitter name | text (200) | A | **yes** | For email greeting + call. Not an Affirming Official. |
| `psc_submitteremail` | Submitter email | email | A | **yes** | Email 1 To:. PII, not CUI. Create-only so it is not enumerable. |
| `psc_submittertitle` | Submitter title | text (200) | A | no | |
| `psc_submitterphone` | Submitter phone | text (50) | A | no | |
| `psc_clause7021present` | DFARS 252.204-7021 present? | choice `psc_yesnodk` | B | **yes** | |
| `psc_clause7021level` | 7021 stated CMMC level | choice `psc_7021level` | B | if 7021 ≠ No | If they pick L2 C3PAO or L3, SCOPE still uses **Self** as the regulatory floor (Phase II pause) and records paper in line 2. |
| `psc_clause7012present` | DFARS 252.204-7012 present? | choice `psc_yesnodk` | B | **yes** | 7012 in force regardless of Phase II pause. |
| `psc_far5220421present` | FAR 52.204-21 present? | choice `psc_yesnodk` | B | no | L1/FCI basic safeguarding. |
| `psc_cotsonly` | COTS-only contractor? | choice `psc_yesnodk` | B | **yes** | |
| `psc_primerequiresc3pao` | Prime requiring C3PAO anyway? | choice `psc_yesnodk` | B | if role ≠ Prime | Commercial demand ≠ regulatory designation. |
| `psc_nextdeadline` | Next award / option / flow-down date | datetime (date only) | B | no | |
| `psc_nextdeadlinenote` | Deadline context | text (400) | B | no | "option period", "new award", "prime flow-down". No SOW paste. |
| `psc_recvnonpublicgov` | Receive non-public government information? | choice `psc_yesnounsure` | C | **yes** | FCI/CUI **existence**, not the information itself. |
| `psc_createnonpublicdeliv` | Create non-public deliverables for DoD? | choice `psc_yesnounsure` | C | **yes** | |
| `psc_seencuimarkings` | Seen CUI / CONTROLLED / DIST B–F / ITAR-EAR / CTI markings? | choice `psc_yesnounsure` | C | **yes** | Ask about **markings**, not to paste marked text. |
| `psc_techdatamilspace` | Technical data with military or space application? | choice `psc_yesnounsure` | C | **yes** | |
| `psc_whotoask` | Who they would ask if unsure | text (400) | C | no | Role/org ("contracts lead at Prime X"), not a CUI owner list. |
| `psc_worktypesentence` | One-sentence work type | text (400) | C | **yes** | e.g. "machine shop making unique parts from DoD drawings". **No** drawing numbers, **no** program nicknames that are CUI, **no** classified program names. |
| `psc_peopleband` | In-scope people band | choice `psc_peopleband` | D | **yes** | Best guess of people who would touch FCI/CUI. |
| `psc_sitecount` | Number of sites | number (whole) | D | no | |
| `psc_sitenotes` | Site notes | text (400) | D | no | City/state only. No facility-security details that are CUI. |
| `psc_wfh` | Work from home in play? | choice `psc_yesnodk` | D | **yes** | |
| `psc_homeprinters` | Home printers used for this work? | choice `psc_yesnodk` | D | if wfh ≠ No | Red flag 6 if Yes. |
| `psc_homecabinets` | Home cabinets / paper storage? | choice `psc_yesnodk` | D | if wfh ≠ No | |
| `psc_homeservers` | Home servers / NAS? | choice `psc_yesnodk` | D | if wfh ≠ No | |
| `psc_foreignpersons` | International locations or foreign persons on the work? | choice `psc_yesnounsure` | D | **yes** | Red flag 10 if Yes/Unsure. Do not collect citizenship lists. |
| `psc_paperusbprint` | Paper, USB, or printing in the workflow? | choice `psc_yesnodk` | D | **yes** | |
| `psc_e1_wherefci` | Where FCI lives (plain words) | multiline | E1 | if FCI-only path | Categories: email, file share, laptops. **No hostnames, IPs, serials, mailbox contents.** |
| `psc_e1_sharedwithbiz` | FCI mixed with general business IT? | choice `psc_yesnodk` | E1 | if FCI-only path | |
| `psc_e2_enterprisemode` | Whole enterprise vs dedicated enclave | choice `psc_enterprisemode` | E2 | if CUI path | |
| `psc_e2_isolatedmixed` | Enclave isolated vs mixed | choice `psc_isolatedmixed` | E2 | if CUI path | |
| `psc_e2_datapath` | Data path in plain words | multiline | E2 | if CUI path | "email in, CAD on workstation, file share out". **No CUI, no filenames of CUI, no IPs.** |
| `psc_e2_spatools` | SPA / security tools (names only) | text (400) | E2 | no | EDR, IdP, backup product names. 32 CFR 170.19 Security Protection Assets. |
| `psc_e2_crmas` | CRMA candidates (plain words) | multiline | E2 | no | Systems that **could** touch CUI but aren't intended to. 32 CFR 170.19. |
| `psc_e2_specialized` | Specialized assets? | choice `psc_yesnodk` | E2 | no | OT, IoT, test equipment, gov-furnished, restricted IS. |
| `psc_e2_specializednotes` | Specialized asset classes | text (400) | E2 | if specialized = Yes | Classes, not inventories. |
| `psc_e2_mobile` | Mobile devices in the CUI path? | choice `psc_yesnodk` | E2 | no | |
| `psc_e2_vdi` | VDI download / print | choice `psc_vdiprint` | E2 | no | Red flag 7 if download/print allowed and they think it is out of scope (assessor confirms on call). SCOPE flags if `VDI, download/print allowed`. |
| `psc_esp_emailfileshost` | Email / files host | choice `psc_emailfileshost` | F | **yes** | |
| `psc_esp_emailfilesnote` | Email / files note | text (200) | F | if Mixed/Other | Tenant type only. No tenant IDs required. |
| `psc_esp_mspadmin` | MSP has admin or log access? | choice `psc_yesnodk` | F | **yes** | |
| `psc_esp_othercloud` | Other cloud apps in the path | multiline | F | no | Product names. No customer data examples. |
| `psc_esp_fedramp` | FedRAMP Moderate (or equiv) if CUI in cloud? | choice `psc_yesnodk` | F | if CUI path | NA: if they pick No on CUI path, SCOPE still flags if host is Commercial. Use Don't know freely. |
| `psc_esp_writtencrm` | Written CRM / SLA with ESP/MSP? | choice `psc_yesnodk` | F | **yes** | Red flag 4 if MSP admin = Yes and CRM = No. |
| `psc_esp_consultcomputers` | Consultants work on whose computers? | choice `psc_consultcomputers` | F | no | |
| `psc_rdy_boundaryssp` | Boundary picture or SSP draft? | choice `psc_yesnopartial` | G | **yes** | Do not upload the SSP on this form. |
| `psc_rdy_systempeoplelist` | System / people list exists? | choice `psc_yesnopartial` | G | **yes** | |
| `psc_rdy_sprsposted` | Anyone posted to SPRS? | choice `psc_yesnodk` | G | **yes** | **No score.** May duplicate A; A = "do you have status", G = "did someone post". Keep both. |
| `psc_rdy_affirmingofficial` | Affirming Official identified? | choice `psc_yesnodk` | G | **yes** | **Do not collect SSN, title-as-PII beyond name optional.** Name optional field below. |
| `psc_rdy_aoname` | Affirming Official name (if any) | text (200) | G | no | Optional. Not a UID. |
| `psc_rdy_doneenough` | "Done enough" target date | datetime (date only) | G | no | Their date, not a DoD deadline. |
| `psc_rdy_snapshot` | Honest snapshot | multiline | G | no | Current-state in their words. Form help text: no CUI, no scores, no UIDs. |
| `psc_rdy_flowdown` | Flow-down to subcontractors | multiline | G | if role = Prime or Both | How they flow 7012/7021. No sub CUI. |
| `psc_consent_nocui` | Confirms nothing submitted is CUI / UID / SPRS score | yesno | G | **yes** | Must be true to submit. |
| `psc_consent_notassessment` | Understands this is not a CMMC assessment | yesno | G | **yes** | |
| `psc_int_infodetermination` | Information determination | choice `psc_infodetermination` | sys / SCOPE | no | Internal doc. |
| `psc_int_reclevel` | Recommended CMMC level | choice `psc_reclevel` | sys / SCOPE | no | Floor for **new designations** = Self. |
| `psc_int_confidence` | Recommendation confidence | choice `psc_confidence` | sys / SCOPE | no | |
| `psc_int_assess_line1` | Assessment type — regulatory floor | multiline | sys / SCOPE | no | Line 1. |
| `psc_int_assess_line2` | Assessment type — what paper says | multiline | sys / SCOPE | no | Line 2. |
| `psc_int_assess_line3` | Assessment type — business rec | multiline | sys / SCOPE | no | Line 3. Stay-self vs voluntary C3PAO. |
| `psc_int_scope_mode` | Scope mode (enterprise vs enclave) | choice `psc_enterprisemode` | sys / SCOPE | no | |
| `psc_int_scope_people` | Scope — people | text (100) | sys / SCOPE | no | Copy of band + headcount. |
| `psc_int_scope_locations` | Scope — locations | multiline | sys / SCOPE | no | |
| `psc_int_scope_systemclasses` | Scope — system classes | multiline | sys / SCOPE | no | |
| `psc_int_l2fivecat` | L2 five-category first pass | multiline | sys / SCOPE | no | 32 CFR 170.19. Blank if FCI-only. |
| `psc_int_esptable` | ESP table | multiline | sys / SCOPE | no | Markdown-ish rows. |
| `psc_int_flowdownsketch` | Flow-down sketch | multiline | sys / SCOPE | no | |
| `psc_int_effort` | Effort | choice `psc_effort` | sys / SCOPE | no | |
| `psc_int_effortdrivers` | Effort drivers | multiline | sys / SCOPE | no | |
| `psc_int_redflags` | Red flags | choices `psc_redflag` | sys / SCOPE | no | |
| `psc_int_redflagnotes` | Red flag notes | multiline | sys / SCOPE | no | One line per flag. |
| `psc_int_scopenotes` | Assessor notes (pre-call) | multiline | sys / SCOPE | no | SCOPE TODOs if Low/Uncertain. |
| `psc_int_stopreason` | Stop reason | text (400) | sys / SCOPE | no | COTS path. |

**Do not create columns for:** CMMC UID, SPRS score, SPRS date of posting, CUI excerpts, classified program names, system IP/hostname inventories, passwords, MFA seeds, contract SOW bodies, NIST 800-171 control-by-control answers, POA&M items, SSP document upload.

**Create-only security:** app user for F1/F2 = Organization Read/Write on this table. Anonymous web role = Create only. Lock `int_*`, `box*`, `orchstatus` off the public form (not even hidden HTML fields).

---

## 2. Branching rules (plain language)

Power Pages: tabs or step visibility. Azure Gov form: the same IFs. Hidden ≠ deleted; skipped E1/E2 fields stay null.

**Hard gates**

1. If `psc_consent_nocui` is No → **cannot submit**. Show: do not put CUI, UIDs, or SPRS scores on this form; call us instead.
2. If `psc_consent_notassessment` is No → **cannot submit**.

**Section B → stop vs continue**

3. If `psc_cotsonly` = Yes **and** Section C would all be No (see rule 6) → **COTS / out of path**. Hide E1, E2, most of D–G except submitter already collected. Still collect D people band? **v1: skip D, E, F, G except consents** if they already answered C as all No. If C is not yet answered, **do not stop until C is complete**.
4. Practical v1 sequence: **A → B → C always.** After C, compute `cui_path` / `fci_only` / `stop` (client-side label only; real SCOPE is F1). Then D always (unless stop). Then E1 **or** E2. Then F, G.

**Section C → information path (client-side, mirrored in SCOPE)**

Let `cui_hit` = any of these is **Yes**: `psc_seencuimarkings`, `psc_techdatamilspace`, **or** `psc_clause7012present` = Yes.

Let `fci_hit` = any of these is **Yes**: `psc_recvnonpublicgov`, `psc_createnonpublicdeliv`, `psc_far5220421present`.

Let `unsure_hit` = any C question is **Unsure**, or 7012/7021 is **Don't know**.

5. If `cui_hit` → **CUI path** (L2 min). Show **E2**, hide E1.
6. If **not** `cui_hit` and **not** `unsure_hit` and (`fci_hit` or they clearly handle FCI) and `psc_cotsonly` ≠ Yes → **FCI-only path**. Show **E1**, hide E2.
7. If `unsure_hit` and not a clean FCI-only → **keep CUI path on**. Show **E2**. **Do not default to L1.**
8. If `psc_cotsonly` = Yes **and** not `cui_hit` **and** not `fci_hit` **and** not `unsure_hit` → **stop (out of path)**. Banner: "This intake looks COTS / no FCI / no CUI. We will still send you a copy of your answers. Our team will confirm. This is not a legal determination."
9. If `cui_hit` **and** `fci_hit` → still CUI path (mixed). E2 only.

**Section B extras**

10. Show `psc_clause7021level` only if `psc_clause7021present` ≠ No.
11. Show `psc_primerequiresc3pao` if `psc_role` is Subcontractor or Both (primes can also answer; keep visible for Both/Prime as optional).

**Section D**

12. Show home printers / cabinets / servers if `psc_wfh` ≠ No.

**Section E**

13. E1 only on FCI-only path.
14. E2 only on CUI path (including Uncertain).
15. `psc_e2_specializednotes` if specialized = Yes.

**Section F**

16. `psc_esp_emailfilesnote` if host is Mixed or Other.
17. `psc_esp_fedramp` required on CUI path; optional on FCI-only (hide on FCI-only).

**Section G**

18. `psc_rdy_flowdown` if role is Prime or Both.
19. `psc_rdy_aoname` if Affirming Official = Yes.

**Never branch to a login, a UID field, a score field, or a file upload.**

---

## 3. Mapping: Answers doc vs Internal scope doc

Legend: **A** = customer Answers DOCX (01). **I** = Internal Scope DOCX (00). **—** = neither (system only).

### 3.1 Customer Answers document (what they answered)

Header: "This is a copy of what you submitted to Scoping on {date}. It is **not** a CMMC assessment, designation, or SPRS posting."

| Block | Fields | A | I |
|-------|--------|---|---|
| Submitter | name, email, title, phone, submittedon | A | I (contact strip) |
| A Who you are | legalname, othernames, cagecodes, role, headcount, dodheadcount, needfirst, hascmmcuid, hassprsstatus | A | I |
| B Contract | all B fields | A | I |
| C FCI vs CUI | all C fields | A | I |
| D People/places/paper | all D fields | A | I |
| E1 / E2 | whichever they saw | A | I |
| F ESPs | all F fields | A | I |
| G Readiness | all G public fields except raw consent booleans may be footnoted "consented" | A | I |
| Consents | yes/no | A (one line) | I |
| Orch / Box URLs | box ids, orchstatus, flow URL | — | — (stay in Dataverse) |
| SCOPE outputs | all `psc_int_*` | **never** | **I** |

Answers doc layout: one heading per section A–G, Q as display name, A as the choice label or text. Null → "—". Do not interpret.

### 3.2 Internal scoping result (assessor brief)

Fixed outline. F2 maps `psc_int_*` into these headings. If SCOPE left a field empty, print `TODO (confirm on call)` — do not invent.

1. **Header** — legal name, CAGE(s), role, needfirst, submittedon, submitter, orch status, Box 00 URL, Dataverse URL.
2. **Information determination** — `psc_int_infodetermination` + confidence.
3. **Recommended CMMC level** — `psc_int_reclevel` + one-line why (from notes).
4. **Assessment type (three lines)**
   - (1) Regulatory floor now — `psc_int_assess_line1`
   - (2) What paper says — `psc_int_assess_line2`
   - (3) Business rec (stay-self vs voluntary C3PAO) — `psc_int_assess_line3`
5. **Scope**
   - Enterprise vs enclave
   - People / locations / system classes
   - L2 five-category first pass (omit if FCI-only / Stop)
   - ESP table
   - Flow-down sketch
6. **Effort** — S/M/L/XL + drivers
7. **Red flags** — selected `psc_redflag` values + notes
8. **Evidence extract** — short quotes from worktypesentence, datapath, snapshot (still not CUI)
9. **Confirmation-call checklist** — generated from Low confidence items + red flags (questions, not new discovery topics)
10. **Stop reason** — only if StoppedCOTS

---

## 4. Scoring notes (SCOPE child flow) — v1 is deterministic, not a model

v1 = Compose + conditions in **SCOPE**. A maker can implement this as a child flow; an assessor can also re-run it. **Manual override:** assessors may edit `psc_int_*` on the row after email 2; do **not** wait for that to send Box/emails.

Recompute `cui_hit` / `fci_hit` / `unsure_hit` as in §2.

### 4.1 Information determination

| If | Then `psc_int_infodetermination` |
|----|-------------------------------|
| Rule 8 stop (COTS, no FCI, no CUI, no unsure) | Out of path (COTS / no FCI / no CUI) |
| `cui_hit` and `fci_hit` | Mixed FCI+CUI |
| `cui_hit` and not `fci_hit` | CUI |
| FCI-only path (rule 6) | FCI only |
| `unsure_hit` or (7012 = Don't know and markings ≠ No) | Uncertain |
| 7012 = Yes and markings = No and techdata ≠ Yes | Still **CUI** or **Uncertain** (not FCI only). Stamp red flag **7012 but "no CUI"**. Prefer **Uncertain** if they insist no CUI; prefer **CUI** if 7012 = Yes. **v1: 7012 = Yes → never FCI only.** |

**Do not default Uncertain to FCI only / L1.**

### 4.2 Recommended level (new-designation floor, 13 Jul 2026 pause)

| Determination | `psc_int_reclevel` |
|---------------|-------------------|
| FCI only | L1 Self |
| CUI or Mixed | L2 Self |
| Uncertain | L2 Self  (CUI path stays on; confidence Low or Medium) |
| Out of path | Stop (out of path) |

Level 3 is **not** a Scoping recommendation while new L3 designations are paused. If paper says L3 / L2 C3PAO, that goes in **line 2**, not the rec level.

### 4.3 Confidence

Start **High**. Drop to **Medium** if any Don't know on 7021/7012/host/FedRAMP. Drop to **Low** if `unsure_hit`, or determination = Uncertain, or worktypesentence length < 20 chars. Stop path = High if C is all No and COTS Yes; else Medium.

### 4.4 Assessment type — three lines (stamp text)

**Line 1 — regulatory floor now** (always say the pause):

- FCI only → `Regulatory floor for new designations (Phase II pause, 13 Jul 2026): CMMC Level 1 (Self). Phase I self-assessment and FAR 52.204-21 remain in force.`
- CUI / Mixed / Uncertain → `Regulatory floor for new designations (Phase II pause, 13 Jul 2026): CMMC Level 2 (Self). DFARS 252.204-7012 and Phase I L2 self-assessment remain in force. New L2 C3PAO / L3 DIBCAC designations are not being made during the pause.`
- Stop → `No CMMC designation indicated from this intake (COTS / no FCI / no CUI). Confirm on call. 7012/7021 still must be re-checked if paper exists.`

**Line 2 — what paper says** (concatenate, skip nulls):

- 7021 present + level label
- 7012 present/absent/DK
- FAR 52.204-21 present/absent/DK
- Prime requires C3PAO anyway (Yes/No/DK)
- Next deadline date/note

Example: `Paper: 7021 present as Level 2 (C3PAO); 7012 present; FAR 52.204-21 DK; prime requiring C3PAO = Yes; next option 2026-11-01.`

**Line 3 — business rec (not legal advice):**

| Conditions | Line 3 |
|------------|--------|
| Stop | `Business rec: confirm out-of-path; do not start an enclave project on this intake alone.` |
| FCI only, no prime C3PAO | `Business rec: stay on L1 Self path; do not buy a C3PAO for this intake.` |
| CUI/Mixed, prime C3PAO ≠ Yes, needfirst ≠ Third-party prep | `Business rec: stay-self for the regulatory floor; keep 7012/NIST 800-171 Rev 2 work moving. Voluntary C3PAO is optional, not required by the current designation pause.` |
| CUI/Mixed **and** (prime C3PAO = Yes **or** needfirst = Third-party prep **or** 7021 level = L2 C3PAO) | `Business rec: regulatory floor is still L2 Self; commercially, plan a voluntary C3PAO (prime demand and/or paper). Pause is not a pause of 7012.` |
| Uncertain | `Business rec: do not assume L1. Confirm information type on the call, then choose stay-self vs voluntary C3PAO.` |

### 4.5 Scope assembly

- **Mode:** copy `psc_e2_enterprisemode` if CUI path; FCI-only → `Whole enterprise` if `psc_e1_sharedwithbiz` = Yes, else Unclear.
- **People:** `{psc_peopleband}; company {psc_headcount}; DoD-touch {psc_dodheadcount}`.
- **Locations:** `{sitecount} sites; {sitenotes}; WFH={wfh}; foreign={foreignpersons}`.
- **System classes:** join non-null of email/files host, E1 where-FCI or E2 data path + SPA + mobile + VDI + paper/USB.

**L2 five-category first pass** (32 CFR 170.19) — CUI path only, **first pass from answers, not an official scope**:

| Category | How v1 fills it |
|----------|-----------------|
| CUI Assets | From `psc_e2_datapath` + email/files host + mobile if Yes |
| Security Protection Assets | `psc_e2_spatools` or "TODO: SPA list" |
| Contractor Risk Managed Assets | `psc_e2_crmas` or "none stated" |
| Specialized Assets | Yes/No + notes |
| Out-of-Scope | "Not declared on form — confirm on call" |

**ESP table** (Markdown in `psc_int_esptable`):

```
| Function | Provider class | CRM/SLA | Notes |
| Email/files | {host} | {writtencrm} | {emailfilesnote} |
| MSP admin/logs | {mspadmin} | {writtencrm} | |
| Other cloud | {othercloud} | | FedRAMP stated: {fedramp} |
| Consultants | {consultcomputers} | | |
```

**Flow-down sketch:** if Prime/Both → `psc_rdy_flowdown` or "Prime/Both; flow-down not described." If Sub → "Sub; watch prime C3PAO demand = {primerequiresc3pao}."

### 4.6 Effort S/M/L/XL

Start **S**. Apply the first matching **floor** (do not add infinitely; use the highest floor then optionally bump one step if 2+ extra drivers).

| Floor | When |
|-------|------|
| S | FCI-only, people 1–10, no WFH home devices, single host GCC/GCC High/on-prem |
| M | People 11–50, **or** CUI enclave isolated, **or** paper/USB, **or** WFH without home servers |
| L | People 51–200, **or** mixed enclave, **or** whole-enterprise CUI, **or** MSP without CRM, **or** Commercial M365 on CUI path, **or** specialized assets |
| XL | People 200+, **or** multi-entity + one network, **or** foreign access + CUI, **or** whole-enterprise CUI **and** mixed **and** no SSP |

Drivers to list (bullet the ones that fired): people band; enterprise vs enclave; isolated vs mixed; ESP complexity; paper/USB; WFH/home assets; multi-site (>1); foreign persons; no boundary/SSP; flow-down present; specialized assets; CRMAs stated; VDI download/print.

### 4.7 Red flags (set multi-select)

| Flag | Fire when |
|------|-----------|
| 7012 but "no CUI" | 7012 = Yes **and** markings ≠ Yes **and** techdata ≠ Yes |
| Commercial M365 with CUI path | CUI/Uncertain path **and** host = M365 Commercial |
| Cloud CUI without FedRAMP Moderate (or equiv) | CUI/Uncertain path **and** host in {M365 Commercial, Google, Mixed, Other} **and** fedramp ≠ Yes |
| MSP / ESP with no written CRM | mspadmin = Yes **and** writtencrm = No |
| Whole-enterprise when enclave would shrink | enterprisemode = Whole enterprise **and** CUI path **and** peopleband ≠ 1–10 |
| Home printers / cabinets / servers in play | any of homeprinters / homecabinets / homeservers = Yes |
| VDI with download/print treated as out of scope | vdi = `VDI, download/print allowed` (call confirms if they claimed out of scope; flag anyway) |
| No Affirming Official | affirmingofficial = No |
| Treating Phase II pause as a pause of 7012 | 7012 = No **and** (cui_hit or markings = Yes) — **or** snapshot/worktype regex `(?i)phase ii (pause|paused)|cmmc (is )?paused|7012 (paused|waived)` |
| Foreign / international access | foreignpersons = Yes or Unsure |
| Multi-entity on one network | `psc_othernames` non-empty **and** (e1_sharedwithbiz = Yes **or** enterprisemode = Whole enterprise **or** isolatedmixed = Mixed) |

Regex is best-effort on v1; assessor can add the flag. Do not parse customer text for CUI.

### 4.8 StoppedCOTS still goes through Box

SCOPE sets `psc_orchstatus = StoppedCOTS` **and** fills line 1–3 / stop reason. F1 **still** creates the DROP. F2 **still** writes both docs (internal says out of path). Both emails **still** send. Customer email adds: "Our team will confirm whether this is out of path."

---

## 5. Box file and folder names

Dates: Eastern `yyyy-MM-dd` of submit (`psc_Tz`). Sanitize `{Customer}` = `psc_legalname` stripped of `\ / : * ? " < > |` and trimmed to 80 chars.

| Item | Pattern |
|------|---------|
| DROP folder | `{Customer} - OSC Discovery - {yyyy-MM-dd}` |
| Answers DOCX | `01 Answers/{Customer} - OSC Discovery Answers - {yyyy-MM-dd}.docx` |
| Answers PDF (optional) | same stem `.pdf` |
| Internal DOCX | `00 Internal/{Customer} - OSC Discovery Internal Scope - {yyyy-MM-dd}.docx` |
| Internal PDF (optional) | same stem `.pdf` |
| Uploads readme (from template) | `02 Uploads/README-uploads.txt` |
| Call readme (from template) | `03 Scoping call/README-call.txt` |
| Call notes (human, later) | `03 Scoping call/{Customer} - Scoping Call Notes - {yyyy-MM-dd}.docx` |

Customer-visible filenames must **not** include "Internal", rec level, or "CUI".

`README-uploads.txt` one-liner: "Upload non-CUI artifacts only (redacted clause screenshots, unlabeled architecture). Do not upload CUI, CMMC UIDs, SPRS scores, or credentials."

---

## 6. What NOT to put on the public form

Do not add fields, uploads, or help-text examples that invite these:

- CUI (or marked text, excerpts, drawings, specs, CUI file dumps)
- CMMC UID **value**
- SPRS **score** (or "estimated score")
- Classified / SAP / CNWDI / NOFORN content; program names that are CUI
- Credentials, tenant IDs required, VPN keys, IP inventories, hostnames as a required list
- SSN / ITIN / citizenship roster / foreign-person names
- NIST 800-171 control-by-control checklist (that's a later engagement)
- Official CMMC assessment result / C3PAO report upload
- OSC login, MFA, or "lookup my SPRS"
- File upload (v1). Uploads happen in Box **02** after email 1, with the no-CUI warning
- Hidden fields for rec level / red flags (those are SCOPE-only)
- Anything that would require a CUI-authorized system to store the answer

Form footer (required copy):

> Do not enter Controlled Unclassified Information, CMMC UIDs, or SPRS scores. This form is anonymous (no OSC account). Submitting it is not a CMMC assessment and not a SPRS posting. The C3PAO will email a Box link for a copy of your answers.

---

## 7. Public form IA (build order)

Single form, one Dataverse create on Submit. Progress: A B C D E F G. Estimated 15–25 minutes. All discovery is here — **no meeting to gather it.**

| Step | Title | Fields |
|------|-------|--------|
| 0 | Notice | Footer copy in §6; consents can live at end |
| A | Who you are | legalname → submitterphone, hascmmcuid, hassprsstatus |
| B | Contract paper | 7021, 7012, FAR 52.204-21, COTS, prime C3PAO, deadline |
| C | FCI vs CUI | six questions + work sentence. Banner for path. Stop banner if COTS out-of-path |
| D | People, places, paper | band, sites, WFH, foreign, paper/USB |
| E1 | FCI systems (short) | where FCI, mixed with biz |
| E2 | CUI enclave | enterprise/enclave, isolated/mixed, path, SPA, CRMA, specialized, mobile, VDI |
| F | External service providers | host, MSP, other cloud, FedRAMP, CRM, consultants |
| G | Readiness | SSP, lists, SPRS posted Y/N/DK, AO, date, snapshot, flow-down, both consents |
| Submit | | Creates row → F1 |

Help text on C: "Tell us whether the **category** exists. Do not paste marked sentences."

---

## 8. GCC High port (manual, later)

Same schema, same two flows, same two emails, same two documents.

| Commercial dry-run | GCC High port |
|--------------------|---------------|
| Power Pages (commercial) | Power Pages on GCC High **or** Azure Gov form posting create-only to Dataverse |
| Dataverse commercial | Dataverse GCC High (recreate table; export solution if it imports, else rebuild from this map) |
| Automate commercial + Box connector | Automate GCC High + Box FedRAMP service account |
| Box commercial TEMPLATE/DROPS ids | New FedRAMP enterprise; recapture env vars; **do not reuse commercial folder IDs** |
| Service mailbox | GCC High / approved mail |

Do not collect CUI in GCC High either — this product stays answers-about-scope, not CUI processing. If a customer needs to send CUI, that is a **different** engagement and a **different** Box environment; this questionnaire must not become that pipe.

---

## 9. Maker checklist (v1)

1. Create choice sets in §1.1, then table `psc_oscdiscovery` with every column in §1.2.
2. Model-driven app (internal only) with all columns; public form with A–G only.
3. Power Pages anonymous **Create** permission; lock `int_*` and `box*` off the form.
4. Word templates: Answers vs Internal Scope, content controls = logical names.
5. Box TEMPLATE folder 00/01/02/03 + readmes. Env vars in §0.2.
6. Child **SCOPE** with §4. Parent **F1** (create + SCOPE + empty DROP). **F2** (template + docs + email 1 + email 2).
7. Test: FCI-only; CUI+7012; 7012-but-no-CUI; COTS stop; Unsure-C; prime C3PAO. Confirm customer link cannot see `00 Internal`.
8. Button on the row: Retry SCOPE, Retry template, Resend email 1, Resend email 2.

---

*Not legal advice. Not a CMMC assessment. Field names are build contracts for Scoping v1.*
