import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { answersIfDemoQuery, harborlineOscAnswers } from "./demo-fill.ts";
import { EMASS_CMMC_STATUS_FROM_FORM } from "./emass.ts";
import {
  ASSESSMENT_RESULTS_BOX_BLANK,
  ASSESSMENT_RESULTS_OFFICIAL,
  ASSESSMENT_RESULTS_OFFICIAL_SHEETS,
  ASSESSMENT_RESULTS_STUB_REJECTED,
  ASSESSMENT_RESULTS_TEMPLATE_MISSING,
  AssessmentResultsTemplateMissingError,
  CUI_WHEN_FILLED_BANNER,
  EMASS_XLSX_BOX_NOTE,
  fieldByOverlapLabel,
  fillAssessmentResultsXlsx,
  fillEmassXlsxPack,
  fillPreAssessmentXlsx,
  isAssessmentResultsBlankName,
  isAssessmentResultsStubWorkbook,
  isCmmcObjectiveOrControlId,
  isOfficialAssessmentResultsWorkbook,
  readFilledWorkbook,
  REQUIREMENT_OBJECTIVES_FINDINGS,
  REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS,
  worksheetCell,
} from "./emass-xlsx.ts";
import { emptyProvider } from "./types.ts";
import {
  ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED,
  acceptOfficialAssessmentResultsOutput,
  isAssessmentResultsCoverStubBytes,
  isOfficialAssessmentResultsBytes,
  xlsxWorksheetNames,
} from "./assessment-results-sheets.ts";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("eMASS Pre-Assessment xlsx fill from OSC answers", () => {
  it("Harborline ?demo=1 answers fill required Pre-Assessment OSC fields without throwing", async () => {
    const filled = answersIfDemoQuery("?demo=1");
    assert.ok(filled);
    const a = filled ?? harborlineOscAnswers();
    const out = await fillPreAssessmentXlsx(a, repo);
    assert.equal(out.cuiWhenFilled, true);
    assert.match(out.handling, /Never email/);
    assert.match(out.filename, /^CUI-Pre-Assessment-Harborline Precision\.xlsx$/);
    assert.ok(out.buffer.length > 1000);

    const wb = await readFilledWorkbook(out.buffer);
    assert.equal(worksheetCell(wb, "Pre-Assessment", "A1"), CUI_WHEN_FILLED_BANNER);
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D6"), "Harborline Precision LLC");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D7"), "HBR1LN0SC014");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D8"), "Harborline Precision");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D9"), "18 Thames St");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D10"), "Suite 12");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D11"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D12"), "Newport");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D13"), "RI");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D14"), "02840");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D15"), "United States");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D16"), "401-555-0188");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D17"), "https://harborline.example");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D18"), "Defense Industrial Base");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D19"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D20"), "22");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D21"), "8H2LP");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D22"), "8H2LP");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D23"), "Enclave");
    assert.match(worksheetCell(wb, "Pre-Assessment", "D24"), /GCC High/);
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D25"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D26"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D27"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D28"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D29"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D30"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D31"), "");
    assert.equal(worksheetCell(wb, "OSC Assessment Official", "A6"), "Chen");
    assert.equal(worksheetCell(wb, "OSC Assessment Official", "B6"), "Maya");
    assert.equal(worksheetCell(wb, "OSC Assessment Official", "C6"), "Contracts manager / Affirming Official");
    assert.equal(worksheetCell(wb, "OSC Assessment Official", "D6"), "maya.chen@harborline.example");
    assert.equal(worksheetCell(wb, "OSC Assessment Official", "E6"), "401-555-0188");
    assert.equal(worksheetCell(wb, "OSC Technical POC", "A6"), "Ortiz");
    assert.equal(worksheetCell(wb, "OSC Technical POC", "B6"), "Luis");
    assert.equal(worksheetCell(wb, "OSC Technical POC", "D6"), "luis.ortiz@harborline.example");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "A6"), "Microsoft");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "A7"), "Northwind SOC");
    assert.ok(wb.getWorksheet("C3PAO Lead Assessor"));
    assert.ok(wb.getWorksheet("Instructions"));
    assert.ok(wb.getWorksheet("Lookup Values"));
    assert.equal(worksheetCell(wb, "C3PAO Lead Assessor", "A6"), "");
  });

  it("fills from in-memory template bytes the same as from disk (Worker path)", async () => {
    const preBytes = readFileSync(join(repo, "docs/emass/CMMC-L2-Pre-Assessment-Form-v3.9.xlsx"));
    const reqBytes = readFileSync(join(repo, "docs/emass/Required-Data-OSC.xlsx"));
    const fromDisk = await fillEmassXlsxPack(harborlineOscAnswers(), repo, undefined, {
      allowAssessmentResultsStub: true,
    });
    const fromBuf = await fillEmassXlsxPack(harborlineOscAnswers(), undefined, {
      preAssessment: preBytes,
      requiredData: reqBytes,
    }, { allowAssessmentResultsStub: true });
    assert.equal(fromBuf.preAssessment.filename, fromDisk.preAssessment.filename);
    assert.equal(fromBuf.requiredData.filename, fromDisk.requiredData.filename);
    assert.equal(fromBuf.assessmentResults?.filename, fromDisk.assessmentResults?.filename);
    const wb = await readFilledWorkbook(fromBuf.preAssessment.buffer);
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D6"), "Harborline Precision LLC");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "A1"), CUI_WHEN_FILLED_BANNER);
  });

  it("Required-Data-OSC is the same OSC subset from one mapper", async () => {
    const pack = await fillEmassXlsxPack(harborlineOscAnswers(), repo, undefined, {
      allowAssessmentResultsStub: true,
    });
    const wb = await readFilledWorkbook(pack.requiredData.buffer);
    assert.equal(worksheetCell(wb, "OSC Information", "D2"), "Harborline Precision LLC");
    assert.equal(worksheetCell(wb, "OSC Information", "D7"), "");
    assert.equal(worksheetCell(wb, "OSC Information", "D11"), "United States");
    assert.equal(worksheetCell(wb, "OSC Information", "D14"), "Defense Industrial Base");
    assert.equal(worksheetCell(wb, "OSC Information", "D15"), "");
    assert.equal(worksheetCell(wb, "OSC Assessment Official", "A3"), "Chen");
    assert.equal(worksheetCell(wb, "OSC Technical Official", "B3"), "Luis");
    assert.equal(worksheetCell(wb, "OSC Service Provider Info", "A3"), "Microsoft");
    assert.equal(worksheetCell(wb, "OSC Service Provider Info", "A4"), "Northwind SOC");
  });

  it("defaults empty country and leaves Energy sector blank on the form", async () => {
    const a = harborlineOscAnswers();
    a.country = "";
    a.sector = "Energy";
    a.sectorother = "must-not-appear";
    const wb = await readFilledWorkbook((await fillPreAssessmentXlsx(a, repo)).buffer);
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D15"), "United States");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D18"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D19"), "");
    assert.equal(worksheetCell(wb, "Pre-Assessment", "D19").includes("must-not-appear"), false);
  });

  it("writes ESP rows only when providers is Yes, with translated CMMC status", async () => {
    const a = harborlineOscAnswers();
    a.has_sps = "Yes";
    a.sps = [
      {
        ...emptyProvider(),
        name: "Northwind MSP",
        email: "sam.patel@northwindmsp.example",
        poc_last: "Patel",
        poc_first: "Sam",
        poc_phone: "401-555-0100",
        service_desc: "SOC and patching",
        spcmmcstatus: "Seeking L2",
        spsector: "Financial Services",
      },
    ];
    const wb = await readFilledWorkbook((await fillPreAssessmentXlsx(a, repo)).buffer);
    assert.equal(worksheetCell(wb, "OSC ESP Info", "A6"), "Northwind MSP");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "B6"), "Patel");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "C6"), "Sam");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "D6"), "401-555-0100");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "E6"), "sam.patel@northwindmsp.example");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "F6"), "SOC and patching");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "G6"), "None");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "H6"), "");
    assert.equal(worksheetCell(wb, "OSC ESP Info", "I6"), "");
    assert.equal(EMASS_CMMC_STATUS_FROM_FORM["Seeking L2"], "None");
  });

  it("pack returns three CUI buffers; Assessment Results overlap is filled and scores stay blank", async () => {
    const pack = await fillEmassXlsxPack(harborlineOscAnswers(), repo, undefined, {
      allowAssessmentResultsStub: true,
    });
    assert.ok(pack.preAssessment.buffer.length > 1000);
    assert.ok(pack.requiredData.buffer.length > 1000);
    assert.ok(pack.assessmentResults);
    assert.ok(pack.assessmentResults.buffer.length > 1000);
    assert.match(pack.assessmentResults.filename, /^CUI-Assessment-Results-Harborline Precision\.xlsx$/);
    assert.equal(pack.assessmentResults.cuiWhenFilled, true);

    const wb = await readFilledWorkbook(pack.assessmentResults.buffer);
    assert.equal(worksheetCell(wb, "Cover", "A1"), CUI_WHEN_FILLED_BANNER);
    assert.equal(worksheetCell(wb, "Assessment Information", "D2"), "Harborline Precision LLC");
    assert.equal(worksheetCell(wb, "Assessment Information", "D3"), "HBR1LN0SC014");
    assert.equal(worksheetCell(wb, "Assessment Information", "D4"), "Harborline Precision");
    assert.equal(worksheetCell(wb, "Assessment Information", "D5"), "18 Thames St");
    assert.equal(worksheetCell(wb, "Assessment Information", "D11"), "United States");
    assert.equal(worksheetCell(wb, "Assessment Information", "D14"), "Defense Industrial Base");
    assert.equal(worksheetCell(wb, "Assessment Information", "D17"), "8H2LP");
    assert.equal(worksheetCell(wb, "Assessment Information", "D19"), "Enclave");
    assert.match(worksheetCell(wb, "Assessment Information", "D20"), /GCC High/);
    assert.equal(worksheetCell(wb, "OSC Assessment Official", "A3"), "Chen");
    assert.equal(worksheetCell(wb, "OSC Technical Official", "B3"), "Luis");
    assert.equal(worksheetCell(wb, "OSC Service Provider Info", "A3"), "Microsoft");
    assert.equal(worksheetCell(wb, "OSC Service Provider Info", "A4"), "Northwind SOC");
    assert.equal(worksheetCell(wb, "Assessment Information", "D22"), "");
    assert.equal(worksheetCell(wb, "Assessment Information", "D23"), "");
    assert.equal(worksheetCell(wb, "Assessment Information", "D24"), "");
    assert.equal(worksheetCell(wb, "Assessment Information", "D26"), "");
    assert.equal(worksheetCell(wb, "Score Grid", "B2"), "");
    assert.equal(worksheetCell(wb, "Score Grid", "C2"), "");
    assert.equal(worksheetCell(wb, "Score Grid", "D2"), "");
    assert.equal(worksheetCell(wb, "Score Grid", "E2"), "");
    assert.match(worksheetCell(wb, "Assessment Information", "D31"), /System Security Plan/);
    assert.equal(ASSESSMENT_RESULTS_BOX_BLANK, "CMMC_Level2_AssessmentResults_Template.xlsx");
  });

  it("official v3.9 fixture preserves every tab, fills Assessment Input, and never writes scores", async () => {
    const fixture = readFileSync(
      join(repo, "workers/prescope-submit/test/fixtures/assessment-results-official-v39.xlsx"),
    );
    const before = await readFilledWorkbook(fixture);
    const namesBefore = before.worksheets.map((s) => s.name);
    assert.deepEqual(namesBefore, [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
    assert.equal(isOfficialAssessmentResultsWorkbook(before), true);
    assert.equal(isAssessmentResultsStubWorkbook(before), false);
    assert.equal(ASSESSMENT_RESULTS_OFFICIAL["OSC Name"]?.sheet, "Assessment");
    assert.equal(ASSESSMENT_RESULTS_OFFICIAL["OSC SSP(s) name"]?.sheet, "OSC SSP(s)");

    const filled = await fillAssessmentResultsXlsx(harborlineOscAnswers(), undefined, fixture);
    const wb = await readFilledWorkbook(filled.buffer);
    assert.deepEqual(wb.worksheets.map((s) => s.name), namesBefore);
    assert.equal(wb.getWorksheet("Cover"), undefined);
    assert.equal(wb.getWorksheet("Assessment Information"), undefined);
    assert.equal(wb.getWorksheet("Objectives"), undefined);
    assert.equal(wb.getWorksheet("Record of Assessment"), undefined);
    assert.equal(wb.getWorksheet("Score Grid"), undefined);
    assert.equal(worksheetCell(wb, "Assessment", "D2"), "Harborline Precision LLC");
    assert.equal(worksheetCell(wb, "Assessment", "D3"), "HBR1LN0SC014");
    assert.equal(worksheetCell(wb, "Assessment", "D4"), "Harborline Precision");
    assert.equal(worksheetCell(wb, "Assessment", "D16"), "8H2LP");
    assert.equal(worksheetCell(wb, "Assessment", "D17"), "Enclave");
    assert.equal(worksheetCell(wb, "Assessment", "D19"), "Chen");
    assert.equal(worksheetCell(wb, "Assessment", "D29"), "");
    assert.equal(worksheetCell(wb, "Assessment", "D30"), "");
    assert.equal(worksheetCell(wb, "Requirements", "B2"), "");
    assert.equal(worksheetCell(wb, "Requirements", "C2"), "");
    assert.equal(worksheetCell(wb, "Requirement Objectives", "B2"), "");
    assert.equal(worksheetCell(wb, "Requirement Objectives", "C2"), "");
    assertRequirementObjectivesHpPrefill(wb);
    assert.match(worksheetCell(wb, "OSC SSP(s)", "D2"), /System Security Plan/);
  });

  it("maps official Assessment / SSP labels that the Cover-stub aliases missed", () => {
    assert.equal(fieldByOverlapLabel("OSC Name"), "OSC Name");
    assert.equal(fieldByOverlapLabel("Organization Name"), "OSC Name");
    assert.equal(fieldByOverlapLabel("CAGE Code(s)"), "CAGE code(s) in scope");
    assert.equal(fieldByOverlapLabel("Industry CAGE Codes"), "CAGE code(s) in scope");
    assert.equal(fieldByOverlapLabel("Highest Level Owner (HLO) CAGE Code"), "HLO CAGE");
    assert.equal(fieldByOverlapLabel("SSP Name"), "OSC SSP(s) name");
    assert.equal(fieldByOverlapLabel("OscName"), "OSC Name");
    assert.equal(fieldByOverlapLabel("CageCodes"), "CAGE code(s) in scope");
    assert.equal(fieldByOverlapLabel("System Security Plan Date"), "OSC SSP(s) date");
    assert.equal(fieldByOverlapLabel("C3PAO Unique Identifier"), undefined);
    assert.equal(fieldByOverlapLabel("C3PAO Organization Name"), undefined);
    assert.equal(fieldByOverlapLabel("Assessment Date"), undefined);
    assert.equal(fieldByOverlapLabel("CMMC UID"), undefined);
    assert.equal(fieldByOverlapLabel("Score"), undefined);
  });

  it("fills official header-row Assessment / OSC SSP(s) from intake and leaves C3PAO cells blank", async () => {
    const fixture = await officialHeaderRowResultsBytes();
    const filled = await fillAssessmentResultsXlsx(harborlineOscAnswers(), undefined, fixture);
    const wb = await readFilledWorkbook(filled.buffer);
    assert.deepEqual(wb.worksheets.map((s) => s.name), [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
    assert.equal(wb.getWorksheet("Cover"), undefined);
    assert.equal(worksheetCell(wb, "Assessment", "B1"), "OSC Name");
    assert.equal(worksheetCell(wb, "Assessment", "B2"), "Harborline Precision");
    assert.equal(worksheetCell(wb, "Assessment", "C2"), "8H2LP");
    assert.equal(worksheetCell(wb, "Assessment", "D2"), "8H2LP");
    assert.equal(worksheetCell(wb, "Assessment", "E2"), "Enclave");
    assert.match(worksheetCell(wb, "Assessment", "F2"), /GCC High/);
    assert.equal(worksheetCell(wb, "Assessment", "A2"), "");
    assert.equal(worksheetCell(wb, "Assessment", "G2"), "");
    assert.equal(worksheetCell(wb, "Assessment", "H2"), "");
    assert.match(worksheetCell(wb, "OSC SSP(s)", "A2"), /System Security Plan/);
    assert.equal(worksheetCell(wb, "OSC SSP(s)", "B2"), "2026-06-01");
    assert.equal(worksheetCell(wb, "Requirements", "B2"), "");
    assertRequirementObjectivesHpPrefill(wb);
  });

  it("fills vertical Assessment values beside labels when there is no Input header", async () => {
    const fixture = await officialVerticalNoInputResultsBytes();
    const filled = await fillAssessmentResultsXlsx(harborlineOscAnswers(), undefined, fixture);
    const wb = await readFilledWorkbook(filled.buffer);
    assert.equal(worksheetCell(wb, "Assessment", "B2"), "Harborline Precision");
    assert.equal(worksheetCell(wb, "Assessment", "B3"), "8H2LP");
    assert.equal(worksheetCell(wb, "Assessment", "B4"), "Enclave");
    assert.equal(worksheetCell(wb, "Assessment", "A2"), "Organization Name");
    assert.equal(wb.getWorksheet("Cover"), undefined);
  });

  it("official v3.9 Requirement Objectives is kept and every objective row gets exact H/P text", async () => {
    const fixture = readFileSync(
      join(repo, "workers/prescope-submit/test/fixtures/assessment-results-official-v39.xlsx"),
    );
    const before = await readFilledWorkbook(fixture);
    const obj = before.getWorksheet("Requirement Objectives");
    assert.ok(obj);
    assert.equal(worksheetCell(before, "Requirement Objectives", "H1"), "Overall Comments");
    assert.equal(worksheetCell(before, "Requirement Objectives", "P1"), "Findings");

    const filled = await fillAssessmentResultsXlsx(harborlineOscAnswers(), undefined, fixture);
    const wb = await readFilledWorkbook(filled.buffer);
    assert.ok(wb.getWorksheet("Requirement Objectives"));
    assert.deepEqual(wb.worksheets.map((s) => s.name), [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
    assertRequirementObjectivesHpPrefill(wb);
    // Score / MET stay blank — H/P text is not a MET/NOT MET score.
    assert.equal(worksheetCell(wb, "Requirement Objectives", "B2"), "");
    assert.equal(worksheetCell(wb, "Requirement Objectives", "C2"), "");
  });

  it("emitted Assessment Results bytes keep every official tab (zip-level, not the exceljs model)", async () => {
    const fixture = readFileSync(
      join(repo, "workers/prescope-submit/test/fixtures/assessment-results-official-v39.xlsx"),
    );
    const filled = await fillAssessmentResultsXlsx(harborlineOscAnswers(), undefined, fixture);
    // Read the zip the way Box and Excel do. readFilledWorkbook() round-trips
    // through exceljs, so it cannot catch a tab exceljs drops on write.
    assert.deepEqual(xlsxWorksheetNames(filled.buffer), [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
    assert.equal(acceptOfficialAssessmentResultsOutput(filled.buffer).bytes != null, true);
    assert.equal(xlsxWorksheetNames(filled.buffer).includes("Cover"), false);
  });

  it("zip sheet-name peek distinguishes official v3.9 from the Cover stub without exceljs", () => {
    const official = readFileSync(
      join(repo, "workers/prescope-submit/test/fixtures/assessment-results-official-v39.xlsx"),
    );
    const stub = readFileSync(
      join(repo, "workers/prescope-submit/test/fixtures/assessment-results-blank.xlsx"),
    );
    assert.deepEqual(xlsxWorksheetNames(official), [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
    assert.equal(xlsxWorksheetNames(stub).includes("Cover"), true);
    assert.equal(isOfficialAssessmentResultsBytes(official), true);
    assert.equal(isAssessmentResultsCoverStubBytes(stub), true);
    assert.equal(isOfficialAssessmentResultsBytes(stub), false);
    assert.equal(isAssessmentResultsCoverStubBytes(official), false);
  });

  it("Cover stub fixture is rejected on the live / official path", async () => {
    const fixture = readFileSync(
      join(repo, "workers/prescope-submit/test/fixtures/assessment-results-blank.xlsx"),
    );
    const stub = await readFilledWorkbook(fixture);
    assert.equal(isAssessmentResultsStubWorkbook(stub), true);
    assert.ok(stub.worksheets.some((s) => s.name === "Cover"));
    await assert.rejects(
      () => fillAssessmentResultsXlsx(harborlineOscAnswers(), undefined, fixture),
      (err: unknown) => {
        assert.ok(err instanceof AssessmentResultsTemplateMissingError);
        assert.match(err.message, /Cover|stub|official/i);
        assert.match(ASSESSMENT_RESULTS_STUB_REJECTED, /Cover/);
        return true;
      },
    );
    const pack = await fillEmassXlsxPack(harborlineOscAnswers(), repo, { assessmentResults: fixture });
    assert.equal(pack.assessmentResults, undefined);
    assert.match(pack.assessmentResultsSkipped ?? "", /Cover|stub|official|BOX_ASSESSMENT_RESULTS/i);
  });

  it("Cover cannot appear when official v3.9 bytes are provided", async () => {
    const fixture = readFileSync(
      join(repo, "workers/prescope-submit/test/fixtures/assessment-results-official-v39.xlsx"),
    );
    const pack = await fillEmassXlsxPack(harborlineOscAnswers(), repo, { assessmentResults: fixture });
    assert.ok(pack.assessmentResults);
    const wb = await readFilledWorkbook(pack.assessmentResults.buffer);
    assert.equal(wb.getWorksheet("Cover"), undefined);
    assert.deepEqual(wb.worksheets.map((s) => s.name), [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
    assert.equal(xlsxWorksheetNames(pack.assessmentResults.buffer).includes("Cover"), false);
    const src = readFileSync(join(repo, "src/lib/emass-xlsx.ts"), "utf8");
    assert.match(src, /createAssessmentResultsStubWorkbook/);
    assert.match(src, /Assessment Results fill must not add, delete, or rename sheets/);
  });

  it("bytes-only live path skips Assessment Results instead of reading a disk stub", async () => {
    const pack = await fillEmassXlsxPack(harborlineOscAnswers(), repo, undefined, {
      assessmentResultsFromBytesOnly: true,
    });
    assert.ok(pack.preAssessment.buffer.length > 1000);
    assert.equal(pack.assessmentResults, undefined);
    assert.match(pack.assessmentResultsSkipped ?? "", /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID|tabs/);
  });

  it("bytes-only never invents a Cover stub even when allowAssessmentResultsStub is true", async () => {
    const pack = await fillEmassXlsxPack(harborlineOscAnswers(), repo, undefined, {
      allowAssessmentResultsStub: true,
      assessmentResultsFromBytesOnly: true,
    });
    assert.equal(pack.assessmentResults, undefined);
    assert.match(pack.assessmentResultsSkipped ?? "", /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID|tabs|official/i);
    const src = readFileSync(join(repo, "src/lib/emass-xlsx.ts"), "utf8");
    assert.match(src, /allowStub && !bytesOnly/);
    assert.match(ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED, /Cover/);
  });

  it("live / no-stub path skips Assessment Results instead of shipping a stub", async () => {
    await assert.rejects(
      () => fillAssessmentResultsXlsx(harborlineOscAnswers(), repo),
      (err: unknown) => {
        assert.ok(err instanceof AssessmentResultsTemplateMissingError);
        assert.match(err.message, /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID/);
        return true;
      },
    );
    const pack = await fillEmassXlsxPack(harborlineOscAnswers(), repo);
    assert.ok(pack.preAssessment.buffer.length > 1000);
    assert.ok(pack.requiredData.buffer.length > 1000);
    assert.equal(pack.assessmentResults, undefined);
    assert.match(pack.assessmentResultsSkipped ?? "", /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID/);
    assert.match(ASSESSMENT_RESULTS_TEMPLATE_MISSING, /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID/);
    assert.equal(isAssessmentResultsBlankName("CMMC_Level2_AssessmentResults_Template.xlsx"), true);
    assert.equal(isAssessmentResultsBlankName("CMMC_Level2_AssessmentResults_Template"), true);
    assert.equal(isAssessmentResultsBlankName("CUI-Assessment-Results-Harborline Precision.xlsx"), false);
  });

  it("does not put a CUID on the form and documents no-email handling", () => {
    const src = readFileSync(join(repo, "src/lib/emass-xlsx.ts"), "utf8");
    assert.equal(src.includes("CUID"), false);
    assert.ok(src.includes(EMASS_XLSX_BOX_NOTE));
    assert.ok(src.includes("Never upload the blank template"));
    assert.ok(src.includes("allowAssessmentResultsStub"));
    assert.ok(src.includes("AssessmentResultsTemplateMissingError"));
    const dataverse = readFileSync(join(repo, "docs/maker/01-dataverse.md"), "utf8");
    assert.ok(dataverse.includes("Do **not** convert this Choice to Text"));
    assert.ok(dataverse.includes("eMASS None/Level 2/Level 3 mapping is export-time"));
  });
});

async function officialSheetPack(
  fillAssessment: (wb: ExcelJS.Workbook) => void,
  fillSsp?: (sheet: ExcelJS.Worksheet) => void,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  fillAssessment(wb);
  const req = wb.addWorksheet("Requirements");
  req.getCell("A1").value = "Practice ID";
  req.getCell("B1").value = "Score";
  req.getCell("C1").value = "MET / NOT MET";
  req.getCell("A2").value = "AC.L2-3.1.1";
  const obj = wb.addWorksheet("Requirement Objectives");
  obj.getCell("A1").value = "Objective ID";
  obj.getCell("B1").value = "Score";
  obj.getCell("C1").value = "MET / NOT MET";
  obj.getCell("H1").value = "Overall Comments";
  obj.getCell("P1").value = "Findings";
  obj.getCell("A2").value = "AC.L2-3.1.1[a]";
  obj.getCell("A3").value = "AC.L2-3.1.1[b]";
  obj.getCell("A5").value = "ACCESS CONTROL";
  wb.addWorksheet("Example").getCell("A1").value = "Example — do not delete";
  const ssp = wb.addWorksheet("OSC SSP(s)");
  if (fillSsp) fillSsp(ssp);
  else {
    ssp.getCell("A1").value = "Data Field";
    ssp.getCell("D1").value = "Input";
    ssp.getCell("A2").value = "OSC SSP(s) name";
    ssp.getCell("A3").value = "OSC SSP(s) date";
  }
  wb.addWorksheet("Instructions").getCell("A1").value = "Instructions — do not delete";
  wb.addWorksheet("Glossary").getCell("A1").value = "Glossary — do not delete";
  wb.addWorksheet("Version History").getCell("A1").value = "Version History — do not delete";
  wb.addWorksheet("Lookup Values").getCell("A1").value = "Lookup Values — do not delete";
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function officialHeaderRowResultsBytes(): Promise<Buffer> {
  return officialSheetPack(
    (wb) => {
      const assessment = wb.addWorksheet("Assessment");
      assessment.getCell("A1").value = "C3PAO Unique Identifier";
      assessment.getCell("B1").value = "OSC Name";
      assessment.getCell("C1").value = "CAGE Code(s)";
      assessment.getCell("D1").value = "Highest Level Owner (HLO) CAGE Code";
      assessment.getCell("E1").value = "Scope";
      assessment.getCell("F1").value = "Scope Description";
      assessment.getCell("G1").value = "Assessment Date";
      assessment.getCell("H1").value = "CMMC UID";
      assessment.getCell("B2").value = { formula: '""' };
    },
    (ssp) => {
      ssp.getCell("A1").value = "SSP Name";
      ssp.getCell("B1").value = "SSP Date";
      ssp.getCell("C1").value = "SSP Version";
    },
  );
}

async function officialVerticalNoInputResultsBytes(): Promise<Buffer> {
  return officialSheetPack((wb) => {
    const assessment = wb.addWorksheet("Assessment");
    assessment.getCell("A2").value = "Organization Name";
    assessment.getCell("A3").value = "Industry CAGE Codes";
    assessment.getCell("A4").value = "Scope";
  });
}

function assertRequirementObjectivesHpPrefill(wb: Awaited<ReturnType<typeof readFilledWorkbook>>) {
  const sheet = wb.getWorksheet("Requirement Objectives");
  assert.ok(sheet, "Requirement Objectives sheet must survive fill");
  assert.equal(worksheetCell(wb, "Requirement Objectives", "H1"), "Overall Comments");
  assert.equal(worksheetCell(wb, "Requirement Objectives", "P1"), "Findings");
  let dataRows = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const texts: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      texts.push(String(cell.value ?? ""));
    });
    const isData = texts.some((t) => isCmmcObjectiveOrControlId(t));
    if (!isData) {
      if (rowNumber === 1) return;
      assert.notEqual(worksheetCell(wb, "Requirement Objectives", `H${rowNumber}`), REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS);
      assert.notEqual(worksheetCell(wb, "Requirement Objectives", `P${rowNumber}`), REQUIREMENT_OBJECTIVES_FINDINGS);
      return;
    }
    dataRows += 1;
    assert.equal(row.getCell("H").value, REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS);
    assert.equal(row.getCell("P").value, REQUIREMENT_OBJECTIVES_FINDINGS);
  });
  assert.ok(dataRows >= 2, `expected multiple objective data rows, got ${dataRows}`);
}

after(() => {
  // no persistent CUI artifacts
});
