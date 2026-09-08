# Dataverse — `psc_oscdiscovery`

Environment: Acme Assessments (commercial first). Publisher prefix **`psc_`**.

## 1. Choice sets (create these first)

Option values start at `100000000`. Labels must match the demo **exactly**.

| Choice set | Labels (in this order) |
|------------|------------------------|
| `psc_yesnodk` | Yes \| No \| Don't know |
| `psc_yesnona` | Yes \| No \| N/A \| Don't know |
| `psc_yesnopartial` | Yes \| Partial / in progress \| No |
| `psc_cisasector` | Defense Industrial Base \| Critical Manufacturing \| Information Technology \| Cloud Service Provider \| Chemical \| Commercial Facilities \| Communications \| Dams \| Emergency Services \| Energy \| Financial Services \| Food and Agriculture \| Government Facilities \| Healthcare and Public Health \| Nuclear Reactors, Materials, and Waste \| Transportation Systems \| Water and Wastewater Systems \| Other |
| `psc_scopemode` | Enterprise \| Enclave |
| `psc_envmode` | GCC High tenant \| PreVeil \| Other named enclave \| Broader environment \| N/A |
| `psc_separation` | Logical \| Physical \| Both \| Neither / unclear \| N/A |
| `psc_crmaenforce` | Technically enforced \| Policy-only \| Mixed \| Don't know \| N/A |
| `psc_cuilocation` | M365 GCC High \| M365 GCC \| M365 Commercial \| PreVeil \| Azure Government \| AWS GovCloud \| On-prem file shares / servers \| Email (non-PreVeil) \| Other \| N/A / not sure |
| `psc_deviceclass` | Workstations \| Laptops \| Servers \| Mobile \| Home / BYOD \| None \| N/A |
| `psc_specializedkind` | None \| GFE \| OT \| IoT \| Test equipment \| Other \| N/A |
| `psc_countband` | None \| A few (1–10) \| Some (11–50) \| Many (51+) \| Don't know \| N/A |
| `psc_hostfedramp` | FedRAMP Authorized \| DoD equivalent + BoE \| SPD only \| Not authorized \| Don't know \| N/A |
| `psc_mfacoverage` | All remote and privileged \| Some accounts only \| Not enforced \| Don't know |
| `psc_espkind` | None \| MSP \| SOC / MDR \| CSP \| Other |
| `psc_spcmmcstatus` | Not assessed \| Seeking L2 \| L2 Self \| L2 C3PAO \| Unknown \| N/A |
| `psc_gonogo` | GOOD TO GO \| NEEDS REVIEW |
| `psc_confidence` | High \| Medium \| Low |
| `psc_effort` | S \| M \| L \| XL |
| `psc_orchstatus` | Submitted \| ScopeComputed \| DropCreated \| TemplateApplied \| CustomerEmailed \| AssessorsEmailed \| FailedScope \| FailedBox \| FailedEmail \| CallComplete |
| `psc_redflag` | Use **exactly** these 17 labels (demo `RED_FLAGS`): No SSP \| No asset inventory with categories \| No network diagram / CUI boundary unidentified \| ESP without CRM \| CSP holding CUI without FedRAMP Moderate/equiv \| No MFA on remote/privileged \| Expects to fix gaps during the assessment \| CUI across whole enterprise with no enclave when they thought they had one \| CRMA is actually a CUI Asset \| Claimed OOS can still reach CUI \| CUI leaves on paper/USB/printer \| VDI can download or print \| ESP access without a CRM that names inherited vs OSC-owned \| Mixed GCC High and Commercial CUI hosts \| SSP claimed without supporting artifacts \| CUI backups in a commercial location \| Migration or freeze planned during the assessment window |

**Do not create** the older field-map choices (`psc_role`, `psc_7021level`, `psc_hascmmcuid`, FCI-only path, etc.).

## 2. Table `psc_oscdiscovery`

- Display name: **OSC Discovery**
- Primary column: `psc_name` (text 100). F1 sets `{oscname} - {yyyy-MM-dd}` Eastern.
- Anonymous web role: **Create only** (no Read / Write / Append / Delete).
- App user for F1/F2: Organization Read + Write.
- Default `psc_orchstatus` = Submitted.
- Default `psc_evidence_share` = Box (system). **Lock off the form.**

### Form columns (public)

Req = required on Power Pages. Types: `text` 400 unless noted; `email`; `yesno`; `choice`; `choices` = multi-select.

#### Step 1 — Company (`P1`)

