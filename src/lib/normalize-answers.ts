import { beatsForStep } from "./beats.ts";
import { CUI_PATH_NOTE_KEYS, CUI_PATH_NOTE_MAX } from "./cui-path.ts";
import {
  BACKUP_CLASSES,
  CISA_SECTORS,
  CRMA_ENFORCE,
  CUI_LOCATIONS,
  CUI_VS_SPD,
  DEVICE_CLASSES,
  ENV_MODES,
  ESP_KINDS,
  EVIDENCE_SHARE,
  FEDRAMP,
  HOST_FEDRAMP,
  MFA_COVERAGE,
  PROVIDER_FEDRAMP,
  PROVIDER_JOBS,
  SCOPE_MODES,
  SEPARATION,
  SP_CMMC_STATUS,
  SPECIALIZED_KINDS,
  YES_NO_DK,
  YES_NO_NA,
  YES_NO_NA_ONLY,
  YES_NO_PARTIAL,
} from "./choices.ts";
import { stepsForPath } from "./path.ts";
import {
  emptyAnswers,
  emptyProvider,
  syncHeadcountAliases,
  type CuiHostFedramp,
  type FormAnswers,
  type ServiceProvider,
} from "./types.ts";
import {
  firstIncompleteGap,
  isValidCage,
  isValidCageList,
  normalizeCage,
  normalizeCageList,
} from "./validate.ts";

const LEN = {
  name: 200,
  uei: 12,
  cage: 5,
  cageList: 80,
  email: 254,
  phone: 40,
  title: 200,
  city: 80,
  state: 40,
  zip: 20,
  country: 80,
  url: 200,
  short: 200,
  note: 4000,
  offering: 200,
} as const;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const UEI_RE = /^[A-Za-z0-9]{12}$/;

const MAX_SPS = 5;
const MAX_HOST_TAGS = 20;
const MAX_ENUM_ARRAY = 20;

const ALLOWED_KEYS = new Set(Object.keys(emptyAnswers()));
const PROVIDER_KEYS = new Set(Object.keys(emptyProvider()));
const HOST_KEYS = new Set(["host", "fedramp", "offering_name"]);

const STRING_ENUMS: Partial<Record<keyof FormAnswers, readonly string[]>> = {
  sector: CISA_SECTORS,
  scopemode: SCOPE_MODES,
  has_sps: YES_NO_NA,
  interview_roles_namable: YES_NO_DK,
  cui_leaves_portable: YES_NO_DK,
  vdi_download_print: YES_NO_NA,
  cui_off_hq: YES_NO_DK,
  cui_backup_commercial: YES_NO_NA,
  cui_backup_where: BACKUP_CLASSES,
  physical_cui_observe: YES_NO_DK,
  virtual_tour_exposes_cui: YES_NO_DK,
  dlp_blocks_screenshare: YES_NO_NA,
  env_mode: ENV_MODES,
  enclave_fedramp: FEDRAMP,
  boundary_defined: YES_NO_DK,
  network_diagram: YES_NO_DK,
  diagram_vs_matrix: YES_NO_DK,
  separation: SEPARATION,
  crma_enforce: CRMA_ENFORCE,
  has_crma: YES_NO_DK,
  crma_handles_cui: YES_NO_DK,
  oos_can_reach_cui: YES_NO_NA,
  mfa_coverage: MFA_COVERAGE,
  esp_csp: YES_NO_NA,
  esp_fedramp: FEDRAMP,
  csp_needs_own_cmmc: YES_NO_NA,
  esp_crm: YES_NO_NA,
  vendor_srm_on_file: YES_NO_NA,
  esp_admin_access: YES_NO_NA,
  esp_crm_names_inherited: YES_NO_NA,
  ssp_exists: YES_NO_PARTIAL,
  ssp_matches: YES_NO_DK,
  ssp_artifacts_exist: YES_NO_DK,
  inventory_exists: YES_NO_PARTIAL,
  inventory_current: YES_NO_DK,
  poam_open: YES_NO_NA,
  poam_conditional: YES_NO_NA,
  evidence_share: EVIDENCE_SHARE,
  fix_during_assessment: YES_NO_DK,
  freeze_during_assessment: YES_NO_DK,
  migrate_during_assessment: YES_NO_DK,
};

const STRING_ARRAY_ENUMS: Partial<Record<keyof FormAnswers, readonly string[]>> = {
  device_classes: DEVICE_CLASSES,
  cui_locations: CUI_LOCATIONS,
  specialized_kinds: SPECIALIZED_KINDS,
  esp_kinds: ESP_KINDS,
};

