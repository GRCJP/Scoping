import { existsSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  buildEmassPrefill,
  emassXlsxFilenames,
  type EmassPrefill,
  type EspPrefillRow,
  type PrefillCell,
} from "./emass.ts";
import type { FormAnswers } from "./types.ts";
import {
  ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED,
  ASSESSMENT_RESULTS_STUB_REJECTED,
  acceptOfficialAssessmentResultsOutput,
  isAssessmentResultsStubSheetSet,
  isOfficialAssessmentResultsSheetSet,
  xlsxWorksheetNames,
} from "./assessment-results-sheets.ts";

export {
  ASSESSMENT_RESULTS_OFFICIAL_REQUIRED_SHEETS,
  ASSESSMENT_RESULTS_OFFICIAL_SHEETS,
  ASSESSMENT_RESULTS_STUB_REJECTED,
} from "./assessment-results-sheets.ts";

/** Blank UNCLASSIFIED templates. Filled copies are CUI (When Filled In). */
export const PREASSESSMENT_TEMPLATE = "docs/emass/CMMC-L2-Pre-Assessment-Form-v3.9.xlsx";
export const REQUIRED_DATA_TEMPLATE = "docs/emass/Required-Data-OSC.xlsx";
/**
 * Official eMASS Assessment Results blank is not committed (CAC / eMASS portal).
 * Expected Box TEMPLATE name: `CMMC_Level2_AssessmentResults_Template.xlsx`
 * (also accepted without the .xlsx suffix). Live Box / container must download
 * that blank (`BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID` or Templates folder
 * aliases) and pass the bytes in. Fill writes cells only — never add, delete,
 * or rename sheets. A mapping stub exists for mock/dev only
 * (`allowAssessmentResultsStub: true`) — never upload it (Cover + thin tabs).
 */
export const ASSESSMENT_RESULTS_TEMPLATE = "docs/emass/CMMC_Level2_AssessmentResults_Template.xlsx";
export const ASSESSMENT_RESULTS_BOX_BLANK = "CMMC_Level2_AssessmentResults_Template.xlsx";
export const ASSESSMENT_RESULTS_BOX_BLANK_ALIASES = [
  ASSESSMENT_RESULTS_BOX_BLANK,
  "CMMC_Level2_AssessmentResults_Template",
] as const;

/** Live Box: refuse to invent a thin workbook that drops official tabs. */
export const ASSESSMENT_RESULTS_TEMPLATE_MISSING =
  "Assessment Results blank is missing. Set BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID to the official CMMC L2 AR v3.9 blank in your Box Templates folder. Do not use a Cover stub named CMMC_Level2_AssessmentResults_Template.xlsx. Refusing to upload a stub that drops official tabs.";

export const ASSESSMENT_RESULTS_NOT_OFFICIAL =
  "Assessment Results bytes are not the official v3.9 blank (need Assessment, Requirements, Requirement Objectives, OSC SSP(s)). Set BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID to CMMC_Level2_AssessmentResults_Template in your Box Templates folder.";

export class AssessmentResultsTemplateMissingError extends Error {
  constructor(message = ASSESSMENT_RESULTS_TEMPLATE_MISSING) {
    super(message);
    this.name = "AssessmentResultsTemplateMissingError";
  }
}

/** Mock/dev may build the thin stub. Live Box / container must not. */
export type FillEmassXlsxOptions = {
  allowAssessmentResultsStub?: boolean;
  /**
   * Live Box / container: do not read Assessment Results from disk.
   * Only explicit `templates.assessmentResults` bytes (from Box) are filled.
   */
  assessmentResultsFromBytesOnly?: boolean;
  /** How many workbooks to fill at once (1–3). Default 3. Worker Track B uses 1. */
  concurrency?: number;
};

export const CUI_WHEN_FILLED_BANNER = "***** CUI (When Filled In) *****";

/**
 * After Submit: fill these workbooks from OSC answers, THEN upload the filled
 * bytes to Box 00 Internal. Never upload the blank template. Never email the
 * filled xlsx. Production F2 calls the same fill — this module is the source
 * of the Box file. No Box connector here.
 */
export const EMASS_XLSX_BOX_NOTE =
  "CUI (When Filled In). Box 00 Internal only. Never email the filled xlsx.";

const REQUIRED_DATA_COMPANY: Record<string, string> = {
  "HQ Organization Name": "D2",
  UEI: "D3",
  "OSC Name": "D4",
  "Address Line 1": "D5",
  "Address Line 2": "D6",
  City: "D8",
  State: "D9",
  "Zip Code": "D10",
  Country: "D11",
  "Business Phone": "D12",
  "Web URL": "D13",
  Sector: "D14",
  "Number of Employees": "D16",
  "HLO CAGE": "D17",
  "CAGE code(s) in scope": "D18",
  "Scope (Enterprise|Enclave)": "D19",
  "Scope Description": "D20",
};

