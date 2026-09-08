import type {
  BackupClass,
  Confidence,
  CrmaEnforce,
  CisaSector,
  CuiVsSpd,
  Effort,
  EnvMode,
  EvidenceShare,
  Fedramp,
  HostFedramp,
  MfaCoverage,
  ProviderFedramp,
  ProviderJob,
  ScopeMode,
  Separation,
  SpCmmcStatus,
  YesNoDk,
  YesNoNa,
  YesNoNaOnly,
  YesNoPartial,
} from "./choices";

export type IntakePath = "standard";

export type ServiceProvider = {
  name: string;
  email: string;
  poc_last: string;
  poc_first: string;
  poc_phone: string;
  job: ProviderJob | "";
  service_desc: string;
  cui_or_spd: CuiVsSpd | "";
  fedramp: ProviderFedramp | "";
  offering_name: string;
  own_cmmc: YesNoNa | "";
  admin_access: YesNoNa | "";
  crm_inherited: YesNoNa | "";
  vendor_srm: YesNoNaOnly | "";
  spcmmcstatus: SpCmmcStatus | "";
  /** Optional CISA sector for this provider. Posted as psc_spsector. */
  spsector: CisaSector | "";
};

export type CuiHostFedramp = {
  host: string;
  fedramp: HostFedramp | "";
  offering_name: string;
};

export type FormAnswers = {
  // Part 1 — OSC Information
  hqname: string;
  uei: string;
  oscname: string;
  dba: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  businessphone: string;
  website: string;
  sector: CisaSector | "";
  sectorother: string;
  /** Legacy org-headcount alias. OSC intake stores CUI-access users in `cui_users`. */
  employees: string;
  hlocage: string;
  cageinscope: string;
  scopemode: ScopeMode | "";
  scopedesc: string;
  ao_last: string;
  ao_first: string;
  ao_title: string;
  ao_email: string;
  ao_phone: string;
  tpoc_last: string;
  tpoc_first: string;
  tpoc_title: string;
  tpoc_email: string;
  tpoc_phone: string;
  has_sps: YesNoNa | "";
  sps: ServiceProvider[];

  // Part 2 — Environment (L2 scoping script)
  /** Legacy alias of `cui_users` / `employees`. Not asked on the OSC form. */
  employees_total: string;
  /** Users who will access CUI. This is the OSC-facing headcount question. */
  cui_users: string;
  interview_roles_namable: YesNoDk | "";
  interview_role_names: string;
  device_classes: string[];
  devices_workstations: string;
  devices_laptops: string;
  devices_servers: string;
  devices_mobile: string;
  devices_home: string;
  cui_locations: string[];
  cui_locations_note: string;
  cui_host_fedramp: CuiHostFedramp[];
  cui_flow: string;
  cui_leaves_portable: YesNoDk | "";
  vdi_download_print: YesNoNa | "";
  cui_off_hq: YesNoDk | "";
  cui_off_hq_note: string;
  other_sites: string;
  cui_backup_commercial: YesNoNa | "";
  cui_backup_where: BackupClass | "";
  physical_cui_observe: YesNoDk | "";
  virtual_tour_exposes_cui: YesNoDk | "";
  dlp_blocks_screenshare: YesNoNa | "";
  env_mode: EnvMode | "";
  enclave_what: string;
  enclave_fedramp: Fedramp | "";
  boundary_defined: YesNoDk | "";
  network_diagram: YesNoDk | "";
  diagram_vs_matrix: YesNoDk | "";
  separation: Separation | "";
  count_cui_assets: string;
  count_spa: string;
  count_crma: string;
  crma_enforce: CrmaEnforce | "";
  has_crma: YesNoDk | "";
  crma_handles_cui: YesNoDk | "";
  specialized_kinds: string[];
  count_specialized: string;
  specialized_notes: string;
  count_oos: string;
  oos_can_reach_cui: YesNoNa | "";
  oos_justification: string;
  contmon_tool: string;
  contmon_who: string;
  contmon_howoften: string;
  mfa_solution: string;
  mfa_coverage: MfaCoverage | "";
  mfa_uncovered: string;
  esp_kinds: string[];
  esp_who: string;
  esp_csp: YesNoNa | "";
  esp_fedramp: Fedramp | "";
  csp_needs_own_cmmc: YesNoNa | "";
  esp_crm: YesNoNa | "";
  vendor_srm_on_file: YesNoNa | "";
  esp_admin_access: YesNoNa | "";
  esp_crm_names_inherited: YesNoNa | "";
  ssp_exists: YesNoPartial | "";
  ssp_updated: string;
  ssp_matches: YesNoDk | "";
  ssp_artifacts_exist: YesNoDk | "";
  ssp_artifact_types: string;
  inventory_exists: YesNoPartial | "";
  inventory_current: YesNoDk | "";
  poam_open: YesNoNa | "";
  poam_conditional: YesNoNa | "";
  poam_notes: string;
  evidence_share: EvidenceShare | "";
  evidence_share_other: string;
  fix_during_assessment: YesNoDk | "";
  freeze_during_assessment: YesNoDk | "";
  migrate_during_assessment: YesNoDk | "";

  consent_nocui: boolean;
  consent_notassessment: boolean;
};

