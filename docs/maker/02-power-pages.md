# Power Pages — 8-step public form

## Public site is /intake only (or Home, if Intake was deleted)

Anonymous visitors get one product URL. On GitHub / studio preview that is **`/intake`**. Root `/` and leftover starter Home must not be a second site.

**Live Power Pages may already host the questionnaire on Home** (Intake page deleted). If `/intake` 404s, **do not** paste the `home.html` bounce-to-/intake. Keep `docs/powerpages/osc-discovery.html` on whichever page already has the form.

When Intake exists:

1. **Pages** → **Intake** exists at partial URL `intake`. That page is the questionnaire (`docs/powerpages/osc-discovery.html`).
2. **Website** record → **Home Page** = Intake if the maker UI allows, so `/` serves intake without a bounce. If you cannot point Home Page at Intake **and** `/intake` exists, paste `docs/maker/pages-look/home.html` as the Home body (redirect only).
3. **Sitemap**: only the page that hosts the form. Do not list About or Profile as public nav.
4. **Header** web template: no menu (hide header/footer nav so Home/About/Profile are not linked).
5. Unpublish or restrict leftover starter pages (Profile, Search, default Home content).

Anonymous can only reach the questionnaire (and thank-you if used). Thank-you is not a public nav page.

First screen: **Power Pages studio** → your site → **Set up** → **Multistep forms** → **New**. Bind to table **OSC Discovery** (`psc_oscdiscovery`).

Linear. No login. No FCI fork. No COTS stop. No slogan. No Demo fill. No file upload. Exit link → `https://example.com`.

## Site permissions

Portal Management → Site Settings:

- `Webapi/psc_oscdiscovery/enabled` = true
- `Webapi/psc_oscdiscovery/fields` = `*`
- `Webapi/psc_oscdiscovery_sp/enabled` = true
- `Webapi/psc_oscdiscovery_sp/fields` = `*`

Table permissions, web role **Anonymous**:

- `psc_oscdiscovery`: **Create** only. Parent stays Create.
- `psc_oscdiscovery_sp`: **Create** on the child.
- Parent **Append To** so the child can bind (`psc_OSCDiscovery@odata.bind`).

Do **not** grant Anonymous Read of OSC answers. The OSC must not enumerate other rows. The parent POST sends `Prefer: return=representation` so `psc_oscdiscoveryid` comes back without a GET. If the portal still returns `return=minimal` (204 + `OData-EntityId` / `Location`), the HTML reads the id from that header — still no Read.

- Lock every `psc_int_*`, `psc_box*`, `psc_orchstatus`, `psc_evidence_share` off the form (not even hidden HTML).
- Form footer (required, every step):

> Do not enter Controlled Unclassified Information, CMMC UIDs, or SPRS scores. This form is completed by the OSC (no OSC account). We do not ask for a CMMC UID. Submitting it is not a CMMC assessment and not a SPRS posting. Acme Assessments will email a copy of your answers.

Banner on the form body (every step): **Do not include CUI.** High-level only. No server names, machine names, or file paths.

## Intro (optional first page, not a Dataverse step)

Paste:

- Title: **Begin the questionnaire.**
- This questionnaire describes the environment that will be assessed. Complete it before the scoping call.
- About 15 to 20 minutes.
- **Do not include CUI.**
- This is high-level environment discovery only. Do not list server names, machine names, file paths, IP addresses, or other specific asset or data details.
- Button: **Start**

## Steps (nav · title · blurb)

Use pills / choice groups for 2–6 option sets. LCCA trim: no device-class inventory, CUI-flow essay, specialized-kinds quiz, continuous-monitoring who/how-often, or inventory/POA&M essays on the OSC form. Company address / CISA sector / CUI-access users stay on the one Company page (eMASS Pre-Assessment D20).

| # | Nav | Title | Blurb |
|---|-----|-------|-------|
| 1 | Company | Company information | Legal entity, address, UEI, CAGE, sector, and city/state. We do not ask for a CMMC UID. |
| 2 | Officials | Assessment Official and Technical POC | The Assessment Official has signature authority. The Technical POC knows the environment. We send a copy of these answers to the Official. |
| 3 | Providers | Service providers | Who touches the CUI path, and whether they are FedRAMP-covered or need their own CMMC status. High-level names only. No CUI. |
| 4 | Interview roles | Interview roles | Whether interview roles can be named. No people names, hostnames, or serial numbers. |
| 5 | CUI path | How CUI moves | Where CUI is stored and how it enters and leaves, including paper, printers, USB, and home use. Do not paste CUI into this form. |
| 6 | Assets | Asset categories | CRMA accident and out-of-scope reach — facts, not intake fails. |
| 7 | Monitoring | Monitoring and access | MFA coverage, then SSP, POA&M, and what you plan during the assessment window. |
| 8 | Review | Review and submit | A recap of answers already given, two required confirmations, and Submit. |