| Logical name | Display name | Type | Req | Notes |
|---|---|---|---|---|
| `psc_hqname` | HQ organization name | text | yes | |
| `psc_uei` | UEI | text 20 | yes | Hint: Unique Entity ID. Not a CMMC UID. |
| `psc_oscname` | OSC name | text | yes | Organization seeking certification. Use this for folder names. |
| `psc_dba` | DBA | text | no | |
| `psc_address1` | Address line 1 | text | yes | eMASS Pre-Assessment. No Address line 3 unless the column already exists. |
| `psc_address2` | Address line 2 | text | no | |
| `psc_city` | City | text 100 | yes | Visit-type. Keep. |
| `psc_state` | State | text 50 | yes | Visit-type. Keep. |
| `psc_zip` | ZIP | text 20 | no | |
| `psc_country` | Country | text 100 | yes | Default United States. |
| `psc_businessphone` | Business phone | text 50 | no | |
| `psc_website` | Website | url | no | |
| `psc_sector` | Sector (CISA) | choice `psc_cisasector` | yes | Single-select on the OSC form. POST the one label as `100000000+index`. eMASS multi-select semicolon mapping is export-time. |
| `psc_sectorother` | Other sector | text | no | If Sector is Other. |
| `psc_employees` | Number of employees (legacy alias) | text 50 | no | Kept for existing columns. OSC form writes `psc_cui_users`; F1 / submit may copy that value here. Not org headcount. |
| `psc_cui_users` | How many users will access CUI? | text 50 | yes | Company page. People who will store, process, or transmit CUI — not org headcount. |
| `psc_hlocage` | Highest Level Owner (HLO) CAGE | text 50 | yes | Not a CMMC UID |
| `psc_cageinscope` | CAGE code(s) in scope | text 200 | yes | Semicolons if several |
| `psc_scopemode` | Scope | choice `psc_scopemode` | yes | |
| `psc_scopedesc` | Scope description | multiline | if Enclave | No CUI content |

#### Step 2 — Officials (`P2`)

| Logical name | Display name | Type | Req |
|---|---|---|---|
| `psc_ao_last` | Assessment Official last name | text 100 | yes |
| `psc_ao_first` | Assessment Official first name | text 100 | yes |
| `psc_ao_title` | Assessment Official title | text 200 | yes |
| `psc_ao_email` | Assessment Official email | email | yes — Email 1 To: |
| `psc_ao_phone` | Assessment Official phone | text 50 | yes |
| `psc_tpoc_last` | Technical POC last name | text 100 | yes |
| `psc_tpoc_first` | Technical POC first name | text 100 | yes |
| `psc_tpoc_title` | Technical POC title | text 200 | yes |
| `psc_tpoc_email` | Technical POC email | email | yes |
| `psc_tpoc_phone` | Technical POC phone | text 50 | yes |

#### Step 3 — Providers (`P3`)

| Logical name | Display name | Type | Req |
|---|---|---|---|
| `psc_has_sps` | Any service providers in this environment? | choice `psc_yesnona` | yes |

Repeating providers → related table **`psc_oscdiscovery_sp`** (below). Do **not** flatten providers into a text blob on the parent.

#### Step 4 — Interview roles (`E1`)

| Logical name | Display name | Type | Req |
|---|---|---|---|
| `psc_cui_users` | How many users will access CUI? | text 50 | yes | Collected on Company (P1), not this step. |
| `psc_interview_roles_namable` | Can you name the roles we should interview? | choice `psc_yesnodk` | yes | |
| `psc_interview_role_names` | Role names only. No CUI. | text | no | Optional titles if Yes. Not required. |
| `psc_device_classes` | Device classes | choices `psc_deviceclass` | no | Off OSC form. |
| `psc_devices_workstations` | Workstations (optional count) | text 50 | if Workstations |
| `psc_devices_laptops` | Laptops (optional count) | text 50 | if Laptops |
| `psc_devices_servers` | Servers (optional count) | text 50 | if Servers |
| `psc_devices_mobile` | Mobile (optional count) | text 50 | if Mobile |
| `psc_devices_home` | Home / BYOD (optional note) | text | if Home / BYOD |

Do **not** put `employees_total` on the form and do **not** ask org headcount. OSC answers `psc_cui_users`. F1 / submit may copy that into optional `psc_employees` / `psc_employees_total` so older SCOPE aliases and eMASS Pre-Assessment D20 still fill. eMASS still labels the cell “Number of Employees”; the value is CUI-access users, not company-wide headcount.

#### Step 5 — CUI path (`E2`)