/**
 * Descriptive summary of what the OSC reported. Deliberately contains no
 * verdict: no go/no-go, no risk flags, no confidence or effort rating.
 * Triage is a human judgment made on the scoping call, not computed here.
 */
export type ScopeResult = {
  infodetermination: string;
  assess_line1: string;
  assess_line2: string;
  assess_line3: string;
  scope_mode: ScopeMode | "";
  scope_people: string;
  scope_locations: string;
  scope_systemclasses: string;
  l2fivecat: string;
  esptable: string;
  flowdownsketch: string;
  scopenotes: string;
};

export type OrchStatus =
  | "Submitted"
  | "ScopeComputed"
  | "DropCreated"
  | "TemplateApplied"
  | "CustomerEmailed"
  | "AssessorsEmailed"
  | "CallComplete";

export type OrchBeat = {
  beat: number;
  name: string;
  status: "ok" | "info";
  at: string;
  detail: string;
};

export type BoxSim = {
  parentName: string;
  parentNote: string;
  dropFolderName: string;
  dropFolderId: string;
  customerLink: string;
  internalUrl: string;
  dropUrl: string;
  files: {
    folder: "00 Internal" | "01 Answers" | "02 Uploads" | "03 Scoping call";
    name: string;
    kind: "md" | "txt" | "xlsx";
    customerVisible: boolean;
  }[];
  /** Set by applyBoxHandoff when a real Box link / token is configured. */
  live?: boolean;
  writeStatus?: "skipped" | "uploaded" | "failed";
  writeDetail?: string;
  answersFileId?: string;
};

export type Submission = {
  id: string;
  name: string;
  submittedon: string;
  orchstatus: OrchStatus;
  path: IntakePath;
  fingerprint: string;
  answers: FormAnswers;
  scope: ScopeResult;
  answersMarkdown: string;
  internalMarkdown: string;
  beats: OrchBeat[];
  box: BoxSim;
  customerEmail: { to: string; subject: string; body: string };
  assessorEmail: { to: string; subject: string; body: string };
  preferredDates?: { dates: string[]; note: string };
};

export function emptyProvider(): ServiceProvider {
  return {
    name: "",
    email: "",
    poc_last: "",
    poc_first: "",
    poc_phone: "",
    job: "",
    service_desc: "",
    cui_or_spd: "",
    fedramp: "",
    offering_name: "",
    own_cmmc: "",
    admin_access: "",
    crm_inherited: "",
    vendor_srm: "",
    spcmmcstatus: "",
    spsector: "",
  };
}

export function normalizeProvider(raw: unknown): ServiceProvider {
  const base = emptyProvider();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Record<string, unknown>;
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
  return {
    name: str("name"),
    email: str("email"),
    poc_last: str("poc_last"),
    poc_first: str("poc_first"),
    poc_phone: str("poc_phone"),
    job: (str("job") as ServiceProvider["job"]) || "",
    service_desc: str("service_desc"),
    cui_or_spd: (str("cui_or_spd") as ServiceProvider["cui_or_spd"]) || "",
    fedramp: (str("fedramp") as ServiceProvider["fedramp"]) || "",
    offering_name: str("offering_name"),
    own_cmmc: (str("own_cmmc") as ServiceProvider["own_cmmc"]) || "",
    admin_access: (str("admin_access") as ServiceProvider["admin_access"]) || "",
    crm_inherited: (str("crm_inherited") as ServiceProvider["crm_inherited"]) || "",
    vendor_srm: (str("vendor_srm") as ServiceProvider["vendor_srm"]) || "",
    spcmmcstatus: (str("spcmmcstatus") as ServiceProvider["spcmmcstatus"]) || "",
    spsector: (str("spsector") as ServiceProvider["spsector"]) || "",
  };
}