const REQUIRED_DATA_OFFICIAL: Record<string, { sheet: string; cell: string }> = {
  "Assessment Official Last Name": { sheet: "OSC Assessment Official", cell: "A3" },
  "Assessment Official First Name": { sheet: "OSC Assessment Official", cell: "B3" },
  "Assessment Official Title": { sheet: "OSC Assessment Official", cell: "C3" },
  "Assessment Official Email": { sheet: "OSC Assessment Official", cell: "D3" },
  "Assessment Official Phone": { sheet: "OSC Assessment Official", cell: "E3" },
  "Technical POC Last Name": { sheet: "OSC Technical Official", cell: "A3" },
  "Technical POC First Name": { sheet: "OSC Technical Official", cell: "B3" },
  "Technical POC Title": { sheet: "OSC Technical Official", cell: "C3" },
  "Technical POC Email": { sheet: "OSC Technical Official", cell: "D3" },
  "Technical POC Phone": { sheet: "OSC Technical Official", cell: "E3" },
};

/** Stub Assessment Information sheet — same Input column as Required-Data. */
const ASSESSMENT_RESULTS_COMPANY: Record<string, string> = { ...REQUIRED_DATA_COMPANY };

/**
 * Official v3.9 Assessment Results targets. Cells are resolved by label scan
 * on Assessment / OSC SSP(s) — never hardcoded Cover-stub sheets
 * (Cover, Assessment Information, OSC Assessment Official, …).
 *
 * Official eMASS blanks are a header row (values on the next empty row in
 * that column) or a vertical Data Field / Input form. The in-repo fixture is
 * vertical Input-column; live Box `CMMC_Level2_AssessmentResults_Template`
 * is the official header-row layout. Match either. Never add Cover.
 */
export const ASSESSMENT_RESULTS_OFFICIAL: Record<string, { sheet: string }> = {
  "HQ Organization Name": { sheet: "Assessment" },
  UEI: { sheet: "Assessment" },
  "OSC Name": { sheet: "Assessment" },
  "Address Line 1": { sheet: "Assessment" },
  "Address Line 2": { sheet: "Assessment" },
  City: { sheet: "Assessment" },
  State: { sheet: "Assessment" },
  "Zip Code": { sheet: "Assessment" },
  Country: { sheet: "Assessment" },
  "Business Phone": { sheet: "Assessment" },
  "Web URL": { sheet: "Assessment" },
  Sector: { sheet: "Assessment" },
  "Number of Employees": { sheet: "Assessment" },
  "HLO CAGE": { sheet: "Assessment" },
  "CAGE code(s) in scope": { sheet: "Assessment" },
  "Scope (Enterprise|Enclave)": { sheet: "Assessment" },
  "Scope Description": { sheet: "Assessment" },
  "Assessment Official Last Name": { sheet: "Assessment" },
  "Assessment Official First Name": { sheet: "Assessment" },
  "Assessment Official Title": { sheet: "Assessment" },
  "Assessment Official Email": { sheet: "Assessment" },
  "Assessment Official Phone": { sheet: "Assessment" },
  "Technical POC Last Name": { sheet: "Assessment" },
  "Technical POC First Name": { sheet: "Assessment" },
  "Technical POC Title": { sheet: "Assessment" },
  "Technical POC Email": { sheet: "Assessment" },
  "Technical POC Phone": { sheet: "Assessment" },
  "OSC SSP(s) name": { sheet: "OSC SSP(s)" },
  "OSC SSP(s) date": { sheet: "OSC SSP(s)" },
};

/** Official / stub labels that overlap intake. Never invent scores. */
const OVERLAP_LABEL_ALIASES: Record<string, string[]> = {
  "HQ Organization Name": ["hq organization name", "hq organization"],
  UEI: ["uei", "unique entity identifier"],
  "OSC Name": [
    "osc name",
    "organization seeking certification",
    "organization seeking certification name",
    "osc full legal name",
    "organization name",
    "osc organization name",
  ],
  "Address Line 1": ["address line 1", "osc address line 1"],
  "Address Line 2": ["address line 2", "osc address line 2"],
  City: ["city", "osc city"],
  State: ["state", "osc state"],
  "Zip Code": ["zip code", "osc zip code", "zip"],
  Country: ["country", "osc country"],
  "Business Phone": ["business phone", "osc business phone"],
  "Web URL": ["web url", "osc business web url", "website"],
  Sector: ["sector"],
  "Number of Employees": ["number of employees"],
  "HLO CAGE": [
    "hlo cage",
    "highest level owner (hlo) cage code",
    "highest level owner cage code",
    "hlo cage code",
  ],
  "CAGE code(s) in scope": [
    "cage code(s) in scope",
    "cage codes in scope",
    "cage code(s) in scope",
    "cage code",
    "cage codes",
    "osc cage",
    "osc cage code",
    "osc cage code(s)",
    "industry cage codes",
    "industry cage code(s)",
  ],
  "Scope (Enterprise|Enclave)": ["scope (enterprise|enclave)", "scope", "assessment scope"],
  "Scope Description": ["scope description", "assessment scope description"],
  "Assessment Official Last Name": ["assessment official last name", "osc assessment official last name"],
  "Assessment Official First Name": ["assessment official first name", "osc assessment official first name"],
  "Assessment Official Title": ["assessment official title", "osc assessment official title"],
  "Assessment Official Email": ["assessment official email", "osc assessment official email"],
  "Assessment Official Phone": ["assessment official phone", "osc assessment official phone"],
  "Technical POC Last Name": ["technical poc last name", "osc technical poc last name"],
  "Technical POC First Name": ["technical poc first name", "osc technical poc first name"],
  "Technical POC Title": ["technical poc title", "osc technical poc title"],
  "Technical POC Email": ["technical poc email", "osc technical poc email"],
  "Technical POC Phone": ["technical poc phone", "osc technical poc phone"],
  "OSC SSP(s) name": [
    "osc ssp(s) name",
    "osc ssp name",
    "ssp name",
    "system security plan name",
    "ssp title",
  ],
  "OSC SSP(s) date": ["osc ssp(s) date", "osc ssp date", "ssp date", "system security plan date"],
};