Progress copy: `{n} of 8 · {nav}`. About 15 to 20 minutes.

## Step 1 — Company — paste fields

Group **Who you are**

- HQ organization name *required*
- UEI *required* — hint: Unique Entity ID. Not a CMMC UID — do not enter a CUID.
- OSC name *required* — hint: The organization seeking certification.
- DBA — hint: Optional. Doing business as, if different from the OSC name.

Group **Address** (same Company page — no extra Next)

- Address line 1 *required*
- Address line 2
- City *required* · State *required* · ZIP
- Country *required* — default United States
- Business phone · Website
- Sector (CISA) *required* pills — single-select; POST the one `psc_cisasector` integer
- Other sector — if Other
- How many users will access CUI? *required* — text (`psc_cui_users`). People who will store, process, or transmit CUI. Not org headcount. eMASS Pre-Assessment “Number of Employees” is filled from this answer.

Group **Identifiers**

- Highest Level Owner (HLO) CAGE *required* — tip: The CAGE of the highest-level owner of this OSC — the parent at the top of the corporate tree. Not a CMMC UID.
- CAGE code(s) in scope *required* — hint: Semicolons if more than one. This is not a CMMC UID.

Group **What's in scope**

- Scope *required* pills: Enterprise \| Enclave — tip: Enterprise = the whole organization is in scope. Enclave = a bounded slice (people, systems, CUI path) carved out from the rest.
- Scope description *required if Enclave* — hint: What is in the enclave vs out. No CUI content.

## Step 2 — Officials — paste fields

Group **Assessment Official** — “Signature authority”

Tip: The person with signature authority for this OSC. We email them a copy of these answers. Not the same as the Technical POC.

- Last name *required* · First name *required*
- Title *required*
- Email *required* — hint: We email a copy of your answers here.
- Phone *required*

Group **Technical POC**

- Last name *required* · First name *required*
- Title *required*
- Email *required* · Phone *required*

## Step 3 — Providers — paste fields

- Any service providers in this environment? *required* pills Yes \| No \| N/A \| Don't know
  - Tip: External Service Provider — MSP, SOC, MDR, or similar.
  - Hint: MSP, SOC, MDR, CSP, or similar. None / N/A if it does not apply.
- If Yes: repeating provider (max 5) as `psc_oscdiscovery_sp` child rows. Do **not** flatten onto the parent.
  - Name *required*
  - POC email *required*
  - POC last name *required* · POC first name *required* · POC phone *required*
  - What does this provider do here? *required* pills MSP \| SOC or MDR \| CSP \| Other — **text label**, not a kit Choice
  - Short service description — optional; encodeProvider defaults from job if empty
  - Does this provider store, process, or transmit CUI, or only security-protection data? *required* — **text label**
  - If CSP: CSP authorization *required* — **text label**
  - If FedRAMP Authorized CSP: Marketplace service offering name *required*
  - Does this provider need its own CMMC status? *required* Yes \| No \| N/A \| Don't know — `psc_yesnona` integer
  - CMMC Status *required* — `psc_spcmmcstatus` integer (Not assessed \| Seeking L2 \| L2 Self \| L2 C3PAO \| Unknown \| N/A). Do not convert to Text.
  - Provider sector (CISA) — optional `psc_spsector` / `psc_cisasector` integer
  - Admin, backup, or log access to CUI systems? *required* — `psc_yesnona` integer
  - Written CRM that names inherited vs OSC-owned practices? *required* — `psc_yesnona` integer
  - Vendor shared-responsibility / product matrix on file for this provider? *required* Yes \| No \| N/A — `psc_yesnona` integer
  - Add provider

If No or N/A: hide the repeater. Harborline `?demo=1` on Pages defaults this to **No** until the tenant has the child columns. encodeProvider still posts Yes when the operator selects Yes.

## Step 4 — Interview roles — paste fields

Group **Interview roles**

- Can you name the roles we should interview? *required* Yes \| No \| Don't know
- Interview titles (optional) — show if Yes. Titles only. Not people names. Not required.
- Do **not** ask CUI user counts or device-class inventories on this form.

## Step 5 — CUI path — paste fields

- Where CUI lives today *required* multi (N/A / not sure exclusive):
  M365 GCC High \| M365 GCC \| M365 Commercial \| PreVeil \| Azure Government \| AWS GovCloud \| On-prem file shares / servers \| Email (non-PreVeil) \| Other \| N/A / not sure
- Other location *required if Other*
- For each selected host except N/A: authorization pills FedRAMP Authorized \| DoD equivalent + BoE \| SPD only \| Not authorized \| Don't know \| N/A
  - On-prem label: **On-prem — N/A if no CSP**
  - Marketplace service offering name *required if FedRAMP Authorized*
