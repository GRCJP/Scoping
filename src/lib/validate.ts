import type { StepId } from "./path";
import type { FormAnswers, IntakePath } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAGE_RE = /^[A-Za-z0-9]{5}$/;
const CAGE_LIST_RE = /^[A-Za-z0-9]{5}(?:\s*;\s*[A-Za-z0-9]{5})*$/;
const CAGE_LIST_MAX = 80;

export const CAGE_LEN = 5;
export const CAGE_LIST_LEN = CAGE_LIST_MAX;

/** Uppercase while typing. Do not trim — that fights the caret. */
export function normalizeCageTyping(s: string): string {
  return s.toUpperCase();
}

/** Stored / blur form: trim + uppercase. */
export function normalizeCage(s: string): string {
  return s.trim().toUpperCase();
}

/** Semicolon list: trim, uppercase, collapse "; " spacing. */
export function normalizeCageList(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/\s*;\s*/g, "; ");
}

/** Product rule: one CAGE is five letters or digits (Harborline 8H2LP, 1H9QX, 4P0TT). */
export function isValidCage(s: string): boolean {
  return CAGE_RE.test(s);
}

/** Semicolon-separated 5-character CAGEs. Same rule as normalize-answers. */
export function isValidCageList(s: string): boolean {
  if (s.length > CAGE_LIST_MAX) return false;
  return CAGE_LIST_RE.test(s);
}

export type CageFieldKey = "hlocage" | "cageinscope";

/** Required + 5-char A–Z0–9 (case-insensitive). Empty and "12" both fail. */
export function cageFieldError(key: CageFieldKey, value: string): string | undefined {
  const v = value.trim();
  if (key === "hlocage") {
    if (!v) return "Highest Level Owner CAGE is required.";
    if (!isValidCage(v)) return "CAGE must be 5 letters or digits.";
    return undefined;
  }
  if (!v) return "In-scope CAGE code(s) required (semicolons if several).";
  if (!isValidCageList(v)) return "In-scope CAGE must be 5-character codes, separated by semicolons.";
  return undefined;
}

/** Company Next/blur gate. Other P1 fields are not in this object. */
export function companyCageErrors(a: FormAnswers): Record<string, string> {
  const e: Record<string, string> = {};
  const hlo = cageFieldError("hlocage", a.hlocage);
  const inscope = cageFieldError("cageinscope", a.cageinscope);
  if (hlo) e.hlocage = hlo;
  if (inscope) e.cageinscope = inscope;
  return e;
}