const C3PAO_ONLY_LABEL = /^(score|met|not met|met \/ not met|hash|cpn|cmmc uid|cuid|findings?|assessment dates?|date of assessment|status date|expiration date|lead assessor|c3pao unique identifier|artifact hash|hashing algorithm)$/i;

/**
 * Official CMMC L2 AR v3.9 Requirement Objectives — same boilerplate on every
 * objective/control data row. Column letters are the product contract:
 * H = Overall Comments, P = Findings. Do not invent MET / NOT MET / Score.
 */
export const REQUIREMENT_OBJECTIVES_SHEET = "Requirement Objectives";
export const REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS_COL = "H";
export const REQUIREMENT_OBJECTIVES_FINDINGS_COL = "P";
export const REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS =
  "Enforcement observations conducted and validated via live demonstration and system walkthroughs. Confirmed corroboration and alignment of documentation against technical implementation.";
export const REQUIREMENT_OBJECTIVES_FINDINGS =
  "The assessor determined the test objective was met based upon adequate and sufficient evidence provided. A discussion of the evidence provided can be found in the Artifacts, Interviews, Examine, and Test fields.";

/** AC.L2-3.1.1 / AC.L2-3.1.1[a] — assessor data rows, not title/header text. */
const CMMC_OBJECTIVE_OR_CONTROL_ID =
  /[A-Z]{2}\.L[1-3]-\d{1,2}\.\d{1,2}(?:\.\d{1,2})?(?:\s*\[[a-z]\])?/i;

export function isCmmcObjectiveOrControlId(text: string): boolean {
  return CMMC_OBJECTIVE_OR_CONTROL_ID.test(text.trim());
}

export type FilledEmassXlsx = {
  filename: string;
  buffer: Buffer;
  contentType: string;
  cuiWhenFilled: true;
  handling: typeof EMASS_XLSX_BOX_NOTE;
};

export type EmassXlsxPack = {
  preAssessment: FilledEmassXlsx;
  requiredData: FilledEmassXlsx;
  assessmentResults?: FilledEmassXlsx;
  /** Set when official bytes were missing and stub was not allowed (live Box). */
  assessmentResultsSkipped?: string;
};

/** Blank template bytes when the caller has no filesystem (Workers, Containers). Same mapper. */
export type EmassTemplateBytes = {
  preAssessment?: Uint8Array;
  requiredData?: Uint8Array;
  assessmentResults?: Uint8Array;
};

function repoRoot(cwd = process.cwd()): string {
  return cwd;
}

function templatePath(rel: string, cwd = process.cwd()): string {
  return path.join(repoRoot(cwd), rel);
}

function formulaCellResult(value: ExcelJS.CellValue): ExcelJS.CellValue | undefined {
  if (value && typeof value === "object" && "formula" in value) {
    return "result" in value ? (value as { result?: ExcelJS.CellValue }).result : undefined;
  }
  return undefined;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "formula" in value) {
    const result = formulaCellResult(value);
    return result == null ? "" : cellText(result);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((p) => p.text ?? "").join("");
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  return String(value);
}

function isEffectivelyEmpty(value: ExcelJS.CellValue): boolean {
  return !cellText(value).trim();
}

function setInput(sheet: ExcelJS.Worksheet | undefined, cell: string, value: string) {
  if (!sheet || !value) return;
  sheet.getCell(cell).value = value;
}

function writeEspRow(sheet: ExcelJS.Worksheet, row: number, r: EspPrefillRow) {
  const cells: [string, string][] = [
    [`A${row}`, r.name],
    [`B${row}`, r.poc_last],
    [`C${row}`, r.poc_first],
    [`D${row}`, r.poc_phone],
    [`E${row}`, r.email],
    [`F${row}`, r.service_desc],
    [`G${row}`, r.spcmmcstatus],
    [`H${row}`, r.spsector],
  ];
  for (const [ref, value] of cells) {
    if (value) sheet.getCell(ref).value = value;
  }
  // Sector (Other) — I column — stays blank.
}

function normalizeLabel(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[:*]+$/g, "")
    .replace(/\s*\(required.*$/i, "")
    .trim()
    .toLowerCase();
}