| Logical name | Display name | Type | Req |
|---|---|---|---|
| `psc_cui_locations` | Where CUI lives today | choices `psc_cuilocation` | yes |
| `psc_cui_locations_note` | Other location | text | if Other |
| `psc_cui_flow` | How CUI enters and leaves | multiline | no | Off OSC form (LCCA trim). |
| `psc_cui_leaves_portable` | Does CUI leave as paper, printer, or USB, including at home? | choice `psc_yesnodk` | yes |
| `psc_vdi_download_print` | If people use VDI or a remote desktop, can they download or print? | choice `psc_yesnona` | yes |
| `psc_cui_off_hq` | Is CUI handled at sites other than HQ (other sites or home)? | choice `psc_yesnodk` | yes |
| `psc_cui_off_hq_note` | Off-HQ note | text | if Yes |
| `psc_cui_backup_commercial` | Do backups of CUI sit in a commercial (non-gov) location? | choice `psc_yesnona` | yes |
| `psc_cui_backup_where` | Where do CUI backups live? | text 100 | yes | Product class only (GCC High, Commercial cloud, On-prem, Vendor, Don't know, N/A). **Text, not a Choice set.** Do not invent option values. |
| `psc_virtual_tour_exposes_cui` | Would a site walkthrough put CUI on screen or in the room? | choice `psc_yesnodk` | yes |
| `psc_dlp_blocks_screenshare` | Can we screenshare live system configs without CUI appearing on the call? | choice `psc_yesnona` | yes |
| `psc_env_mode` | What is the CUI environment? | choice `psc_envmode` | yes |
| `psc_enclave_what` | Named enclave | text | if Other named enclave |
| `psc_boundary_defined` | CUI boundary defined? | choice `psc_yesnodk` | yes |
| `psc_network_diagram` | Network diagram exists? | choice `psc_yesnodk` | yes |
| `psc_diagram_vs_matrix` | Have the network diagram and the applicability matrix been walked against each other? | choice `psc_yesnodk` | yes |
| `psc_separation` | Separation | choice `psc_separation` | yes |

Per-host authorization (show only when that location is selected). Choice `psc_hostfedramp`:

| Logical name | Display name |
|---|---|
| `psc_fedramp_m365gcchigh` | M365 GCC High — authorization |
| `psc_fedramp_m365gcc` | M365 GCC — authorization |
| `psc_fedramp_m365commercial` | M365 Commercial — authorization |
| `psc_fedramp_preveil` | PreVeil — authorization |
| `psc_fedramp_azuregov` | Azure Government — authorization |
| `psc_fedramp_awsgov` | AWS GovCloud — authorization |
| `psc_fedramp_onprem` | On-prem — N/A if no CSP |
| `psc_fedramp_email` | Email (non-PreVeil) — authorization |
| `psc_fedramp_other` | Other — authorization |

#### Step 6 — Assets (`E3`)

| Logical name | Display name | Type | Req |
|---|---|---|---|
| `psc_has_crma` | Do you have CRMA? | choice `psc_yesnodk` | yes | |
| `psc_crma_handles_cui` | Can contractor-managed assets handle CUI even by accident? | choice `psc_yesnodk` | if CRMA Yes | Fact, not an intake fail. |
| `psc_oos_can_reach_cui` | Can an out-of-scope asset still reach a CUI system? | choice `psc_yesnona` | yes | Fact, not an intake fail. |
| `psc_specialized_kinds` | Specialized assets (GFE / OT / IoT / test) | choices `psc_specializedkind` | no | Off OSC form. |
| `psc_specialized_notes` | Other specialized assets | text | no | Off OSC form. |
| `psc_count_cui_assets` | CUI Assets (optional) | choice `psc_countband` | no |
| `psc_count_spa` | Security Protection Assets (SPA) (optional) | choice `psc_countband` | no |
| `psc_count_crma` | Contractor Risk Managed Assets (CRMA) (optional) | choice `psc_countband` | no |
| `psc_crma_enforce` | CRMA enforcement (optional) | choice `psc_crmaenforce` | no |
| `psc_count_oos` | Out-of-scope assets (optional) | choice `psc_countband` | no |
| `psc_oos_justification` | Out-of-scope justification (optional) | multiline | if count is not None/N/A/Don't know |

#### Step 7 — Monitoring (`E4`)

| Logical name | Display name | Type | Req |
|---|---|---|---|
| `psc_contmon_tool` | Continuous monitoring tool | text | no | Optional name-only on OSC form. |
| `psc_contmon_who` | Who reviews | text | no | Off OSC form. |
| `psc_contmon_howoften` | How often | text | no | Off OSC form. |
| `psc_mfa_solution` | MFA solution | text | yes | |
| `psc_mfa_coverage` | Where MFA is enforced | choice `psc_mfacoverage` | yes | |
| `psc_mfa_uncovered` | Accounts not covered | text | no | Off OSC form. |
| `psc_esp_kinds` | ESPs in this environment | choices `psc_espkind` | no | Off OSC form — Providers row covers this. |
| `psc_esp_who` | Other ESP | text | no | Off OSC form. |
| `psc_esp_csp` | Does a CSP hold CUI? | choice `psc_yesnona` | no | Off OSC form. |
| `psc_csp_needs_own_cmmc` | Does that CSP need its own CMMC assessment? | choice `psc_yesnona` | no | Off OSC form. |
| `psc_vendor_srm_on_file` | Is a vendor shared-responsibility / product matrix on file? | choice `psc_yesnona` | no | Asked on the provider row. |
| `psc_esp_admin_access` | Do any ESPs have admin, backup, or log access to CUI systems? | choice `psc_yesnona` | no | Asked on the provider row. |
| `psc_esp_crm_names_inherited` | Does a written CRM name which practices are inherited vs owned by you? | choice `psc_yesnona` | no | Asked on the provider row. |
| `psc_ssp_exists` | SSP exists? | choice `psc_yesnopartial` | yes | Asked at the end of Monitoring, not on Review. |
| `psc_ssp_updated` | SSP last updated | text 50 | no | Off OSC form (no artifact dating). |
| `psc_ssp_matches` | SSP matches reality? | choice `psc_yesnodk` | no | Off OSC form. |
| `psc_ssp_artifacts_exist` | Do supporting SSP artifacts exist (policies, procedures)? | choice `psc_yesnodk` | if SSP Yes or Partial |
| `psc_ssp_artifact_types` | Name the types that exist today | text | if artifacts Yes | Types only. Do not upload. |
| `psc_inventory_exists` | Asset inventory exists (with categories)? | choice `psc_yesnopartial` | no | Off OSC form. |
| `psc_inventory_current` | Inventory current? | choice `psc_yesnodk` | no | Off OSC form. |
| `psc_poam_open` | Any POA&M / temporary deficiencies? | choice `psc_yesnona` | yes |
| `psc_poam_conditional` | Are any POA&Ms conditional (time-boxed / allowed)? | choice `psc_yesnona` | if POA&M Yes |
| `psc_poam_notes` | POA&M notes | multiline | no | Off OSC form. |
| `psc_fix_during_assessment` | Expect to fix remaining gaps during the assessment itself? | choice `psc_yesnodk` | yes |
| `psc_freeze_during_assessment` | Is a freeze planned during the assessment window? | choice `psc_yesnodk` | yes | Freeze is separate from migration. |
| `psc_migrate_during_assessment` | Is a migration planned during the assessment window? | choice `psc_yesnodk` | yes |

#### Step 8 — Review (`G`)

Review is a recap of answers already given + required consents + Submit. No first-time yes/nos except the two consents.

| Logical name | Display name | Type | Req |
|---|---|---|---|
| `psc_consent_nocui` | Confirms nothing submitted is CUI / UID / SPRS score | yesno | **yes** — cannot submit if No |
| `psc_consent_notassessment` | Understands this is not a CMMC assessment | yesno | **yes** |

### System columns (lock off the public form)

| Logical name | Display name | Type |
|---|---|---|
| `psc_orchstatus` | Orchestration status | choice `psc_orchstatus` |
| `psc_submittedon` | Submitted on | datetime |
| `psc_evidence_share` | Evidence share | text — default `Box` |
| `psc_boxdropfolderid` | Box drop folder id | text 100 |
| `psc_boxdropfolderurl` | Box drop folder URL | url |
| `psc_boxinternalurl` | Box 00 Internal URL | url |
| `psc_boxcustomerlink` | Box customer link | url |
| `psc_flowrunurl` | Last flow run URL | url |
| `psc_int_gonogo` | Go / no-go | choice `psc_gonogo` |
| `psc_int_infodetermination` | Information determination | text 400 |
| `psc_int_reclevel` | Recommended level (stores gonogo in this IA) | text 50 |
| `psc_int_confidence` | Confidence | choice `psc_confidence` |
| `psc_int_assess_line1` | Assessment type — what is being assessed | multiline |
| `psc_int_assess_line2` | Assessment type — boundary / FedRAMP / MFA | multiline |
| `psc_int_assess_line3` | Assessment type — call focus | multiline |
| `psc_int_scope_mode` | Scope mode | choice `psc_scopemode` |
| `psc_int_scope_people` | Scope — people | text 200 |
| `psc_int_scope_locations` | Scope — locations | text 400 |
| `psc_int_scope_systemclasses` | Scope — devices | multiline |
| `psc_int_l2fivecat` | L2 five-category first pass | multiline |
| `psc_int_esptable` | ESP table | multiline |
| `psc_int_flowdownsketch` | CUI flow | multiline |
| `psc_int_effort` | Effort | choice `psc_effort` |
| `psc_int_effortdrivers` | Effort drivers | multiline |
| `psc_int_redflags` | Red flags | choices `psc_redflag` |
| `psc_int_redflagnotes` | Red flag notes | multiline |
| `psc_int_scopenotes` | Assessor notes (pre-call) | multiline |

## 3. Related table `psc_oscdiscovery_sp`

**Maker click list** (tenant — GitHub cannot create this table; the tenant admin does):

1. Create table **OSC Discovery provider** (`psc_oscdiscovery_sp`).
2. Create the columns below.
3. Add required lookup **`psc_oscdiscovery`** (1:N from OSC Discovery).
4. Enable Web API: site settings `Webapi/psc_oscdiscovery_sp/enabled` = true and `Webapi/psc_oscdiscovery_sp/fields` = `*`.
5. Table permissions — Anonymous: **Create** on the child; **Append To** on the parent. Parent stays **Create** only. Do **not** grant Anonymous Read of OSC answers.
6. Republish the site.

Display **OSC Discovery provider**. Lookup **`psc_oscdiscovery`** is required. Bind each child with `psc_OSCDiscovery@odata.bind` → `/psc_oscdiscoveries({id})`. Cap the form at 5. Do **not** flatten providers into a text blob on the parent.

These are the columns `encodeProvider` POSTs. Do **not** convert kit Choice columns to Text.

| Logical name | Display name | Type | Notes |
|---|---|---|---|
| `psc_name` | Name | text | Required if parent `psc_has_sps` = Yes |
| `psc_email` | POC email | email | |
| `psc_poc_last` | POC last name | text 100 | eMASS ESP. Required if Yes. |
| `psc_poc_first` | POC first name | text 100 | eMASS ESP. Required if Yes. |
| `psc_poc_phone` | POC phone | text 50 | eMASS ESP. Required if Yes. |
| `psc_job` | What does this provider do here? | text | Not a kit Choice. POST the label string (MSP \| SOC or MDR \| CSP \| Other). |
| `psc_service_desc` | Short service description | text | Optional. `encodeProvider` defaults from `psc_job` if empty. |
| `psc_cui_or_spd` | CUI or security-protection data | text | POST the label string. |
| `psc_fedramp` | CSP authorization | text | Label string. CSP rows only. |
| `psc_offering_name` | Marketplace service offering name | text | FedRAMP Authorized CSP only. |
| `psc_own_cmmc` | Does this provider need its own CMMC status? | choice `psc_yesnona` | Integer `100000000+index`. |
| `psc_spcmmcstatus` | CMMC Status | choice `psc_spcmmcstatus` | Integer `100000000+index`. Not assessed \| Seeking L2 \| L2 Self \| L2 C3PAO \| Unknown \| N/A. Do **not** convert this Choice to Text. eMASS None/Level 2/Level 3 mapping is export-time. |
| `psc_spsector` | Provider sector | choice `psc_cisasector` | Optional. Same CISA set. Not the retired `psc_sector` column. |
| `psc_admin_access` | Admin, backup, or log access to CUI systems? | choice `psc_yesnona` | Integer `100000000+index`. |
| `psc_crm_inherited` | Written CRM that names inherited vs OSC-owned practices? | choice `psc_yesnona` | Integer `100000000+index`. |
| `psc_vendor_srm` | Vendor shared-responsibility / product matrix on file? | choice `psc_yesnona` | Integer `100000000+index`. Form shows Yes \| No \| N/A. |

Do **not** create `psc_poc`, `psc_phone`, `psc_enclave`, `psc_cmmcstatus`, or `psc_sector` on this table (retired provider shape). Use `psc_poc_last` / `psc_poc_first` / `psc_poc_phone` / `psc_spcmmcstatus` / `psc_spsector`. If the retired names already exist, leave them unused (optional).

F2 reads child rows for the answers doc and ESP table.

## 4. Do not create

CMMC UID, SPRS score, CUI excerpts, hostnames, IPs, file-upload columns, `psc_hascmmcuid`, `psc_hassprsstatus`, DFARS 7021/7012 fields from the old field map, FCI-only E1 columns, COTS stop columns.