export function validateStep(
  step: StepId,
  a: FormAnswers,
  _path: IntakePath | null
): Record<string, string> {
  const e: Record<string, string> = {};
  const need = (key: keyof FormAnswers, msg: string) => {
    const v = a[key];
    if (v === "" || v === false || v === undefined || v === null) e[key as string] = msg;
    if (Array.isArray(v) && v.length === 0) e[key as string] = msg;
  };

  if (step === "P1") {
    need("hqname", "HQ organization name is required.");
    need("uei", "UEI is required.");
    need("oscname", "OSC name is required.");
    need("address1", "Address line 1 is required.");
    need("city", "City is required.");
    need("state", "State is required.");
    need("country", "Country is required.");
    need("sector", "Sector is required.");
    if (!a.cui_users.trim()) {
      e.cui_users = "How many users will access CUI is required.";
    }
    const hlo = cageFieldError("hlocage", a.hlocage);
    if (hlo) e.hlocage = hlo;
    const inscope = cageFieldError("cageinscope", a.cageinscope);
    if (inscope) e.cageinscope = inscope;
    need("scopemode", "Select Enterprise or Enclave.");
    if (a.scopemode === "Enclave") need("scopedesc", "Scope description is required for an enclave.");
  }

  if (step === "P2") {
    need("ao_last", "Assessment Official last name is required.");
    need("ao_first", "Assessment Official first name is required.");
    need("ao_title", "Assessment Official title is required.");
    need("ao_email", "Assessment Official email is required.");
    if (a.ao_email && !EMAIL.test(a.ao_email)) e.ao_email = "Enter a valid email.";
    need("ao_phone", "Assessment Official phone is required.");
    need("tpoc_last", "Technical POC last name is required.");
    need("tpoc_first", "Technical POC first name is required.");
    need("tpoc_title", "Technical POC title is required.");
    need("tpoc_email", "Technical POC email is required.");
    if (a.tpoc_email && !EMAIL.test(a.tpoc_email)) e.tpoc_email = "Enter a valid email.";
    need("tpoc_phone", "Technical POC phone is required.");
  }

  if (step === "P3") {
    need("has_sps", "Say whether you have service providers, or skip with No / N/A.");
    if (a.has_sps === "Yes") {
      const rows = a.sps || [];
      const named = rows.filter((s) => s.name.trim());
      if (!named.length) e.sps = "Add at least one provider, or select No / N/A.";
      rows.forEach((s, i) => {
        const prefix = `sps:${i}`;
        if (!s.name.trim()) e[`${prefix}:name`] = "Provider name is required.";
        if (!s.email.trim()) e[`${prefix}:email`] = "One POC email is required.";
        else if (!EMAIL.test(s.email)) e[`${prefix}:email`] = "Enter a valid email.";
        if (!s.poc_last.trim()) e[`${prefix}:poc_last`] = "POC last name is required.";
        if (!s.poc_first.trim()) e[`${prefix}:poc_first`] = "POC first name is required.";
        if (!s.poc_phone.trim()) e[`${prefix}:poc_phone`] = "POC phone is required.";
        if (!s.job) e[`${prefix}:job`] = "What does this provider do here?";
        if (!s.cui_or_spd) e[`${prefix}:cui_or_spd`] = "CUI vs security-protection data.";
        if (s.job === "CSP") {
          if (!s.fedramp) e[`${prefix}:fedramp`] = "CSP authorization is required.";
          if (s.fedramp === "FedRAMP Authorized" && !s.offering_name.trim()) {
            e[`${prefix}:offering_name`] = "Marketplace service offering name is required.";
          }
        }
        if (!s.own_cmmc) e[`${prefix}:own_cmmc`] = "Does this provider need its own CMMC status?";
        if (!s.spcmmcstatus) e[`${prefix}:spcmmcstatus`] = "CMMC Status is required.";
        if (!s.admin_access) e[`${prefix}:admin_access`] = "Admin, backup, or log access?";
        if (!s.crm_inherited) e[`${prefix}:crm_inherited`] = "Written CRM that names inherited vs OSC-owned?";
        if (!s.vendor_srm) e[`${prefix}:vendor_srm`] = "Vendor shared-responsibility / product matrix on file?";
      });
    }
  }

  if (step === "E1") {
    need("interview_roles_namable", "Can you name the roles we should interview?");
  }

  if (step === "E2") {
    need("cui_locations", "Where does CUI live today?");
    if ((a.cui_locations || []).includes("Other") && !a.cui_locations_note.trim()) {
      e.cui_locations_note = "Short write-in for Other.";
    }
    const hosts = (a.cui_locations || []).filter((h) => h !== "N/A / not sure");
    const tags = a.cui_host_fedramp || [];
    for (const host of hosts) {
      const tag = tags.find((t) => t.host === host);
      if (!tag || !tag.fedramp) {
        e.cui_host_fedramp = "Authorization for each CUI host.";
        e[`cui_host_fedramp:${host}`] = "Required.";
      } else if (tag.fedramp === "FedRAMP Authorized" && !tag.offering_name.trim()) {
        e.cui_host_fedramp = "Marketplace service offering name for each FedRAMP Authorized host.";
        e[`cui_host_fedramp:${host}:offering`] = "Marketplace service offering name.";
      }
    }
    need("env_mode", "GCC High tenant, PreVeil, other named enclave, broader environment, or N/A?");
    if (a.env_mode === "Other named enclave") need("enclave_what", "Name the enclave.");
    need("boundary_defined", "Is the CUI boundary defined?");
    need("network_diagram", "Does a network diagram exist?");
    need("diagram_vs_matrix", "Have the network diagram and the applicability matrix been walked against each other?");
    need("separation", "Logical vs physical separation.");
    need("cui_leaves_portable", "Does CUI leave as paper, printer, or USB, including at home?");
    need("vdi_download_print", "If people use VDI or a remote desktop, can they download or print?");
    need("cui_off_hq", "Is CUI handled at sites other than HQ?");
    if (a.cui_off_hq === "Yes") need("other_sites", "Name sites besides HQ (city or site name only).");
    need("cui_backup_commercial", "Do backups of CUI sit in a commercial (non-gov) location?");
    need("cui_backup_where", "Where do CUI backups live (product class only)?");
    need("physical_cui_observe", "Is there physical CUI we would need to observe?");
    need("virtual_tour_exposes_cui", "Would a site walkthrough put CUI on screen or in the room?");
    need("dlp_blocks_screenshare", "Can we screenshare live system configs without CUI appearing on the call?");
  }

  if (step === "E3") {
    need("has_crma", "Do you have systems kept off CUI by policy or technical control (CRMA)?");
    if (a.has_crma === "Yes") {
      need("crma_handles_cui", "Can any of those CRMA still store, process, or transmit CUI even by accident?");
    }
    need("oos_can_reach_cui", "Can an out-of-scope asset still reach a CUI system?");
  }

  if (step === "E4") {
    need("mfa_solution", "MFA solution is required. Name the MFA product or service in use.");
    need("mfa_coverage", "Where is MFA enforced?");
    need("ssp_exists", "Does an SSP exist?");
    if (a.ssp_exists === "Yes" || a.ssp_exists === "Partial / in progress") {
      need("ssp_artifacts_exist", "Do supporting SSP artifacts exist?");
      if (a.ssp_artifacts_exist === "Yes") {
        need("ssp_artifact_types", "Name the artifact types that exist today. Types only.");
      }
    }
    need("poam_open", "Any POA&M / temporary deficiencies?");
    if (a.poam_open === "Yes") {
      need("poam_conditional", "Are any POA&Ms conditional (time-boxed / allowed)?");
    }
    need("fix_during_assessment", "Will gaps be fixed during the assessment?");
    need("freeze_during_assessment", "Is a freeze planned during the assessment window?");
    need("migrate_during_assessment", "Is a migration planned during the assessment window?");
  }

  if (step === "G") {
    if (!a.consent_nocui) {
      e.consent_nocui = "You must confirm nothing submitted is CUI, a UID, or a SPRS score.";
    }
    if (!a.consent_notassessment) {
      e.consent_notassessment = "You must confirm this is not a CMMC assessment.";
    }
  }

  return e;
}