function stripLabelDecorations(normalized: string): string {
  return normalized
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isC3paoOnlyLabel(label: string): boolean {
  return C3PAO_ONLY_LABEL.test(normalizeLabel(label));
}

/** Box TEMPLATE lookup: case-insensitive, .xlsx optional, spaces/underscores/hyphens equivalent. */
export function normalizeEmassBlankName(name: string): string {
  return name.trim().toLowerCase().replace(/\.xlsx$/i, "").replace(/[\s_\-]+/g, "");
}

export function isAssessmentResultsBlankName(fileName: string): boolean {
  const n = normalizeEmassBlankName(fileName);
  if (!n || n.startsWith("cui")) return false;
  return ASSESSMENT_RESULTS_BOX_BLANK_ALIASES.some((alias) => normalizeEmassBlankName(alias) === n);
}

function worksheetNames(wb: ExcelJS.Workbook): string[] {
  return wb.worksheets.map((s) => s.name);
}

export function isAssessmentResultsStubWorkbook(wb: ExcelJS.Workbook): boolean {
  return isAssessmentResultsStubSheetSet(worksheetNames(wb));
}

export function isOfficialAssessmentResultsWorkbook(wb: ExcelJS.Workbook): boolean {
  return isOfficialAssessmentResultsSheetSet(worksheetNames(wb));
}

function assertSheetsPreserved(before: string[], wb: ExcelJS.Workbook) {
  const after = worksheetNames(wb);
  if (before.length !== after.length || before.some((name, i) => name !== after[i])) {
    throw new Error(
      `Assessment Results fill must not add, delete, or rename sheets. Before: ${before.join(", ") || "(none)"}. After: ${after.join(", ") || "(none)"}.`,
    );
  }
}

/**
 * assertSheetsPreserved() only sees the in-memory workbook. exceljs can also
 * drop a sheet when it *serializes*, so the object model looks right and the
 * uploaded file is missing tabs. Re-read the emitted bytes with the
 * zip-level reader (no exceljs) and fail before the file reaches Box.
 */
function assertSheetsPreservedInBytes(before: string[], bytes: Uint8Array) {
  const after = xlsxWorksheetNames(bytes);
  if (after.length === 0) {
    throw new Error(
      "Assessment Results fill produced bytes with no readable sheets. Refusing to upload.",
    );
  }
  const missing = before.filter((name) => !after.includes(name));
  if (missing.length > 0) {
    throw new Error(
      `Assessment Results fill dropped sheets on write. Missing: ${missing.join(", ")}. Emitted: ${after.join(", ")}.`,
    );
  }
}

const ASSESSMENT_RESULTS_ESP_SHEETS = [
  "OSC Service Provider Info",
  "OSC ESP Info",
  "ESP",
  "External Service Providers",
  "Service Providers",
  "Service Provider",
] as const;

function findEspSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  for (const name of ASSESSMENT_RESULTS_ESP_SHEETS) {
    const sheet = wb.getWorksheet(name);
    if (sheet && !sheetLooksLikeScoreGrid(sheet)) return sheet;
  }
  return wb.worksheets.find((s) => /esp|service provider/i.test(s.name) && !sheetLooksLikeScoreGrid(s));
}

function sheetLooksLikeScoreGrid(sheet: ExcelJS.Worksheet): boolean {
  const header = [1, 2].flatMap((n) => {
    const row = sheet.getRow(n);
    const texts: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      const t = normalizeLabel(cellText(cell.value));
      if (t) texts.push(t);
    });
    return texts;
  });
  const joined = header.join(" | ");
  return /\bscore\b/.test(joined) && /\b(met|findings?|hash|cpn)\b/.test(joined);
}

function isInputHeaderLabel(label: string): boolean {
  const n = stripLabelDecorations(normalizeLabel(label));
  return n === "input" || n === "input value" || n === "osc input" || n === "assessment input";
}

/** Column to write vertical-form values. Undefined when the sheet has no Input header. */
function inputColumn(sheet: ExcelJS.Worksheet): number | undefined {
  for (let r = 1; r <= 20; r++) {
    const row = sheet.getRow(r);
    let found = 0;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (isInputHeaderLabel(cellText(cell.value))) found = col;
    });
    if (found) return found;
  }
  return undefined;
}

export function fieldByOverlapLabel(label: string): string | undefined {
  const n = normalizeLabel(label);
  if (!n || isC3paoOnlyLabel(n)) return undefined;
  // C3PAO org / UID headers must not match "organization name".
  if (/\bc3pao\b/.test(n) && !/assessment official/.test(n)) return undefined;
  for (const [field, aliases] of Object.entries(OVERLAP_LABEL_ALIASES)) {
    if (aliases.includes(n)) return field;
  }
  const stripped = stripLabelDecorations(n);
  if (!stripped || isC3paoOnlyLabel(stripped)) return undefined;
  for (const [field, aliases] of Object.entries(OVERLAP_LABEL_ALIASES)) {
    if (aliases.includes(stripped)) return field;
  }
  if (/\bhlo\b/.test(n) && /\bcage\b/.test(n)) return "HLO CAGE";
  if (/\bcage\b/.test(n) && /\bscope\b/.test(n)) return "CAGE code(s) in scope";
  if (/\bcage code/.test(n) && !/\bhlo\b/.test(n)) return "CAGE code(s) in scope";
  if (/\bosc name\b/.test(n) || n === "organization seeking certification") return "OSC Name";
  if (stripped === "organization name" || stripped === "osc full legal name") return "OSC Name";
  if (/\bscope description\b/.test(n)) return "Scope Description";
  if (stripped === "scope" || stripped === "assessment scope") return "Scope (Enterprise|Enclave)";
  if (/\bssp/.test(n) && /\bname\b/.test(n)) return "OSC SSP(s) name";
  if (/\bssp/.test(n) && /\btitle\b/.test(n)) return "OSC SSP(s) name";
  if (/\bssp/.test(n) && /\bdate\b/.test(n)) return "OSC SSP(s) date";
  return OVERLAP_LABEL_COMPACT[stripped.replace(/[^a-z0-9]/g, "")];
}

