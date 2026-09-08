import { brand } from "./brand.ts";
import { emassArtifactFilenames } from "./docs.ts";
import type { FormAnswers, ServiceProvider } from "./types.ts";
import { orgName } from "./types.ts";

/** C3PAO legal name as it appears on the Certificate of CMMC Status. Set in brand config. */
export const C3PAO_NAME = brand.legalName;

export const EMASS_PREASSESSMENT_TEMPLATE = "CMMC Level 2 Pre-Assessment Form (eMASS v3.9)";

export type PrefillCell = {
  field: string;
  value: string;
  /** intake = mapped from OSC answers; derived = C3PAO identity from brand config; c3pao = intentionally blank */
  origin: "intake" | "derived" | "c3pao";
  note?: string;
  /** Pre-Assessment xlsx target (Input column or official/ESP grid). Required-Data and Assessment Results reuse the same logical field where they overlap. */
  xlsx?: { sheet: string; cell: string };
};

/**
 * Form CMMC Status (OSC Discovery / `psc_spcmmcstatus`) → eMASS lookup.
 * Translate here only. Do not change OSC questions or convert Dataverse Choice → Text.
 *
 * | Form            | eMASS   | Why                                              |
 * |-----------------|---------|--------------------------------------------------|
 * | Not assessed    | None    | No CMMC status yet                               |
 * | Seeking L2      | None    | Seeking is not an achieved level                 |
 * | L2 Self         | Level 2 | Self-assessment at Level 2                       |
 * | L2 C3PAO        | Level 2 | C3PAO certification at Level 2                   |
 * | Unknown         | None    | Unknown is not a certified level                 |
 * | N/A             | None    | Not applicable → eMASS None                      |
 * | (empty)         | ""      | Leave the cell blank                             |
 *
 * Level 3 is never written from OSC Discovery — the form has no L3 option.
 */
export const EMASS_CMMC_STATUS_FROM_FORM: Record<string, "None" | "Level 2" | "Level 3"> = {
  "Not assessed": "None",
  "Seeking L2": "None",
  "L2 Self": "Level 2",
  "L2 C3PAO": "Level 2",
  Unknown: "None",
  "N/A": "None",
};

/** eMASS Sector / ESP Sector lookup (v3.9). Multi-select values are semicolon-separated. */
export const EMASS_SECTOR_LOOKUP = [
  "Application Service Provider",
  "Chemical",
  "Cloud Service Provider",
  "Commercial Facilities",
  "Communications",
  "Critical Manufacturing",
  "Dams",
  "Defense Industrial Base",
  "Emergency Services",
  "Food and Agriculture",
  "Government Facilities",
  "Healthcare and Public Health",
  "Information Technology",
  "Nuclear Reactors, Materials, and Waste",
  "Security Service Provider",
  "Transportation Systems",
  "Water and Wastewater Systems",
  "Other",
] as const;

const EMASS_SECTOR_SET = new Set<string>(EMASS_SECTOR_LOOKUP);

/**
 * CISA form sector → eMASS Sector lookup.
 * 1:1 labels pass through. Energy and Financial Services have no eMASS equivalent —
 * leave blank with a note. Other → "Other"; never write Sector (Other) free-text.
 * OSC is single-select; if multiple mapped values ever appear, join with "; ".
 */
export function translateSector(form: string): { value: string; note?: string } {
  const v = (form ?? "").trim();
  if (!v) return { value: "" };
  if (v === "Energy" || v === "Financial Services") {
    return {
      value: "",
      note: `${v} is not in the eMASS Sector lookup; left blank. Do not write Sector (Other) free-text.`,
    };
  }
  if (EMASS_SECTOR_SET.has(v)) return { value: v };
  return { value: "", note: `Sector "${v}" is not 1:1 with the eMASS lookup; left blank.` };
}

export function translateCmmcStatus(form: string): string {
  const v = (form ?? "").trim();
  if (!v) return "";
  return EMASS_CMMC_STATUS_FROM_FORM[v] ?? "";
}

export function emassCountry(form: string): string {
  return (form ?? "").trim() || "United States";
}

export type EspPrefillRow = {
  name: string;
  email: string;
  poc_last: string;
  poc_first: string;
  poc_phone: string;
  job: string;
  service_desc: string;
  cui_or_spd: string;
  fedramp: string;
  offering_name: string;
  own_cmmc: string;
  admin_access: string;
  crm_inherited: string;
  vendor_srm: string;
  spcmmcstatus: string;
  spsector: string;
};

export type InheritedHint = {
  espName: string;
  why: string;
  objectives: string[];
};