const STRING_LIMITS: Partial<Record<keyof FormAnswers, number>> = {
  hqname: LEN.name,
  uei: LEN.uei,
  oscname: LEN.name,
  dba: LEN.name,
  address1: LEN.name,
  address2: LEN.name,
  city: LEN.city,
  state: LEN.state,
  zip: LEN.zip,
  country: LEN.country,
  businessphone: LEN.phone,
  website: LEN.url,
  sectorother: LEN.short,
  employees: LEN.short,
  hlocage: LEN.cage,
  cageinscope: LEN.cageList,
  scopedesc: CUI_PATH_NOTE_MAX,
  ao_last: LEN.name,
  ao_first: LEN.name,
  ao_title: LEN.title,
  ao_email: LEN.email,
  ao_phone: LEN.phone,
  tpoc_last: LEN.name,
  tpoc_first: LEN.name,
  tpoc_title: LEN.title,
  tpoc_email: LEN.email,
  tpoc_phone: LEN.phone,
  employees_total: LEN.short,
  cui_users: LEN.short,
  interview_role_names: LEN.note,
  devices_workstations: LEN.short,
  devices_laptops: LEN.short,
  devices_servers: LEN.short,
  devices_mobile: LEN.short,
  devices_home: LEN.short,
  cui_locations_note: CUI_PATH_NOTE_MAX,
  cui_flow: LEN.note,
  cui_off_hq_note: CUI_PATH_NOTE_MAX,
  other_sites: CUI_PATH_NOTE_MAX,
  enclave_what: CUI_PATH_NOTE_MAX,
  count_cui_assets: LEN.short,
  count_spa: LEN.short,
  count_crma: LEN.short,
  count_specialized: LEN.short,
  specialized_notes: LEN.note,
  count_oos: LEN.short,
  oos_justification: LEN.note,
  contmon_tool: LEN.short,
  contmon_who: LEN.short,
  contmon_howoften: LEN.short,
  mfa_solution: LEN.short,
  mfa_uncovered: LEN.note,
  esp_who: LEN.short,
  ssp_updated: LEN.short,
  ssp_artifact_types: LEN.note,
  poam_notes: LEN.note,
  evidence_share_other: LEN.short,
};

export type NormalizeFail = { ok: false; error: string; field?: string };
export type NormalizeOk = { ok: true; answers: FormAnswers };
export type NormalizeResult = NormalizeOk | NormalizeFail;

function fail(error: string, field?: string): NormalizeFail {
  return { ok: false, error, field };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function extraKeys(obj: Record<string, unknown>, allowed: Set<string>): string[] {
  return Object.keys(obj).filter((k) => !allowed.has(k));
}

function asTrimmedString(v: unknown, max: number, field: string): { ok: true; value: string } | NormalizeFail {
  if (typeof v !== "string") return fail(`${field} must be a string.`, field);
  if (v.length > max) return fail(`${field} is too long.`, field);
  if (/[\r\n]/.test(v) && (field.endsWith("email") || field === "uei" || field.includes("cage") || field.endsWith("phone"))) {
    return fail(`${field} contains invalid characters.`, field);
  }
  return { ok: true, value: v.trim() };
}

function asEnum(v: unknown, allowed: readonly string[], field: string): { ok: true; value: string } | NormalizeFail {
  if (v === "" || v === undefined) return { ok: true, value: "" };
  if (typeof v !== "string") return fail(`${field} must be a string.`, field);
  if (!allowed.includes(v)) return fail(`${field} is not an allowed value.`, field);
  return { ok: true, value: v };
}

function asEnumArray(
  v: unknown,
  allowed: readonly string[],
  field: string,
): { ok: true; value: string[] } | NormalizeFail {
  if (v === undefined) return { ok: true, value: [] };
  if (!Array.isArray(v)) return fail(`${field} must be an array.`, field);
  if (v.length > MAX_ENUM_ARRAY) return fail(`${field} has too many items.`, field);
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return fail(`${field} items must be strings.`, field);
    if (!allowed.includes(item)) return fail(`${field} contains an invalid value.`, field);
    out.push(item);
  }
  return { ok: true, value: out };
}

export function isValidEmail(s: string): boolean {
  if (!s) return false;
  if (s.length > LEN.email) return false;
  if (/[\r\n,]/.test(s) || /\s/.test(s)) return false;
  return EMAIL_RE.test(s);
}

export function isValidUei(s: string): boolean {
  return UEI_RE.test(s);
}

export { isValidCage, isValidCageList } from "./validate.ts";