const OVERLAP_LABEL_COMPACT: Record<string, string> = {
  oscname: "OSC Name",
  organizationname: "OSC Name",
  oscfullname: "OSC Name",
  hqorganizationname: "HQ Organization Name",
  uniqueentityidentifier: "UEI",
  hlocage: "HLO CAGE",
  hlocagecode: "HLO CAGE",
  cagecode: "CAGE code(s) in scope",
  cagecodes: "CAGE code(s) in scope",
  osccage: "CAGE code(s) in scope",
  osccagecode: "CAGE code(s) in scope",
  osccagecodes: "CAGE code(s) in scope",
  industrycagecodes: "CAGE code(s) in scope",
  assessmentscope: "Scope (Enterprise|Enclave)",
  scopedescription: "Scope Description",
  sspname: "OSC SSP(s) name",
  oscsspname: "OSC SSP(s) name",
  oscsspsname: "OSC SSP(s) name",
  systemsecurityplanname: "OSC SSP(s) name",
  sspdate: "OSC SSP(s) date",
  oscsspdate: "OSC SSP(s) date",
};

function overlapValue(pre: EmassPrefill, field: string): string {
  const fromIdentity = pre.preAssessment.fields.find((c) => c.field === field);
  if (fromIdentity?.value && fromIdentity.origin !== "c3pao") return fromIdentity.value;
  const fromSsp = pre.results.ssp.find((c) => c.field === field);
  if (fromSsp?.value && fromSsp.origin !== "c3pao") return fromSsp.value;
  return "";
}

function columnHeaderLooksC3pao(sheet: ExcelJS.Worksheet, colNumber: number): boolean {
  for (const r of [1, 2]) {
    if (isC3paoOnlyLabel(cellText(sheet.getRow(r).getCell(colNumber).value))) return true;
  }
  return false;
}

const AR_DO_NOT_SCAN = new Set<string>([
  "Requirements",
  "Requirement Objectives",
  "Example",
  "Instructions",
  "Glossary",
  "Version History",
  "Lookup Values",
  "Score Grid",
  "Cover",
]);

function isHeaderGridSheet(name: string): boolean {
  return /^(OSC Assessment Official|OSC Technical Official|OSC Technical POC)$/i.test(name);
}

function rowHasObjectiveOrControlId(row: ExcelJS.Row): boolean {
  let hit = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (isCmmcObjectiveOrControlId(cellText(cell.value))) hit = true;
  });
  return hit;
}

/**
 * Header row is the first row that labels H as Overall Comments and/or P as
 * Findings (official v3.9). Title/banner rows above it must not be filled.
 */
function requirementObjectivesHeaderRow(sheet: ExcelJS.Worksheet): number {
  const max = Math.min(sheet.rowCount || 1, 16);
  for (let r = 1; r <= max; r++) {
    const row = sheet.getRow(r);
    const atH = normalizeLabel(cellText(row.getCell(REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS_COL).value));
    const atP = normalizeLabel(cellText(row.getCell(REQUIREMENT_OBJECTIVES_FINDINGS_COL).value));
    if (atH === "overall comments" || atP === "findings" || atP === "finding") return r;
    let labeled = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const n = normalizeLabel(cellText(cell.value));
      if (n === "overall comments" || n === "findings") labeled = true;
    });
    if (labeled) return r;
  }
  return 1;
}

/** Cells only — never add/delete/rename the Requirement Objectives sheet. */
function fillRequirementObjectivesPrefill(wb: ExcelJS.Workbook) {
  const sheet = wb.getWorksheet(REQUIREMENT_OBJECTIVES_SHEET);
  if (!sheet) return;
  const headerRow = requirementObjectivesHeaderRow(sheet);
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    if (!rowHasObjectiveOrControlId(row)) return;
    row.getCell(REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS_COL).value = REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS;
    row.getCell(REQUIREMENT_OBJECTIVES_FINDINGS_COL).value = REQUIREMENT_OBJECTIVES_FINDINGS;
  });
}

function rowLooksLikeFieldHeader(sheet: ExcelJS.Worksheet, rowNumber: number): boolean {
  const row = sheet.getRow(rowNumber);
  let fieldHits = 0;
  let nonempty = 0;
  row.eachCell({ includeEmpty: false }, (cell) => {
    const text = cellText(cell.value);
    if (!text.trim()) return;
    nonempty += 1;
    if (fieldByOverlapLabel(text)) fieldHits += 1;
  });
  if (fieldHits >= 2) return true;
  return rowNumber <= 2 && fieldHits >= 1 && nonempty >= 3;
}

function destCellForOverlap(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  colNumber: number,
  inputCol: number | undefined,
): ExcelJS.Cell | undefined {
  if (isHeaderGridSheet(sheet.name) || rowLooksLikeFieldHeader(sheet, rowNumber)) {
    for (let r = rowNumber + 1; r <= rowNumber + 8; r++) {
      const dest = sheet.getCell(r, colNumber);
      if (isC3paoOnlyLabel(cellText(dest.value))) return undefined;
      if (fieldByOverlapLabel(cellText(dest.value))) return undefined;
      if (isEffectivelyEmpty(dest.value)) return dest;
    }
    return undefined;
  }

  if (inputCol && inputCol !== colNumber) {
    if (columnHeaderLooksC3pao(sheet, inputCol)) return undefined;
    const dest = sheet.getCell(rowNumber, inputCol);
    if (isC3paoOnlyLabel(cellText(dest.value))) return undefined;
    if (!isEffectivelyEmpty(dest.value)) return undefined;
    return dest;
  }

  for (let c = colNumber + 1; c <= colNumber + 6; c++) {
    if (columnHeaderLooksC3pao(sheet, c)) continue;
    const dest = sheet.getCell(rowNumber, c);
    if (isC3paoOnlyLabel(cellText(dest.value))) continue;
    if (fieldByOverlapLabel(cellText(dest.value))) continue;
    if (isEffectivelyEmpty(dest.value)) return dest;
  }
  return undefined;
}