export function normalizeHostFedramp(raw: unknown): CuiHostFedramp {
  if (!raw || typeof raw !== "object") return { host: "", fedramp: "", offering_name: "" };
  const t = raw as Record<string, unknown>;
  return {
    host: typeof t.host === "string" ? t.host : "",
    fedramp: typeof t.fedramp === "string" ? (t.fedramp as CuiHostFedramp["fedramp"]) : "",
    offering_name: typeof t.offering_name === "string" ? t.offering_name : "",
  };
}

export function orgName(a: FormAnswers): string {
  return (a.oscname || a.hqname).trim() || "OSC";
}

export function contactName(a: FormAnswers): string {
  const ao = [a.ao_first, a.ao_last].filter(Boolean).join(" ").trim();
  if (ao) return ao;
  return [a.tpoc_first, a.tpoc_last].filter(Boolean).join(" ").trim();
}

export function contactEmail(a: FormAnswers): string {
  return (a.ao_email || a.tpoc_email).trim();
}

export function emptyAnswers(): FormAnswers {
  return {
    hqname: "",
    uei: "",
    oscname: "",
    dba: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    businessphone: "",
    website: "",
    sector: "",
    sectorother: "",
    employees: "",
    hlocage: "",
    cageinscope: "",
    scopemode: "",
    scopedesc: "",
    ao_last: "",
    ao_first: "",
    ao_title: "",
    ao_email: "",
    ao_phone: "",
    tpoc_last: "",
    tpoc_first: "",
    tpoc_title: "",
    tpoc_email: "",
    tpoc_phone: "",
    has_sps: "",
    sps: [],
    employees_total: "",
    cui_users: "",
    interview_roles_namable: "",
    interview_role_names: "",
    device_classes: [],
    devices_workstations: "",
    devices_laptops: "",
    devices_servers: "",
    devices_mobile: "",
    devices_home: "",
    cui_locations: [],
    cui_locations_note: "",
    cui_host_fedramp: [],
    cui_flow: "",
    cui_leaves_portable: "",
    vdi_download_print: "",
    cui_off_hq: "",
    cui_off_hq_note: "",
    other_sites: "",
    cui_backup_commercial: "",
    cui_backup_where: "",
    physical_cui_observe: "",
    virtual_tour_exposes_cui: "",
    dlp_blocks_screenshare: "",
    env_mode: "",
    enclave_what: "",
    enclave_fedramp: "",
    boundary_defined: "",
    network_diagram: "",
    diagram_vs_matrix: "",
    separation: "",
    count_cui_assets: "",
    count_spa: "",
    count_crma: "",
    crma_enforce: "",
    has_crma: "",
    crma_handles_cui: "",
    specialized_kinds: [],
    count_specialized: "",
    specialized_notes: "",
    count_oos: "",
    oos_can_reach_cui: "",
    oos_justification: "",
    contmon_tool: "",
    contmon_who: "",
    contmon_howoften: "",
    mfa_solution: "",
    mfa_coverage: "",
    mfa_uncovered: "",
    esp_kinds: [],
    esp_who: "",
    esp_csp: "",
    esp_fedramp: "",
    csp_needs_own_cmmc: "",
    esp_crm: "",
    vendor_srm_on_file: "",
    esp_admin_access: "",
    esp_crm_names_inherited: "",
    ssp_exists: "",
    ssp_updated: "",
    ssp_matches: "",
    ssp_artifacts_exist: "",
    ssp_artifact_types: "",
    inventory_exists: "",
    inventory_current: "",
    poam_open: "",
    poam_conditional: "",
    poam_notes: "",
    evidence_share: "Box",
    evidence_share_other: "",
    fix_during_assessment: "",
    freeze_during_assessment: "",
    migrate_during_assessment: "",
    consent_nocui: false,
    consent_notassessment: false,
  };
}

/**
 * OSC intake captures users who will access CUI (`cui_users`), not org headcount.
 * `employees` / `employees_total` stay as aliases for older drafts and eMASS.
 */
export function cuiAccessUsers(a: Pick<FormAnswers, "cui_users" | "employees" | "employees_total">): string {
  return (a.cui_users || a.employees || a.employees_total || "").trim();
}

/** Copy the CUI-access count into legacy employee aliases when those are empty. */
export function syncHeadcountAliases(a: FormAnswers): FormAnswers {
  const n = cuiAccessUsers(a);
  return {
    ...a,
    cui_users: (a.cui_users || n).trim(),
    employees: (a.employees || n).trim(),
    employees_total: (a.employees_total || n).trim(),
  };
}