export type EmassPrefill = {
  oscName: string;
  cuiWhenFilled: boolean;
  preAssessment: {
    title: string;
    template: string;
    fields: PrefillCell[];
    leaveBlank: PrefillCell[];
    espRows: EspPrefillRow[];
  };
  results: {
    title: string;
    fields: PrefillCell[];
    ssp: PrefillCell[];
    standardsAcceptance: PrefillCell;
    inherited: InheritedHint[];
    interviewSeeds: PrefillCell[];
    leaveBlank: string[];
  };
  certificate: {
    title: string;
    fields: PrefillCell[];
    leaveBlank: PrefillCell[];
  };
};

function t(v: string | undefined | null): string {
  return (v ?? "").trim();
}

function hasGovHigh(a: FormAnswers): boolean {
  const locs = a.cui_locations || [];
  const blob = [a.env_mode, a.enclave_what, a.enclave_fedramp, a.esp_fedramp, a.esp_who, ...locs]
    .join(" ")
    .toLowerCase();
  return (
    locs.includes("M365 GCC High") ||
    locs.includes("Azure Government") ||
    a.env_mode === "GCC High tenant" ||
    /\bgcc high\b/.test(blob) ||
    /azure gov/.test(blob)
  );
}

function hasGccNotHigh(a: FormAnswers): boolean {
  const locs = a.cui_locations || [];
  const blob = [a.env_mode, a.enclave_what, a.enclave_fedramp, a.esp_fedramp, a.esp_who, ...locs]
    .join(" ")
    .toLowerCase();
  if (hasGovHigh(a)) return false;
  return locs.includes("M365 GCC") || (/\bgcc\b/.test(blob) && !/\bgcc high\b/.test(blob));
}

function hasCommercialOnly(a: FormAnswers): boolean {
  const locs = a.cui_locations || [];
  return (
    (locs.includes("M365 Commercial") || locs.includes("Email (non-PreVeil)")) &&
    !hasGovHigh(a) &&
    !hasGccNotHigh(a)
  );
}

/** FedRAMP High if GCC High / Azure Gov; FedRAMP Moderate if GCC; blank if Commercial. */
export function standardsAcceptanceHint(a: FormAnswers): string {
  if (hasGovHigh(a)) return "FedRAMP High";
  if (hasGccNotHigh(a)) return "FedRAMP Moderate";
  if (hasCommercialOnly(a)) return "";
  return "";
}

function hasPreveil(a: FormAnswers): boolean {
  const blob = [a.env_mode, a.enclave_what, a.esp_who, ...(a.cui_locations || [])].join(" ").toLowerCase();
  return a.env_mode === "PreVeil" || (a.cui_locations || []).includes("PreVeil") || /\bpreveil\b/.test(blob);
}

function hasGccHighCsp(a: FormAnswers): boolean {
  const locs = a.cui_locations || [];
  return (
    locs.includes("M365 GCC High") ||
    a.env_mode === "GCC High tenant" ||
    /gcc high/i.test(`${a.enclave_what} ${a.esp_who} ${a.env_mode}`)
  );
}