/** Official blank: write overlapping identity/scope labels only. Never write Score / MET / NOT MET. */
function fillOverlappingByLabel(wb: ExcelJS.Workbook, pre: EmassPrefill) {
  for (const sheet of wb.worksheets) {
    if (AR_DO_NOT_SCAN.has(sheet.name) || sheetLooksLikeScoreGrid(sheet)) continue;
    const destCol = inputColumn(sheet);
    const lastRow = Math.min(Math.max(sheet.rowCount || 1, 80), 250);
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > lastRow) return;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const label = cellText(cell.value);
        if (isC3paoOnlyLabel(label)) return;
        const field = fieldByOverlapLabel(label);
        if (!field) return;
        const value = overlapValue(pre, field);
        if (!value) return;
        const dest = destCellForOverlap(sheet, rowNumber, colNumber, destCol);
        if (!dest) return;
        dest.value = value;
      });
    });
  }
}

function createAssessmentResultsStubWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const cover = wb.addWorksheet("Cover");
  cover.getCell("A1").value = CUI_WHEN_FILLED_BANNER;
  cover.getCell("A2").value = "Assessment Results — identity/scope from OSC Discovery. Score grids stay blank.";

  const info = wb.addWorksheet("Assessment Information");
  info.getCell("A1").value = "Data Field";
  info.getCell("D1").value = "Input";

  const companyRows: [string, string][] = [
    ["A2", "HQ Organization Name"],
    ["A3", "UEI"],
    ["A4", "OSC Name"],
    ["A5", "OSC Address Line 1"],
    ["A6", "OSC Address Line 2"],
    ["A7", "OSC Address Line 3"],
    ["A8", "OSC City"],
    ["A9", "OSC State"],
    ["A10", "OSC Zip Code"],
    ["A11", "OSC Country"],
    ["A12", "OSC Business Phone"],
    ["A13", "OSC Business Web URL"],
    ["A14", "Sector"],
    ["A15", "Sector (Other)"],
    ["A16", "Number of Employees"],
    ["A17", "Highest Level Owner (HLO) CAGE Code"],
    ["A18", "CAGE Code(s) in Scope"],
    ["A19", "Scope"],
    ["A20", "Scope Description"],
  ];
  for (const [ref, label] of companyRows) info.getCell(ref).value = label;

  const c3paoRows: [string, string][] = [
    ["A22", "Score"],
    ["A23", "MET / NOT MET"],
    ["A24", "Hash"],
    ["A25", "CPN"],
    ["A26", "CMMC UID"],
    ["A27", "Findings"],
    ["A28", "Assessment dates"],
    ["A29", "C3PAO-only — do not fill from intake"],
  ];
  for (const [ref, label] of c3paoRows) info.getCell(ref).value = label;
  info.getCell("A31").value = "OSC SSP(s) name";
  info.getCell("A32").value = "OSC SSP(s) date";

  const ao = wb.addWorksheet("OSC Assessment Official");
  ao.getCell("A2").value = "Assessment Official Last Name";
  ao.getCell("B2").value = "Assessment Official First Name";
  ao.getCell("C2").value = "Assessment Official Title";
  ao.getCell("D2").value = "Assessment Official Email";
  ao.getCell("E2").value = "Assessment Official Phone";

  const tpoc = wb.addWorksheet("OSC Technical Official");
  tpoc.getCell("A2").value = "OSC Technical POC Last Name";
  tpoc.getCell("B2").value = "OSC Technical POC First Name";
  tpoc.getCell("C2").value = "OSC Technical POC Title";
  tpoc.getCell("D2").value = "OSC Technical POC Email";
  tpoc.getCell("E2").value = "OSC Technical POC Phone";

  const esp = wb.addWorksheet("OSC Service Provider Info");
  esp.getCell("A2").value = "Service Provider Name";
  esp.getCell("B2").value = "Service Provider POC Last Name";
  esp.getCell("C2").value = "Service Provider POC First Name";
  esp.getCell("D2").value = "Service Provider POC Phone";
  esp.getCell("E2").value = "Service Provider POC Email";
  esp.getCell("F2").value = "Service Provider Service Enclave Description";
  esp.getCell("G2").value = "CMMC Status";
  esp.getCell("H2").value = "Service Provider Sector";

  const scores = wb.addWorksheet("Score Grid");
  scores.getCell("A1").value = "Practice ID";
  scores.getCell("B1").value = "Score";
  scores.getCell("C1").value = "MET / NOT MET";
  scores.getCell("D1").value = "Findings";
  scores.getCell("E1").value = "Hash";
  scores.getCell("F1").value = "CPN";
  scores.getCell("A2").value = "AC.L2-3.1.1";
  scores.getCell("A3").value = "AC.L2-3.1.2";
  scores.getCell("A4").value = "AC.L2-3.1.3";
  return wb;
}

