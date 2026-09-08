/**
 * Official CMMC L2 Assessment Results v3.9 sheet contract + Cover-stub
 * detection. No exceljs — safe on the Worker isolate (Box name-match).
 *
 * A file named CMMC_Level2_AssessmentResults_Template.xlsx has been the
 * Cover stub in-repo and in Box Templates. Name-match is not enough.
 */
import { inflateRawSync } from "node:zlib";

export const ASSESSMENT_RESULTS_OFFICIAL_SHEETS = [
  "Assessment",
  "Requirements",
  "Requirement Objectives",
  "Example",
  "OSC SSP(s)",
  "Instructions",
  "Glossary",
  "Version History",
  "Lookup Values",
] as const;

export const ASSESSMENT_RESULTS_OFFICIAL_REQUIRED_SHEETS = [
  "Assessment",
  "Requirements",
  "Requirement Objectives",
  "OSC SSP(s)",
] as const;

export const ASSESSMENT_RESULTS_STUB_REJECTED =
  "Assessment Results bytes look like the mapping stub (Cover / Assessment Information / Record of Assessment). Live Box must use the official CMMC L2 AR v3.9 blank (Assessment, Requirements, Requirement Objectives, OSC SSP(s), …). Set BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID. Refusing to upload a stub that drops official tabs.";

export const ASSESSMENT_RESULTS_NAME_MATCH_STUB =
  "Templates folder name-match found CMMC_Level2_AssessmentResults_Template but those bytes are the Cover stub, not official v3.9. Set BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID to the official blank in your Templates folder. Skipped upload.";

/** Filled output (sidecar or exceljs write) that is still a Cover / thin stub. */
export const ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED =
  "Filled Assessment Results contain Cover / stub sheets or are missing official assessor tabs (Assessment, Requirements, Requirement Objectives, OSC SSP(s)). Skipped upload — will not ship a stub.";

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function findEocd(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(bytes, i) === 0x06054b50) return i;
  }
  return -1;
}

/** Sheet names from xlsx workbook.xml. Empty if the bytes are not a readable workbook. */
export function xlsxWorksheetNames(bytes: Uint8Array): string[] {
  if (bytes.byteLength < 30 || u32(bytes, 0) !== 0x04034b50) return [];
  const eocd = findEocd(bytes);
  if (eocd < 0) return [];
  const cdSize = u32(bytes, eocd + 12);
  const cdOff = u32(bytes, eocd + 16);
  let p = cdOff;
  const cdEnd = cdOff + cdSize;
  let workbookXml: Uint8Array | undefined;
  while (p + 46 <= bytes.length && p < cdEnd && u32(bytes, p) === 0x02014b50) {
    const method = u16(bytes, p + 10);
    const compSize = u32(bytes, p + 20);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const localOff = u32(bytes, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === "xl/workbook.xml") {
      if (u32(bytes, localOff) !== 0x04034b50) break;
      const localNameLen = u16(bytes, localOff + 26);
      const localExtra = u16(bytes, localOff + 28);
      const dataStart = localOff + 30 + localNameLen + localExtra;
      const compressed = bytes.subarray(dataStart, dataStart + compSize);
      try {
        workbookXml = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : undefined;
      } catch {
        return [];
      }
      break;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (!workbookXml) return [];
  const xml = new TextDecoder("utf-8").decode(workbookXml);
  const names: string[] = [];
  const re = /<sheet\b[^>]*\bname=(?:"([^"]+)"|'([^']+)')/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const n = match[1] || match[2] || "";
    if (n) names.push(n);
  }
  return names;
}

/** Cover / thin stub — including the in-repo and Box name-match fake official file. */
export function isAssessmentResultsStubSheetSet(names: readonly string[]): boolean {
  const set = new Set(names);
  if (set.has("Cover") || set.has("Assessment Information") || set.has("Score Grid")) return true;
  if (set.has("Record of Assessment") && !set.has("Requirement Objectives")) return true;
  if (set.has("Objectives") && !set.has("Requirement Objectives")) return true;
  return false;
}

export function isOfficialAssessmentResultsSheetSet(names: readonly string[]): boolean {
  if (isAssessmentResultsStubSheetSet(names)) return false;
  const set = new Set(names);
  return ASSESSMENT_RESULTS_OFFICIAL_REQUIRED_SHEETS.every((name) => set.has(name));
}

export function isAssessmentResultsCoverStubBytes(bytes: Uint8Array): boolean {
  if (!bytes.byteLength) return false;
  const names = xlsxWorksheetNames(bytes);
  if (!names.length) return false;
  return isAssessmentResultsStubSheetSet(names);
}

export function isOfficialAssessmentResultsBytes(bytes: Uint8Array): boolean {
  return isOfficialAssessmentResultsSheetSet(xlsxWorksheetNames(bytes));
}

/**
 * Live Box: only return official v3.9 bytes. Cover stub / unreadable xlsx → omit.
 */
export function acceptOfficialAssessmentResultsBytes(
  bytes: Uint8Array | undefined,
): { bytes?: Uint8Array; skipped?: string } {
  if (!bytes?.byteLength) return { skipped: ASSESSMENT_RESULTS_STUB_REJECTED };
  if (isAssessmentResultsCoverStubBytes(bytes) || !isOfficialAssessmentResultsBytes(bytes)) {
    return { skipped: ASSESSMENT_RESULTS_STUB_REJECTED };
  }
  return { bytes };
}

/**
 * Same sheet contract as the blank, applied to *filled* bytes (sidecar JSON or
 * exceljs write). A stale fill image can still emit Cover + thin tabs after we
 * POSTed official Box bytes — refuse that output the same way.
 */
export function acceptOfficialAssessmentResultsOutput(
  bytes: Uint8Array | undefined,
): { bytes?: Uint8Array; skipped?: string } {
  if (!bytes?.byteLength) return { skipped: ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED };
  if (isAssessmentResultsCoverStubBytes(bytes) || !isOfficialAssessmentResultsBytes(bytes)) {
    return { skipped: ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED };
  }
  return { bytes };
}