function normalizeOneProvider(raw: unknown, index: number): { ok: true; value: ServiceProvider } | NormalizeFail {
  if (!isPlainObject(raw)) return fail(`sps[${index}] must be an object.`, `sps:${index}`);
  const extra = extraKeys(raw, PROVIDER_KEYS);
  if (extra.length) return fail("Unexpected field on a provider row.", `sps:${index}:${extra[0]}`);
  const base = emptyProvider();
  const name = asTrimmedString(raw.name ?? "", LEN.name, `sps:${index}:name`);
  if (!name.ok) return name;
  const email = asTrimmedString(raw.email ?? "", LEN.email, `sps:${index}:email`);
  if (!email.ok) return email;
  if (email.value && !isValidEmail(email.value)) return fail("Enter a valid provider email.", `sps:${index}:email`);
  const pocLast = asTrimmedString(raw.poc_last ?? "", LEN.name, `sps:${index}:poc_last`);
  if (!pocLast.ok) return pocLast;
  const pocFirst = asTrimmedString(raw.poc_first ?? "", LEN.name, `sps:${index}:poc_first`);
  if (!pocFirst.ok) return pocFirst;
  const pocPhone = asTrimmedString(raw.poc_phone ?? "", LEN.phone, `sps:${index}:poc_phone`);
  if (!pocPhone.ok) return pocPhone;
  const job = asEnum(raw.job ?? "", PROVIDER_JOBS, `sps:${index}:job`);
  if (!job.ok) return job;
  const serviceDesc = asTrimmedString(raw.service_desc ?? "", LEN.short, `sps:${index}:service_desc`);
  if (!serviceDesc.ok) return serviceDesc;
  const cui = asEnum(raw.cui_or_spd ?? "", CUI_VS_SPD, `sps:${index}:cui_or_spd`);
  if (!cui.ok) return cui;
  const fed = asEnum(raw.fedramp ?? "", PROVIDER_FEDRAMP, `sps:${index}:fedramp`);
  if (!fed.ok) return fed;
  const offering = asTrimmedString(raw.offering_name ?? "", LEN.offering, `sps:${index}:offering_name`);
  if (!offering.ok) return offering;
  const own = asEnum(raw.own_cmmc ?? "", YES_NO_NA, `sps:${index}:own_cmmc`);
  if (!own.ok) return own;
  const admin = asEnum(raw.admin_access ?? "", YES_NO_NA, `sps:${index}:admin_access`);
  if (!admin.ok) return admin;
  const crm = asEnum(raw.crm_inherited ?? "", YES_NO_NA, `sps:${index}:crm_inherited`);
  if (!crm.ok) return crm;
  const srm = asEnum(raw.vendor_srm ?? "", YES_NO_NA_ONLY, `sps:${index}:vendor_srm`);
  if (!srm.ok) return srm;
  const cmmc = asEnum(raw.spcmmcstatus ?? "", SP_CMMC_STATUS, `sps:${index}:spcmmcstatus`);
  if (!cmmc.ok) return cmmc;
  const spsector = asEnum(raw.spsector ?? "", CISA_SECTORS, `sps:${index}:spsector`);
  if (!spsector.ok) return spsector;
  return {
    ok: true,
    value: {
      ...base,
      name: name.value,
      email: email.value,
      poc_last: pocLast.value,
      poc_first: pocFirst.value,
      poc_phone: pocPhone.value,
      job: job.value as ServiceProvider["job"],
      service_desc: serviceDesc.value,
      cui_or_spd: cui.value as ServiceProvider["cui_or_spd"],
      fedramp: fed.value as ServiceProvider["fedramp"],
      offering_name: offering.value,
      own_cmmc: own.value as ServiceProvider["own_cmmc"],
      admin_access: admin.value as ServiceProvider["admin_access"],
      crm_inherited: crm.value as ServiceProvider["crm_inherited"],
      vendor_srm: srm.value as ServiceProvider["vendor_srm"],
      spcmmcstatus: cmmc.value as ServiceProvider["spcmmcstatus"],
      spsector: spsector.value as ServiceProvider["spsector"],
    },
  };
}

function normalizeHostTag(raw: unknown, index: number): { ok: true; value: CuiHostFedramp } | NormalizeFail {
  if (!isPlainObject(raw)) return fail(`cui_host_fedramp[${index}] must be an object.`, `cui_host_fedramp:${index}`);
  const extra = extraKeys(raw, HOST_KEYS);
  if (extra.length) return fail("Unexpected field on a CUI host row.", `cui_host_fedramp:${index}`);
  const host = asTrimmedString(raw.host ?? "", LEN.short, `cui_host_fedramp:${index}:host`);
  if (!host.ok) return host;
  if (host.value && !CUI_LOCATIONS.includes(host.value as (typeof CUI_LOCATIONS)[number])) {
    return fail("CUI host is not an allowed location.", `cui_host_fedramp:${index}:host`);
  }
  const fed = asEnum(raw.fedramp ?? "", HOST_FEDRAMP, `cui_host_fedramp:${index}:fedramp`);
  if (!fed.ok) return fed;
  const offering = asTrimmedString(raw.offering_name ?? "", CUI_PATH_NOTE_MAX, `cui_host_fedramp:${index}:offering_name`);
  if (!offering.ok) return offering;
  return {
    ok: true,
    value: {
      host: host.value,
      fedramp: fed.value as CuiHostFedramp["fedramp"],
      offering_name: offering.value,
    },
  };
}