function rejectNonOfficialAssessmentResults(wb: ExcelJS.Workbook, allowStub: boolean) {
  if (allowStub) return;
  if (isAssessmentResultsStubWorkbook(wb)) {
    throw new AssessmentResultsTemplateMissingError(ASSESSMENT_RESULTS_STUB_REJECTED);
  }
  if (!isOfficialAssessmentResultsWorkbook(wb)) {
    throw new AssessmentResultsTemplateMissingError(ASSESSMENT_RESULTS_NOT_OFFICIAL);
  }
}

async function loadAssessmentResultsTemplate(
  cwd?: string,
  bytes?: Uint8Array,
  allowStub = false,
  bytesOnly = false,
): Promise<{ wb: ExcelJS.Workbook; source: "bytes" | "path" | "stub" }> {
  if (bytes && bytes.byteLength > 0) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(excelLoadBuffer(bytes));
    rejectNonOfficialAssessmentResults(wb, allowStub);
    return { wb, source: "bytes" };
  }
  if (!bytesOnly && cwd) {
    const full = templatePath(ASSESSMENT_RESULTS_TEMPLATE, cwd);
    if (existsSync(full)) {
      const wb = await loadTemplate(ASSESSMENT_RESULTS_TEMPLATE, cwd);
      rejectNonOfficialAssessmentResults(wb, allowStub);
      return { wb, source: "path" };
    }
  }
  // Live / container always set assessmentResultsFromBytesOnly. Never invent
  // Cover + thin tabs when official Box bytes were omitted — skip instead.
  if (allowStub && !bytesOnly) return { wb: createAssessmentResultsStubWorkbook(), source: "stub" };
  throw new AssessmentResultsTemplateMissingError();
}

type ExcelLoadBuffer = Parameters<ExcelJS.Xlsx["load"]>[0];

async function loadTemplate(rel: string, cwd?: string, bytes?: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (bytes) {
    await wb.xlsx.load(excelLoadBuffer(bytes));
    return wb;
  }
  await wb.xlsx.readFile(templatePath(rel, cwd));
  return wb;
}