function namedMsps(a: FormAnswers): string[] {
  const fromTable = (a.sps || []).map((s) => t(s.name)).filter(Boolean);
  const who = t(a.esp_who);
  const extra: string[] = [];
  if (who) {
    for (const part of who.split(/\s*;\s*/)) {
      const name = part.replace(/\(.*?\)/g, "").trim();
      if (!name) continue;
      if (/microsoft|gcc high|csp for/i.test(name) && !/msp/i.test(name)) continue;
      if (/^none$|^n\/a$/i.test(name)) continue;
      extra.push(name);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...fromTable, ...extra]) {
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function sspCells(a: FormAnswers): PrefillCell[] {
  const exists = a.ssp_exists === "Yes" || a.ssp_exists === "Partial / in progress";
  const updated = t(a.ssp_updated);
  if (!exists && !updated) {
    return [
      { field: "OSC SSP(s) name", value: "", origin: "intake", note: "No SSP on intake (ssp_exists not Yes/Partial)." },
      { field: "OSC SSP(s) version", value: "", origin: "intake", note: "Not collected on OSC Discovery." },
      { field: "OSC SSP(s) date", value: "", origin: "intake" },
    ];
  }
  const name = exists ? `${orgName(a)} System Security Plan` : "";
  return [
    {
      field: "OSC SSP(s) name",
      value: name,
      origin: "intake",
      note: exists ? `ssp_exists = ${a.ssp_exists}` : "ssp_exists is not Yes/Partial; name left blank.",
    },
    {
      field: "OSC SSP(s) version",
      value: "",
      origin: "intake",
      note: "Version is not collected on OSC Discovery.",
    },
    {
      field: "OSC SSP(s) date",
      value: updated,
      origin: "intake",
      note: updated ? "From ssp_updated." : "ssp_updated blank.",
    },
  ];
}

function espRows(a: FormAnswers): EspPrefillRow[] {
  if (a.has_sps !== "Yes") return [];
  return (a.sps || [])
    .filter((s: ServiceProvider) => t(s.name))
    .map((s) => {
      const sector = translateSector(s.spsector);
      return {
        name: t(s.name),
        email: t(s.email),
        poc_last: t(s.poc_last),
        poc_first: t(s.poc_first),
        poc_phone: t(s.poc_phone),
        job: t(s.job),
        service_desc: t(s.service_desc) || t(s.job),
        cui_or_spd: t(s.cui_or_spd),
        fedramp: t(s.fedramp),
        offering_name: t(s.offering_name),
        own_cmmc: t(s.own_cmmc),
        admin_access: t(s.admin_access),
        crm_inherited: t(s.crm_inherited),
        vendor_srm: t(s.vendor_srm),
        spcmmcstatus: translateCmmcStatus(s.spcmmcstatus),
        spsector: sector.value,
      };
    });
}

function inheritedHints(a: FormAnswers): InheritedHint[] {
  const hints: InheritedHint[] = [];
  if (hasPreveil(a)) {
    hints.push({
      espName: "PreVeil",
      why: "PreVeil in the CUI path — likely inherited crypto / CUI-in-transit objectives. ESP Name only.",
      objectives: ["SC.L2-3.13.8", "SC.L2-3.13.11", "AC.L2-3.1.3"],
    });
  }
  if (hasGccHighCsp(a)) {
    hints.push({
      espName: "GCC High CSP",
      why: "GCC High cloud — likely inherited identity, logging, and CUI-at-rest objectives. ESP Name only.",
      objectives: ["IA.L2-3.5.3", "AU.L2-3.3.1", "AU.L2-3.3.2", "SC.L2-3.13.16", "SC.L2-3.13.11"],
    });
  }
  for (const msp of namedMsps(a)) {
    if (/^preveil$/i.test(msp) || /gcc high csp/i.test(msp)) continue;
    hints.push({
      espName: msp,
      why: "Named MSP/ESP from intake — ESP Name where shared/inherited is likely per CRM. ESP Name only.",
      objectives: ["SI.L2-3.14.6", "SI.L2-3.14.7", "AU.L2-3.3.1"],
    });
  }
  return hints;
}

function identityFilled(a: FormAnswers): boolean {
  return Boolean(
    t(a.hqname) ||
      t(a.uei) ||
      t(a.oscname) ||
      t(a.hlocage) ||
      t(a.cageinscope) ||
      t(a.ao_last) ||
      t(a.ao_first) ||
      t(a.tpoc_last) ||
      t(a.tpoc_first)
  );
}

function cell(field: string, value: string, note?: string, xlsx?: PrefillCell["xlsx"]): PrefillCell {
  return { field, value, origin: "intake", note, xlsx };
}

function blank(field: string, note: string, xlsx?: PrefillCell["xlsx"]): PrefillCell {
  return { field, value: "", origin: "c3pao", note, xlsx };
}

export function buildEmassPrefill(a: FormAnswers): EmassPrefill {
  const osc = orgName(a);
  const aoFirst = t(a.ao_first);
  const aoLast = t(a.ao_last);
  const tpocFirst = t(a.tpoc_first);
  const tpocLast = t(a.tpoc_last);
  const aoName = [aoFirst, aoLast].filter(Boolean).join(" ");
  const tpocName = [tpocFirst, tpocLast].filter(Boolean).join(" ");
  const acceptance = standardsAcceptanceHint(a);
  const sector = translateSector(a.sector);
  const country = emassCountry(a.country);
  const pa = "Pre-Assessment";
  const aoSheet = "OSC Assessment Official";
  const tpocSheet = "OSC Technical POC";

  return {
    oscName: osc,
    cuiWhenFilled: identityFilled(a),
    preAssessment: {
      title: "Pre-Assessment",
      template: EMASS_PREASSESSMENT_TEMPLATE,
      fields: [
        cell("HQ Organization Name", t(a.hqname), undefined, { sheet: pa, cell: "D6" }),
        cell("UEI", t(a.uei), undefined, { sheet: pa, cell: "D7" }),
        cell("OSC Name", t(a.oscname) || osc, undefined, { sheet: pa, cell: "D8" }),
        cell("Address Line 1", t(a.address1), undefined, { sheet: pa, cell: "D9" }),
        cell("Address Line 2", t(a.address2), undefined, { sheet: pa, cell: "D10" }),
        cell("City", t(a.city), undefined, { sheet: pa, cell: "D12" }),
        cell("State", t(a.state), undefined, { sheet: pa, cell: "D13" }),
        cell("Zip Code", t(a.zip), undefined, { sheet: pa, cell: "D14" }),
        cell(
          "Country",
          country,
          t(a.country) ? undefined : "Defaulted to United States when empty.",
          { sheet: pa, cell: "D15" }
        ),
        cell("Business Phone", t(a.businessphone), undefined, { sheet: pa, cell: "D16" }),
        cell("Web URL", t(a.website), undefined, { sheet: pa, cell: "D17" }),
        cell("Sector", sector.value, sector.note, { sheet: pa, cell: "D18" }),
        // Intake asks CUI-access users (`cui_users`), not org headcount. eMASS
        // Pre-Assessment still labels D20 "Number of Employees"; we fill it from
        // the CUI-access count. No separate org-headcount question — eMASS does
        // not need a distinct company-wide employee number beyond this cell.
        cell("Number of Employees", t(a.cui_users) || t(a.employees) || t(a.employees_total), undefined, { sheet: pa, cell: "D20" }),
        cell("HLO CAGE", t(a.hlocage), undefined, { sheet: pa, cell: "D21" }),
        cell("CAGE code(s) in scope", t(a.cageinscope), undefined, { sheet: pa, cell: "D22" }),
        cell("Scope (Enterprise|Enclave)", t(a.scopemode), undefined, { sheet: pa, cell: "D23" }),
        cell("Scope Description", t(a.scopedesc), undefined, { sheet: pa, cell: "D24" }),
        cell("Assessment Official Last Name", aoLast, undefined, { sheet: aoSheet, cell: "A6" }),
        cell("Assessment Official First Name", aoFirst, undefined, { sheet: aoSheet, cell: "B6" }),
        cell("Assessment Official Title", t(a.ao_title), undefined, { sheet: aoSheet, cell: "C6" }),
        cell("Assessment Official Email", t(a.ao_email), undefined, { sheet: aoSheet, cell: "D6" }),
        cell("Assessment Official Phone", t(a.ao_phone), undefined, { sheet: aoSheet, cell: "E6" }),
        cell("Technical POC Last Name", tpocLast, undefined, { sheet: tpocSheet, cell: "A6" }),
        cell("Technical POC First Name", tpocFirst, undefined, { sheet: tpocSheet, cell: "B6" }),
        cell("Technical POC Title", t(a.tpoc_title), undefined, { sheet: tpocSheet, cell: "C6" }),
        cell("Technical POC Email", t(a.tpoc_email), undefined, { sheet: tpocSheet, cell: "D6" }),
        cell("Technical POC Phone", t(a.tpoc_phone), undefined, { sheet: tpocSheet, cell: "E6" }),
      ],
      leaveBlank: [
        blank("Address Line 3", "Not collected. Leave blank.", { sheet: pa, cell: "D11" }),
        blank("Sector Other", "Do not put Sector (Other) free-text on the form.", { sheet: pa, cell: "D19" }),
        blank("C3PAO Contract Date", "C3PAO fills.", { sheet: pa, cell: "D25" }),
        blank("Assessment Planning Start", "C3PAO fills.", { sheet: pa, cell: "D26" }),
        blank("Assessment Planning Completion", "C3PAO fills.", { sheet: pa, cell: "D27" }),
        blank("Assessment Standard", "C3PAO fills.", { sheet: pa, cell: "D28" }),
        blank("C3PAO Assessment Fee", "C3PAO fills.", { sheet: pa, cell: "D29" }),
        blank("C3PAO Unique Identifier", "C3PAO fills. Not a CMMC UID. OSC is never asked for a CUID.", {
          sheet: pa,
          cell: "D30",
        }),
        blank("C3PAO Organization Name", "C3PAO fills.", { sheet: pa, cell: "D31" }),
        blank("Lead Assessor", "C3PAO fills."),
        blank("Team members", "C3PAO fills."),
      ],
      espRows: espRows(a),
    },
    results: {
      title: "Results stub",
      fields: [cell("OSC Name", t(a.oscname) || osc)],
      ssp: sspCells(a),
      standardsAcceptance: {
        field: "Standards Acceptance hint",
        value: acceptance,
        origin: "derived",
        note: acceptance
          ? "Hint only — FedRAMP High if GCC High / Azure Gov; FedRAMP Moderate if GCC; blank if Commercial."
          : "Blank (Commercial or not enough cloud signal). Do not treat as an authorization decision.",
      },
      inherited: inheritedHints(a),
      interviewSeeds: [
        cell("Interview names seed — Assessment Official", aoName),
        cell("Interview names seed — Technical POC", tpocName),
      ],
      leaveBlank: [
        "Score",
        "Findings",
        "Hash",
        "CPN",
        "Assessment dates",
        "MET / NOT MET",
        "CMMC UID",
      ],
    },
    certificate: {
      title: "Certificate identity",
      fields: [
        cell("HLO CAGE", t(a.hlocage)),
        cell("CAGE code(s) in scope", t(a.cageinscope)),
        cell("Enclave vs Enterprise", t(a.scopemode)),
        {
          field: "C3PAO Name",
          value: C3PAO_NAME,
          origin: "derived",
          note: "C3PAO identity from brand config — not from OSC.",
        },
      ],
      leaveBlank: [
        blank("CMMC UID", "Leave blank. Do not collect a CUID from the OSC."),
        blank("Assessment date", "Leave blank."),
        blank("Certificate date", "Leave blank."),
        blank("Expiration date", "Leave blank."),
      ],
    },
  };
}

export function safeOrgFilename(oscName: string): string {
  return (
    oscName.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().replace(/\.+$/, "").slice(0, 80) || "OSC"
  );
}

export type EmassFile = {
  filename: string;
  markdown: string;
  label: string;
};

function v(x: unknown): string {
  if (x === true) return "Yes";
  if (x === false) return "No";
  if (x === null || x === undefined || x === "") return "—";
  if (Array.isArray(x)) return x.length ? x.join("; ") : "—";
  return String(x);
}

function qa(label: string, value: unknown): string {
  return `**${label}**  \n${v(value)}`;
}

function fileBanner(title: string, osc: string, cuiWhenFilled: boolean, extra?: string): string[] {
  const lines: string[] = [];
  if (cuiWhenFilled) lines.push(`CUI`, ``);
  lines.push(
    `# ${title}`,
    ``,
    `Assessor only. 00 Internal — not on the customer Box (01 Answers / 02 Uploads).`,
    `Do not fill assessment scores. Do not collect a CMMC UID from the OSC.`,
    `C3PAO: ${C3PAO_NAME}`,
    `OSC: ${osc}`,
  );
  if (extra) lines.push(extra);
  lines.push(``);
  return lines;
}

function table(cells: PrefillCell[]): string[] {
  return [
    `| Field | Value |`,
    `| --- | --- |`,
    ...cells.map((c) => `| ${c.field} | ${c.value || "—"} |`),
    ``,
  ];
}

function footer(): string[] {
  return [
    `---`,
    ``,
    `_Prefill. Identity mapped from OSC Discovery answers. Not a CMMC assessment. Not an eMASS submission._`,
  ];
}

/** Filled Level 2 Scoping Call Discovery Script from intake answers. Own file — not merged. */
export function scopingGuideMarkdown(a: FormAnswers, p?: EmassPrefill): string {
  const pre = p ?? buildEmassPrefill(a);
  const lines: string[] = [
    ...fileBanner(
      "Level 2 Scoping Call Discovery Script — filled",
      pre.oscName,
      pre.cuiWhenFilled,
      "Filled from OSC Discovery environment answers. Submit as its own eMASS artifact."
    ),
    `---`,
    ``,
    `## People`,
    ``,
    qa("Users who access CUI", a.cui_users || a.employees_total || a.employees),
    ``,
    `## Devices`,
    ``,
    qa("Device classes", a.device_classes),
    ``,
    qa("Workstations", a.devices_workstations),
    ``,
    qa("Laptops", a.devices_laptops),
    ``,
    qa("Servers", a.devices_servers),
    ``,
    qa("Mobile", a.devices_mobile),
    ``,
    qa("Home / BYOD", a.devices_home),
    ``,
    `## Where CUI lives`,
    ``,
    qa("Where CUI lives today", a.cui_locations),
    ``,
    qa("Other location note", a.cui_locations_note),
    ``,
    `## How CUI enters and leaves`,
    ``,
    qa("CUI flow", a.cui_flow),
    ``,
    qa("Does CUI leave as paper, printer, or USB, including at home?", a.cui_leaves_portable),
    ``,
    qa("If people use VDI or a remote desktop, can they download or print?", a.vdi_download_print),
    ``,
    `## Enclave / CUI environment`,
    ``,
    qa("CUI environment", a.env_mode),
    ``,
    qa("Named enclave", a.enclave_what),
    ``,
    qa("Scope (Enterprise vs Enclave)", a.scopemode),
    ``,
    qa("Scope description", a.scopedesc),
    ``,
    qa("FedRAMP Moderate/High or equivalent?", a.enclave_fedramp),
    ``,
    `## Boundary and diagram`,
    ``,
    qa("CUI boundary defined?", a.boundary_defined),
    ``,
    qa("Network diagram exists?", a.network_diagram),
    ``,
    qa("Separation", a.separation),
    ``,
    `## Five asset categories (32 CFR 170.19)`,
    ``,
    qa("CUI Assets", a.count_cui_assets),
    ``,
    qa("Security Protection Assets (SPA)", a.count_spa),
    ``,
    qa("Contractor Risk Managed Assets (CRMA)", a.count_crma),
    ``,
    qa("CRMA enforcement", a.crma_enforce),
    ``,
    qa("CRMA systems kept off CUI by policy or control?", a.has_crma),
    ``,
    qa("Can those CRMA still handle CUI even by accident?", a.crma_handles_cui),
    ``,
    qa("Specialized kinds (GFE / OT / IoT / test)", a.specialized_kinds),
    ``,
    qa("Specialized (count / note)", a.count_specialized),
    ``,
    qa("Specialized notes", a.specialized_notes),
    ``,
    qa("Out-of-scope assets", a.count_oos),
    ``,
    qa("Can an out-of-scope asset still reach a CUI system?", a.oos_can_reach_cui),
    ``,
    qa("Out-of-scope justification", a.oos_justification),
    ``,
    `## Monitoring`,
    ``,
    qa("Continuous monitoring tool", a.contmon_tool),
    ``,
    qa("Who reviews", a.contmon_who),
    ``,
    qa("How often", a.contmon_howoften),
    ``,
    `## MFA`,
    ``,
    qa("MFA solution", a.mfa_solution),
    ``,
    qa("Where MFA is enforced", a.mfa_coverage),
    ``,
    qa("Accounts not covered", a.mfa_uncovered),
    ``,
    `### Service providers from intake`,
    ``,
  ];
  const sps = (a.sps || []).filter((s) => (s.name || "").trim());
  if (!sps.length) {
    lines.push(`None listed.`, ``);
  } else {
    for (const [i, s] of sps.entries()) {
      lines.push(`**Provider ${i + 1}**  `);
      lines.push(`${s.name} · ${v(s.email)} · ${v([s.poc_last, s.poc_first].filter(Boolean).join(", "))} · ${v(s.poc_phone)} · ${v(s.job)} · ${v(s.service_desc || s.job)} · ${v(s.cui_or_spd)}`);
      lines.push(
        `FedRAMP: ${v(s.fedramp)}${s.offering_name ? ` (${s.offering_name})` : ""} · own CMMC ${v(s.own_cmmc)} · CMMC Status ${v(s.spcmmcstatus)} · sector ${v(s.spsector)} · admin/backup/logs ${v(s.admin_access)} · CRM inherited ${v(s.crm_inherited)} · vendor SRM ${v(s.vendor_srm)}`,
        ``
      );
    }
  }
  lines.push(
    `## SSP`,
    ``,
    qa("SSP exists?", a.ssp_exists),
    ``,
    qa("SSP last updated", a.ssp_updated),
    ``,
    qa("SSP matches reality?", a.ssp_matches),
    ``,
    `## Inventory`,
    ``,
    qa("Asset inventory exists (with categories)?", a.inventory_exists),
    ``,
    qa("Inventory current?", a.inventory_current),
    ``,
    `## POA&M`,
    ``,
    qa("Any POA&M / temporary deficiencies?", a.poam_open),
    ``,
    qa("POA&M notes", a.poam_notes),
    ``,
    `## Evidence`,
    ``,
    qa("Evidence share method", "Box (required)"),
    ``,
    qa("Expect to fix remaining gaps during the assessment itself?", a.fix_during_assessment),
    ``,
    ...footer()
  );
  return lines.join("\n");
}

/** eMASS v3.9 Pre-Assessment fields OSC provided. Own file — not merged. */
export function preAssessmentMarkdown(p: EmassPrefill): string {
  const lines: string[] = [
    ...fileBanner(
      `Pre-Assessment — ${p.preAssessment.template}`,
      p.oscName,
      p.cuiWhenFilled,
      "OSC-provided identity only. Contract date, planning dates, assessment standard, fee, C3PAO UID, lead assessor, and team stay blank."
    ),
    `---`,
    ``,
    ...table(p.preAssessment.fields),
    `### ESP rows`,
    ``,
  ];
  if (!p.preAssessment.espRows.length) {
    lines.push(`None listed on intake.`, ``);
  } else {
    lines.push(
      `| Name | Email | POC | Phone | Job | Service | CUI vs SPD | FedRAMP | Offering | Own CMMC | CMMC Status | Sector | Admin/logs | CRM | Vendor SRM |`,
      `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`
    );
    for (const r of p.preAssessment.espRows) {
      const poc = [r.poc_last, r.poc_first].filter(Boolean).join(", ");
      lines.push(
        `| ${r.name || "—"} | ${r.email || "—"} | ${poc || "—"} | ${r.poc_phone || "—"} | ${r.job || "—"} | ${r.service_desc || "—"} | ${r.cui_or_spd || "—"} | ${r.fedramp || "—"} | ${r.offering_name || "—"} | ${r.own_cmmc || "—"} | ${r.spcmmcstatus || "—"} | ${r.spsector || "—"} | ${r.admin_access || "—"} | ${r.crm_inherited || "—"} | ${r.vendor_srm || "—"} |`
      );
    }
    lines.push(``);
  }
  lines.push(`### Leave blank (C3PAO fills)`, ``);
  for (const c of p.preAssessment.leaveBlank) {
    lines.push(`- **${c.field}** — ${c.note || "leave blank"}`);
  }
  lines.push(``, ...footer());
  return lines.join("\n");
}

/** OSC Information / data template. Own file — not folded into Pre-Assessment. */
export function dataTemplateMarkdown(a: FormAnswers, p?: EmassPrefill): string {
  const pre = p ?? buildEmassPrefill(a);
  const sector = a.sector === "Other" ? `Other — ${a.sectorother}` : a.sector;
  const address = [a.address1, a.address2].filter((x) => (x || "").trim()).join(", ");
  const lines: string[] = [
    ...fileBanner(
      "OSC Information — Data Template",
      pre.oscName,
      pre.cuiWhenFilled,
      "Identity spine only. Separate eMASS artifact — do not fold into the Pre-Assessment form."
    ),
    `---`,
    ``,
    `## Organization`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| HQ Organization Name | ${v(a.hqname)} |`,
    `| UEI | ${v(a.uei)} |`,
    `| OSC Name | ${v(a.oscname)} |`,
    `| Address | ${v(address)} |`,
    `| City | ${v(a.city)} |`,
    `| State | ${v(a.state)} |`,
    `| ZIP | ${v(a.zip)} |`,
    `| Country | ${v(a.country)} |`,
    `| Business phone | ${v(a.businessphone)} |`,
    `| Website | ${v(a.website)} |`,
    `| Sector | ${v(sector)} |`,
    `| Number of employees (CUI-access users) | ${v(a.cui_users || a.employees)} |`,
    `| HLO CAGE | ${v(a.hlocage)} |`,
    `| CAGE code(s) in scope | ${v(a.cageinscope)} |`,
    `| Scope (Enterprise vs Enclave) | ${v(a.scopemode)} |`,
    `| Scope description | ${v(a.scopedesc)} |`,
    ``,
    `## Assessment Official`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| Last name | ${v(a.ao_last)} |`,
    `| First name | ${v(a.ao_first)} |`,
    `| Title | ${v(a.ao_title)} |`,
    `| Email | ${v(a.ao_email)} |`,
    `| Phone | ${v(a.ao_phone)} |`,
    ``,
    `## Technical POC`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| Last name | ${v(a.tpoc_last)} |`,
    `| First name | ${v(a.tpoc_first)} |`,
    `| Title | ${v(a.tpoc_title)} |`,
    `| Email | ${v(a.tpoc_email)} |`,
    `| Phone | ${v(a.tpoc_phone)} |`,
    ``,
    `## Service providers`,
    ``,
    qa("Any service providers in this environment?", a.has_sps),
    ``,
  ];
  const sps = (a.sps || []).filter((s) => (s.name || "").trim());
  if (!sps.length) {
    lines.push(`None listed.`, ``);
  } else {
    lines.push(
      `| Name | Email | POC | Phone | Job | Service | CUI vs SPD | FedRAMP | Offering | Own CMMC | CMMC Status | Sector | Admin/logs | CRM | Vendor SRM |`,
      `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`
    );
    for (const s of sps) {
      const poc = [s.poc_last, s.poc_first].filter(Boolean).join(", ");
      lines.push(
        `| ${v(s.name)} | ${v(s.email)} | ${v(poc)} | ${v(s.poc_phone)} | ${v(s.job)} | ${v(s.service_desc || s.job)} | ${v(s.cui_or_spd)} | ${v(s.fedramp)} | ${v(s.offering_name)} | ${v(s.own_cmmc)} | ${v(s.spcmmcstatus)} | ${v(s.spsector)} | ${v(s.admin_access)} | ${v(s.crm_inherited)} | ${v(s.vendor_srm)} |`
      );
    }
    lines.push(``);
  }
  lines.push(...footer());
  return lines.join("\n");
}

/** Assessment Results Form stub only. Never scores, MET/NOT MET, hash, CPN, CMMC UID, findings, or dates. */
export function assessmentResultsStubMarkdown(p: EmassPrefill): string {
  const lines: string[] = [
    ...fileBanner(
      "Assessment Results Form — stub",
      p.oscName,
      p.cuiWhenFilled,
      "Stub only. Do not set Score, MET/NOT MET, hash, CPN, CMMC UID, findings, or dates of assessment."
    ),
    `---`,
    ``,
    ...table(p.results.fields),
    `### OSC SSP(s)`,
    ``,
    ...table(p.results.ssp),
    `### Standards Acceptance`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| ${p.results.standardsAcceptance.field} | ${p.results.standardsAcceptance.value || "—"} |`,
    ``,
  ];
  if (p.results.standardsAcceptance.note) {
    lines.push(`_${p.results.standardsAcceptance.note}_`, ``);
  }
  const espSeen = new Set<string>();
  const espNames: string[] = [];
  for (const n of [
    ...p.preAssessment.espRows.map((r) => r.name),
    ...p.results.inherited.map((h) => h.espName),
  ]) {
    const name = (n || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (espSeen.has(key)) continue;
    espSeen.add(key);
    espNames.push(name);
  }
  lines.push(`### ESP names`, ``);
  if (!espNames.length) {
    lines.push(`None listed on intake.`, ``);
  } else {
    for (const n of espNames) lines.push(`- ${n}`);
    lines.push(``);
  }
  lines.push(
    `### Objectives — ESP Name where inherited likely`,
    ``,
    `_ESP Name only. Do **not** set Score, Findings, Hash, CPN, dates, or MET/NOT MET._`,
    ``
  );
  if (!p.results.inherited.length) {
    lines.push(`No PreVeil, GCC High CSP, or named MSP inheritance hinted from intake.`, ``);
  } else {
    lines.push(`| ESP Name | Likely objectives (hint) | Note |`, `| --- | --- | --- |`);
    for (const h of p.results.inherited) {
      lines.push(`| ${h.espName} | ${h.objectives.join(", ")} | ${h.why} |`);
    }
    lines.push(``);
  }
  lines.push(`### Interview names seed`, ``);
  for (const c of p.results.interviewSeeds) {
    lines.push(`- ${c.field}: ${c.value || "—"}`);
  }
  lines.push(
    ``,
    `### Leave blank — do not fill from intake`,
    ``,
    `- **Score**`,
    `- **MET / NOT MET**`,
    `- **Hash**`,
    `- **CPN**`,
    `- **CMMC UID**`,
    `- Findings`,
    `- Assessment dates`,
    ``
  );
  lines.push(``, ...footer());
  return lines.join("\n");
}

export function emassXlsxFilenames(oscName: string): {
  preAssessment: string;
  requiredData: string;
  assessmentResults: string;
} {
  const org = safeOrgFilename(oscName);
  return {
    preAssessment: `CUI-Pre-Assessment-${org}.xlsx`,
    requiredData: `CUI-Required-Data-OSC-${org}.xlsx`,
    assessmentResults: `CUI-Assessment-Results-${org}.xlsx`,
  };
}

export function emassPackFilenames(oscName: string): string[] {
  const n = emassArtifactFilenames(oscName);
  return [n.scoping, n.preAssessment, n.dataTemplate, n.resultsStub];
}

/** Four separate eMASS artifacts. Not one merged workbook. Certificate is not a file. */
export function buildEmassPack(a: FormAnswers, p?: EmassPrefill): EmassFile[] {
  const pre = p ?? buildEmassPrefill(a);
  const n = emassArtifactFilenames(pre.oscName);
  return [
    {
      filename: n.scoping,
      markdown: scopingGuideMarkdown(a, pre),
      label: "Scoping Guide",
    },
    {
      filename: n.preAssessment,
      markdown: preAssessmentMarkdown(pre),
      label: "Pre-Assessment",
    },
    {
      filename: n.dataTemplate,
      markdown: dataTemplateMarkdown(a, pre),
      label: "Data Template",
    },
    {
      filename: n.resultsStub,
      markdown: assessmentResultsStubMarkdown(pre),
      label: "Results stub",
    },
  ];
}