- Does CUI leave as paper, printer, or USB, including at home? *required* Yes \| No \| Don't know — fact, not an intake fail.
- If people use VDI or a remote desktop, can they download or print? *required* Yes \| No \| N/A \| Don't know
  - Tip: If they can download or print from that session, CUI can leave.
- Is CUI handled at sites other than HQ (other sites or home)? *required* Yes \| No \| Don't know
- Off-HQ note — if Yes
- Do backups of CUI sit in a commercial (non-gov) location? *required* Yes \| No \| N/A \| Don't know
- Where do CUI backups live? *required* pills GCC High \| Commercial cloud \| On-prem \| Vendor \| Don't know \| N/A — product class only. **Posts as text**, not a Choice integer.
- Would a site walkthrough put CUI on screen or in the room? *required* Yes \| No \| Don't know
- Can we screenshare live system configs without CUI appearing on the call? *required* Yes \| No \| N/A \| Don't know — hint: Yes means assessors can see live configs. CUI stays off the call.
- What is the CUI environment? *required* GCC High tenant \| PreVeil \| Other named enclave \| Broader environment \| N/A
- Named enclave *required if Other named enclave*
- CUI boundary defined? *required* Yes \| No \| Don't know
- Network diagram exists? *required* Yes \| No \| Don't know
- Have the network diagram and the applicability matrix been walked against each other? *required* Yes \| No \| Don't know
- Separation *required* Logical \| Physical \| Both \| Neither / unclear \| N/A

## Step 6 — Assets — paste fields

- Do you have systems that could touch CUI but you keep off CUI by policy or technical control (CRMA)? *required*
- If Yes: Can any of them still store, process, or transmit CUI even by accident? *required* — fact, not an intake fail.
- Can an out-of-scope asset still reach a CUI system? *required* — fact, not an intake fail.
- Do **not** put specialized-kinds quizzes or asset-count inventories on this form.

## Step 7 — Monitoring — paste fields

- MFA solution *required*
- Where MFA is enforced *required* All remote and privileged \| Some accounts only \| Not enforced \| Don't know
- Continuous monitoring tool (optional) — name only. Do **not** require who reviews / how often.
- Do **not** re-ask ESP kinds, CRM, admin/backup/log, or vendor SRM here. Those sit on the Providers row.

Readiness chunk (end of Monitoring, not on Review):

- SSP exists? *required* Yes \| Partial / in progress \| No
- If Yes or Partial: Do supporting SSP artifacts exist? *required*
- If artifacts = Yes: Name the types that exist today *required* — types only. No dating, no Box folder names.
- Any POA&M / temporary deficiencies? *required*
- If Yes: Are any POA&Ms conditional (time-boxed / allowed)? *required*
- Do **not** ask POA&M notes essays or asset-inventory exists.
- Expect to fix remaining gaps during the assessment itself? *required*
- Is a freeze planned during the assessment window? *required*
- Is a migration planned during the assessment window? *required*

## Step 8 — Review — paste fields

Recap of answers already given. No first-time yes/nos except the two consents.

**Required consents** (both must be true or submit is rejected):

1. I confirm that nothing submitted here is Controlled Unclassified Information, a CMMC UID, or a SPRS score.
2. I understand this is not a CMMC assessment, designation, or SPRS posting. It gathers environment information so Acme Assessments can identify what is being assessed.

Submit creates **one** parent Dataverse row (`Prefer: return=representation` for the id) plus up to 5 `psc_oscdiscovery_sp` children when Providers = Yes. A failed child POST is an error — do not treat the parent-only create as success. That parent create fires F1.

## Thank-you page

Not a Dataverse form. After submit:

- Title: **Thank you, {first name of Assessment Official}.**
- Your information has been submitted.
- Next steps:
  1. Upload evidence to the Box folder. This folder is on Box with FedRAMP authorization or equivalent.
  2. Someone from Acme Assessments will reach out to schedule the scoping call.
- Gold button **Open evidence folder** → `psc_boxcustomerlink` once F2 writes it.

Power Pages cannot read the row back (Create-only). Practical v1:

- Thank-you static copy + “Check the email we send to the Assessment Official for the Box link.”
- Or a Pages Liquid snippet that an **app user** (not anonymous) resolves after F2 stamps `psc_boxcustomerlink` — only if you add a one-time token. Simplest v1: **email carries the 01+02 link**; thank-you button can be a placeholder “Link arriving by email” until F2 finishes (~1 minute).

Do **not** show GOOD TO GO / NEEDS REVIEW, red flags, or 00 Internal.

## Do not put on the form

File upload, CUID, SPRS score, evidence-share picker, demo fills, assessor outcome, login, slogan.