function excelLoadBuffer(data: Uint8Array): ExcelLoadBuffer {
  // Node 22 Buffer and exceljs Buffer do not overlap; load() still accepts the bytes.
  return Buffer.from(data) as unknown as ExcelLoadBuffer;
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

function writePrefillCells(
  wb: ExcelJS.Workbook,
  cells: PrefillCell[],
  resolve: (c: PrefillCell) => { sheet: string; cell: string } | undefined
) {
  for (const c of cells) {
    if (c.origin === "c3pao") continue;
    const dest = resolve(c);
    if (!dest || !c.value) continue;
    setInput(wb.getWorksheet(dest.sheet), dest.cell, c.value);
  }
}

function fillFromPrefill(
  wb: ExcelJS.Workbook,
  pre: EmassPrefill,
  kind: "pre-assessment" | "required-data" | "assessment-results",
) {
  if (kind === "pre-assessment") {
    writePrefillCells(wb, pre.preAssessment.fields, (c) => c.xlsx);
    const banner = wb.getWorksheet("Pre-Assessment")?.getCell("A1");
    if (banner && cellText(banner.value) !== CUI_WHEN_FILLED_BANNER) {
      throw new Error("Pre-Assessment CUI banner missing — do not delete sheets or the classification label.");
    }
    const esp = wb.getWorksheet("OSC ESP Info");
    if (esp && pre.preAssessment.espRows.length) {
      pre.preAssessment.espRows.forEach((row, i) => writeEspRow(esp, 6 + i, row));
    }
    return;
  }

  if (kind === "assessment-results") {
    // Stub-only hardcoded cells. Official v3.9 has no Assessment Information sheet.
    if (wb.getWorksheet("Assessment Information")) {
      writePrefillCells(wb, pre.preAssessment.fields, (c) => {
        if (c.origin === "c3pao") return undefined;
        const company = ASSESSMENT_RESULTS_COMPANY[c.field];
        if (company) return { sheet: "Assessment Information", cell: company };
        const stubOfficial = REQUIRED_DATA_OFFICIAL[c.field];
        if (stubOfficial && wb.getWorksheet(stubOfficial.sheet)) return stubOfficial;
        return undefined;
      });
    }
    const esp = findEspSheet(wb);
    if (esp && pre.preAssessment.espRows.length) {
      const start = esp.name === "OSC ESP Info" ? 6 : 3;
      pre.preAssessment.espRows.forEach((row, i) => writeEspRow(esp, start + i, row));
    }
    fillOverlappingByLabel(wb, pre);
    fillRequirementObjectivesPrefill(wb);
    return;
  }

  writePrefillCells(wb, pre.preAssessment.fields, (c) => {
    const company = REQUIRED_DATA_COMPANY[c.field];
    if (company) return { sheet: "OSC Information", cell: company };
    return REQUIRED_DATA_OFFICIAL[c.field];
  });
  const esp = wb.getWorksheet("OSC Service Provider Info");
  if (esp && pre.preAssessment.espRows.length) {
    pre.preAssessment.espRows.forEach((row, i) => writeEspRow(esp, 3 + i, row));
  }
}

export async function fillPreAssessmentXlsx(
  answers: FormAnswers,
  cwd?: string,
  templateBytes?: Uint8Array,
): Promise<FilledEmassXlsx> {
  const pre = buildEmassPrefill(answers);
  const wb = await loadTemplate(PREASSESSMENT_TEMPLATE, cwd, templateBytes);
  fillFromPrefill(wb, pre, "pre-assessment");
  const names = emassXlsxFilenames(pre.oscName);
  return {
    filename: names.preAssessment,
    buffer: await toBuffer(wb),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    cuiWhenFilled: true,
    handling: EMASS_XLSX_BOX_NOTE,
  };
}

export async function fillRequiredDataXlsx(
  answers: FormAnswers,
  cwd?: string,
  templateBytes?: Uint8Array,
): Promise<FilledEmassXlsx> {
  const pre = buildEmassPrefill(answers);
  const wb = await loadTemplate(REQUIRED_DATA_TEMPLATE, cwd, templateBytes);
  fillFromPrefill(wb, pre, "required-data");
  const names = emassXlsxFilenames(pre.oscName);
  return {
    filename: names.requiredData,
    buffer: await toBuffer(wb),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    cuiWhenFilled: true,
    handling: EMASS_XLSX_BOX_NOTE,
  };
}

export async function fillAssessmentResultsXlsx(
  answers: FormAnswers,
  cwd?: string,
  templateBytes?: Uint8Array,
  options?: FillEmassXlsxOptions,
): Promise<FilledEmassXlsx> {
  const pre = buildEmassPrefill(answers);
  const allowStub = options?.allowAssessmentResultsStub === true;
  const { wb, source } = await loadAssessmentResultsTemplate(
    options?.assessmentResultsFromBytesOnly ? undefined : cwd,
    templateBytes,
    allowStub,
    options?.assessmentResultsFromBytesOnly === true,
  );
  const sheetsBefore = worksheetNames(wb);
  fillFromPrefill(wb, pre, "assessment-results");
  if (source !== "stub") {
    assertSheetsPreserved(sheetsBefore, wb);
    if (!allowStub && wb.getWorksheet("Cover")) {
      throw new AssessmentResultsTemplateMissingError(ASSESSMENT_RESULTS_STUB_REJECTED);
    }
  }
  const names = emassXlsxFilenames(pre.oscName);
  const buffer = await toBuffer(wb);
  if (source !== "stub") {
    assertSheetsPreservedInBytes(sheetsBefore, buffer);
  }
  if (!allowStub) {
    const accepted = acceptOfficialAssessmentResultsOutput(buffer);
    if (!accepted.bytes) {
      throw new AssessmentResultsTemplateMissingError(
        accepted.skipped || ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED,
      );
    }
  }
  return {
    filename: names.assessmentResults,
    buffer,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    cuiWhenFilled: true,
    handling: EMASS_XLSX_BOX_NOTE,
  };
}

function workbookConcurrency(raw: number | undefined): number {
  if (raw === 1 || raw === 2 || raw === 3) return raw;
  return 3;
}

/** Same mapper, all three workbooks. Worker uploads these filled files to the Track B drop. */
export async function fillEmassXlsxPack(
  answers: FormAnswers,
  cwd?: string,
  templates?: EmassTemplateBytes,
  options?: FillEmassXlsxOptions,
): Promise<EmassXlsxPack> {
  const allowStub = options?.allowAssessmentResultsStub === true;
  const bytesOnly = options?.assessmentResultsFromBytesOnly === true;
  const concurrency = workbookConcurrency(options?.concurrency);
  const fillResults = () =>
    fillAssessmentResultsXlsx(answers, cwd, templates?.assessmentResults, options).catch((err) => {
      // bytes-only (live / container): missing official bytes → skip, never stub.
      if (err instanceof AssessmentResultsTemplateMissingError && (!allowStub || bytesOnly)) return err;
      throw err;
    });

  let preAssessment: FilledEmassXlsx;
  let requiredData: FilledEmassXlsx;
  let assessmentResults: FilledEmassXlsx | AssessmentResultsTemplateMissingError;

  if (concurrency === 1) {
    preAssessment = await fillPreAssessmentXlsx(answers, cwd, templates?.preAssessment);
    requiredData = await fillRequiredDataXlsx(answers, cwd, templates?.requiredData);
    assessmentResults = await fillResults();
  } else if (concurrency === 2) {
    [preAssessment, requiredData] = await Promise.all([
      fillPreAssessmentXlsx(answers, cwd, templates?.preAssessment),
      fillRequiredDataXlsx(answers, cwd, templates?.requiredData),
    ]);
    assessmentResults = await fillResults();
  } else {
    [preAssessment, requiredData, assessmentResults] = await Promise.all([
      fillPreAssessmentXlsx(answers, cwd, templates?.preAssessment),
      fillRequiredDataXlsx(answers, cwd, templates?.requiredData),
      fillResults(),
    ]);
  }

  if (assessmentResults instanceof AssessmentResultsTemplateMissingError) {
    return {
      preAssessment,
      requiredData,
      assessmentResultsSkipped: assessmentResults.message,
    };
  }
  return { preAssessment, requiredData, assessmentResults };
}

export async function readFilledWorkbook(buffer: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(excelLoadBuffer(buffer));
  return wb;
}

export function worksheetCell(wb: ExcelJS.Workbook, sheet: string, cell: string): string {
  return cellText(wb.getWorksheet(sheet)?.getCell(cell).value);
}