/**
 * Server-side allowlist + type/length/enum checks. Starts from emptyAnswers().
 * Rejects arrays-as-objects, extra keys, and non-boolean consents.
 */
export function normalizeAnswers(raw: unknown): NormalizeResult {
  if (raw === null || raw === undefined) return fail("Missing answers.");
  if (Array.isArray(raw)) return fail("Answers must be an object, not an array.");
  if (!isPlainObject(raw)) return fail("Answers must be an object.");

  const extra = extraKeys(raw, ALLOWED_KEYS);
  if (extra.length) return fail("Unexpected field.", extra[0]);

  const out = emptyAnswers();

  for (const key of ALLOWED_KEYS) {
    const field = key as keyof FormAnswers;
    if (!(key in raw)) continue;
    const v = raw[key];

    if (field === "consent_nocui" || field === "consent_notassessment") {
      if (v !== true && v !== false) return fail(`${field} must be a boolean.`, field);
      out[field] = v;
      continue;
    }

    if (field === "sps") {
      if (!Array.isArray(v)) return fail("sps must be an array.", "sps");
      if (v.length > MAX_SPS) return fail("Too many service providers.", "sps");
      const rows: ServiceProvider[] = [];
      for (let i = 0; i < v.length; i++) {
        const row = normalizeOneProvider(v[i], i);
        if (!row.ok) return row;
        rows.push(row.value);
      }
      out.sps = rows;
      continue;
    }

    if (field === "cui_host_fedramp") {
      if (!Array.isArray(v)) return fail("cui_host_fedramp must be an array.", "cui_host_fedramp");
      if (v.length > MAX_HOST_TAGS) return fail("Too many CUI host rows.", "cui_host_fedramp");
      const rows: CuiHostFedramp[] = [];
      for (let i = 0; i < v.length; i++) {
        const row = normalizeHostTag(v[i], i);
        if (!row.ok) return row;
        rows.push(row.value);
      }
      out.cui_host_fedramp = rows;
      continue;
    }

    const arrEnum = STRING_ARRAY_ENUMS[field];
    if (arrEnum) {
      const arr = asEnumArray(v, arrEnum, field);
      if (!arr.ok) return arr;
      (out as unknown as Record<string, unknown>)[field] = arr.value;
      continue;
    }

    const strEnum = STRING_ENUMS[field];
    if (strEnum) {
      const ev = asEnum(v, strEnum, field);
      if (!ev.ok) return ev;
      (out as unknown as Record<string, unknown>)[field] = ev.value;
      continue;
    }

    const max = STRING_LIMITS[field] ?? LEN.short;
    const s = asTrimmedString(v, max, field);
    if (!s.ok) return s;
    let value = s.value;
    if (field === "hlocage") value = normalizeCage(value);
    if (field === "cageinscope") value = normalizeCageList(value);
    (out as unknown as Record<string, unknown>)[field] = value;
  }

  if (out.uei && !isValidUei(out.uei)) return fail("UEI must be 12 letters or digits.", "uei");
  if (out.hlocage && !isValidCage(out.hlocage)) return fail("CAGE must be 5 letters or digits.", "hlocage");
  if (out.cageinscope && !isValidCageList(out.cageinscope)) {
    return fail("In-scope CAGE must be 5-character codes, separated by semicolons.", "cageinscope");
  }
  if (out.ao_email && !isValidEmail(out.ao_email)) return fail("Enter a valid Assessment Official email.", "ao_email");
  if (out.tpoc_email && !isValidEmail(out.tpoc_email)) return fail("Enter a valid Technical POC email.", "tpoc_email");

  const synced = syncHeadcountAliases(out);
  out.cui_users = synced.cui_users;
  out.employees = synced.employees;
  out.employees_total = synced.employees_total;
  out.evidence_share = "Box";

  if (out.consent_nocui !== true || out.consent_notassessment !== true) {
    return fail("Both consents must be true to submit.");
  }

  return { ok: true, answers: out };
}

export function validateNormalizedAnswers(answers: FormAnswers): NormalizeFail | null {
  const gap = firstIncompleteGap(answers, "standard", stepsForPath("standard"), beatsForStep);
  if (!gap) return null;
  const first = Object.values(gap.errors)[0] || "Answers are incomplete.";
  return fail(first, Object.keys(gap.errors)[0]);
}