/** Submit-time consents: require the answer flags, not checkbox UI state. */
export function consentsAccepted(a: FormAnswers): boolean {
  return a.consent_nocui === true && a.consent_notassessment === true;
}

/** Validate only the fields on the current intra-step beat. */
export function validateBeat(
  step: StepId,
  fields: string[],
  a: FormAnswers,
  path: IntakePath | null
): Record<string, string> {
  const all = validateStep(step, a, path);
  if (!fields.length) return {};
  const e: Record<string, string> = {};
  for (const [key, msg] of Object.entries(all)) {
    if (fields.some((f) => key === f || key.startsWith(`${f}:`))) e[key] = msg;
  }
  return e;
}

export type IncompleteGap = {
  stepId: StepId;
  stepIdx: number;
  beatIdx: number;
  errors: Record<string, string>;
  summary: { nav: string; messages: string[] }[];
};

/** First missing required field across P1–P3, E1–E4, G. Used only on Submit. */
export function firstIncompleteGap(
  a: FormAnswers,
  path: IntakePath | null,
  steps: { id: StepId; nav: string }[],
  beatsFor: (step: StepId, answers: FormAnswers) => { fields: string[] }[],
): IncompleteGap | null {
  const summary: { nav: string; messages: string[] }[] = [];
  let first: { stepId: StepId; stepIdx: number; beatIdx: number; errors: Record<string, string> } | null =
    null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const errors = validateStep(step.id, a, path);
    const messages = [...new Set(Object.values(errors))];
    if (!messages.length) continue;
    const consents = (["consent_nocui", "consent_notassessment"] as const)
      .map((key) => errors[key])
      .filter((m): m is string => Boolean(m));
    summary.push({ nav: step.nav, messages: consents });
    if (first) continue;
    const beats = beatsFor(step.id, a);
    let beatIdx = 0;
    let beatErrors = errors;
    for (let b = 0; b < beats.length; b++) {
      const beatErrs = validateBeat(step.id, beats[b].fields, a, path);
      if (Object.keys(beatErrs).length) {
        beatIdx = b;
        beatErrors = beatErrs;
        break;
      }
    }
    first = { stepId: step.id, stepIdx: i, beatIdx, errors: beatErrors };
  }

  if (!first) return null;
  return { ...first, summary };
}

/** First incomplete intra-step beat, or 0 when the step is complete. Used by the rail. */
export function firstIncompleteBeatIdx(
  stepId: StepId,
  a: FormAnswers,
  path: IntakePath | null,
  beatsFor: (step: StepId, answers: FormAnswers) => { fields: string[] }[],
): number {
  const beats = beatsFor(stepId, a);
  for (let b = 0; b < beats.length; b++) {
    if (Object.keys(validateBeat(stepId, beats[b].fields, a, path)).length) return b;
  }
  return 0;
}
