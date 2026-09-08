import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

register(new URL("./exceljs-resolve.mjs", import.meta.url).href, import.meta.url);

import { harborlineOscAnswers } from "../../../src/lib/demo-fill.ts";
import {
  ASSESSMENT_RESULTS_OFFICIAL_REQUIRED_SHEETS,
  ASSESSMENT_RESULTS_OFFICIAL_SHEETS,
  fillEmassXlsxPack,
  isCmmcObjectiveOrControlId,
  readFilledWorkbook,
  REQUIREMENT_OBJECTIVES_FINDINGS,
  REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS,
  worksheetCell,
} from "../../../src/lib/emass-xlsx.ts";
import {
  ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED,
  xlsxWorksheetNames,
} from "../../../src/lib/assessment-results-sheets.ts";
import { handleFillHttp } from "../container/handler.ts";
import type { BoxClient } from "../src/box.ts";
import { asFillFetch, fillEmassForSubmit } from "../src/fill.ts";
import type { WorkerEnv } from "../src/env.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function env(over: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    PRESCOPE_SUBMIT_SECRET: "test-secret",
    BOX_MODE: "live",
    FILL_MODE: "node",
    BOX_AUTH_MODE: "ccg",
    BOX_SUBJECT_TYPE: "enterprise",
    BOX_DROPS_PARENT_ID: "parent-drops",
    BOX_TEMPLATE_FOLDER_ID: "000000000000",
    BOX_PREASSESSMENT_TEMPLATE_FILE_ID: "",
    BOX_REQUIRED_DATA_TEMPLATE_FILE_ID: "",
    BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "",
    MAIL_PROVIDER: "stub",
    EMASS_TEMPLATE_ROOT: repoRoot,
    FILL_CONTAINER_URL: "",
    ...over,
  };
}

function liveBox(files: Map<string, { name: string; body: Uint8Array }>): BoxClient {
  return {
    mode: "live",
    async createFolder(_parentId, name) {
      return { id: "fld_drop", name, url: "https://app.box.com/folder/fld_drop" };
    },
    async getFolder(folderId) {
      return { id: folderId, name: "drop", url: `https://app.box.com/folder/${folderId}` };
    },
    async deleteFolder() {},
    async renameFolder(folderId, name) {
      return { id: folderId, name, url: `https://app.box.com/folder/${folderId}` };
    },
    async uploadFile(_folderId, name) {
      return { id: `fil_${name}`, name };
    },
    async downloadFile(fileId) {
      const hit = files.get(fileId);
      if (!hit) throw new Error("Box live test: file not found");
      return hit.body;
    },
    async findChildFile(folderId, name) {
      return (await this.listChildFiles(folderId)).find((f) => f.name.toLowerCase() === name.toLowerCase()) ?? null;
    },
    async findChildFolder() {
      return null;
    },
    async listChildFiles(_folderId) {
      return [...files.entries()].map(([id, f]) => ({ id, name: f.name }));
    },
  };
}

async function officialResultsFixture(): Promise<Uint8Array> {
  const { readFile } = await import("node:fs/promises");
  return new Uint8Array(
    await readFile(join(repoRoot, "workers/prescope-submit/test/fixtures/assessment-results-official-v39.xlsx")),
  );
}

async function coverStubFixture(): Promise<Uint8Array> {
  const { readFile } = await import("node:fs/promises");
  return new Uint8Array(
    await readFile(join(repoRoot, "workers/prescope-submit/test/fixtures/assessment-results-blank.xlsx")),
  );
}

describe("live Assessment Results fill", () => {
  it("skips Assessment Results upload when the official Box blank is missing", async () => {
    const filled = await fillEmassForSubmit(harborlineOscAnswers(), env(), liveBox(new Map()));
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack) throw new Error("expected pack");
    assert.ok(filled.pack.preAssessment.buffer.length > 1000);
    assert.ok(filled.pack.requiredData.buffer.length > 1000);
    assert.equal(filled.pack.assessmentResults, undefined);
    assert.match(filled.pack.assessmentResultsSkipped ?? "", /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID|tabs/);
  });

  it("fills official Box bytes in place and keeps every tab", async () => {
    const fixture = await officialResultsFixture();
    const files = new Map<string, { name: string; body: Uint8Array }>([
      ["fil_results", { name: "CMMC_Level2_AssessmentResults_Template.xlsx", body: fixture }],
    ]);
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({ BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "fil_results" }),
      liveBox(files),
    );
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack?.assessmentResults) throw new Error("expected Assessment Results");
    const wb = await readFilledWorkbook(filled.pack.assessmentResults.buffer);
    assert.deepEqual(wb.worksheets.map((s) => s.name), [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
    assert.equal(wb.getWorksheet("Cover"), undefined);
    assert.equal(wb.getWorksheet("Score Grid"), undefined);
    assert.equal(wb.getWorksheet("Assessment Information"), undefined);
    const zipNames = xlsxWorksheetNames(filled.pack.assessmentResults.buffer);
    assert.equal(zipNames.includes("Cover"), false);
    assert.deepEqual(
      ASSESSMENT_RESULTS_OFFICIAL_REQUIRED_SHEETS.filter((name) => !zipNames.includes(name)),
      [],
    );
    assert.ok(wb.getWorksheet("Requirement Objectives"));
    assert.equal(worksheetCell(wb, "Assessment", "D2"), "Harborline Precision LLC");
    assert.equal(worksheetCell(wb, "Assessment", "D4"), "Harborline Precision");
    assert.equal(worksheetCell(wb, "Requirement Objectives", "H2"), REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS);
    assert.equal(worksheetCell(wb, "Requirement Objectives", "P2"), REQUIREMENT_OBJECTIVES_FINDINGS);
  });

  it("name-match Cover stub with empty file id is skipped (live Ops path)", async () => {
    const fixture = await coverStubFixture();
    const files = new Map<string, { name: string; body: Uint8Array }>([
      ["fil_stub", { name: "CMMC_Level2_AssessmentResults_Template.xlsx", body: fixture }],
    ]);
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({ BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "", BOX_TEMPLATE_FOLDER_ID: "000000000000" }),
      liveBox(files),
    );
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack) throw new Error("expected pack");
    assert.equal(filled.pack.assessmentResults, undefined);
    assert.match(filled.pack.assessmentResultsSkipped ?? "", /Cover stub|name-match/i);
  });

  it("empty file id name-match fills official v3.9 bytes and does not add Cover", async () => {
    const fixture = await officialResultsFixture();
    const files = new Map<string, { name: string; body: Uint8Array }>([
      ["fil_results", { name: "CMMC_Level2_AssessmentResults_Template.xlsx", body: fixture }],
    ]);
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({ BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "", BOX_TEMPLATE_FOLDER_ID: "000000000000" }),
      liveBox(files),
    );
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack?.assessmentResults) throw new Error("expected Assessment Results");
    const wb = await readFilledWorkbook(filled.pack.assessmentResults.buffer);
    assert.deepEqual(wb.worksheets.map((s) => s.name), [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
    assert.equal(wb.getWorksheet("Cover"), undefined);
  });

  it("skips Assessment Results when Box supplies the Cover stub", async () => {
    const fixture = await coverStubFixture();
    const files = new Map<string, { name: string; body: Uint8Array }>([
      ["fil_stub", { name: "CMMC_Level2_AssessmentResults_Template.xlsx", body: fixture }],
    ]);
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({ BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "fil_stub" }),
      liveBox(files),
    );
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack) throw new Error("expected pack");
    assert.equal(filled.pack.assessmentResults, undefined);
    assert.match(filled.pack.assessmentResultsSkipped ?? "", /Cover|stub|official|tabs/i);
  });

  it("pack with official bytes does not fall back to the stub", async () => {
    const fixture = await officialResultsFixture();
    const pack = await fillEmassXlsxPack(harborlineOscAnswers(), repoRoot, {
      assessmentResults: fixture,
    });
    assert.ok(pack.assessmentResults);
    const wb = await readFilledWorkbook(pack.assessmentResults.buffer);
    assert.ok(wb.getWorksheet("Assessment"));
    assert.ok(wb.getWorksheet("Requirement Objectives"));
    assert.ok(wb.getWorksheet("OSC SSP(s)"));
    assert.equal(worksheetCell(wb, "Assessment", "D2"), "Harborline Precision LLC");
    assert.equal(worksheetCell(wb, "Assessment", "D4"), "Harborline Precision");
    assert.equal(wb.getWorksheet("Cover"), undefined);
    assert.equal(wb.getWorksheet("Score Grid"), undefined);
    assert.equal(worksheetCell(wb, "Requirement Objectives", "H1"), "Overall Comments");
    assert.equal(worksheetCell(wb, "Requirement Objectives", "P1"), "Findings");
    let dataRows = 0;
    wb.getWorksheet("Requirement Objectives")?.eachRow({ includeEmpty: false }, (row) => {
      const texts: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => texts.push(String(cell.value ?? "")));
      if (!texts.some((t) => isCmmcObjectiveOrControlId(t))) return;
      dataRows += 1;
      assert.equal(row.getCell("H").value, REQUIREMENT_OBJECTIVES_OVERALL_COMMENTS);
      assert.equal(row.getCell("P").value, REQUIREMENT_OBJECTIVES_FINDINGS);
    });
    assert.ok(dataRows >= 2);
  });
});

function recordingFetch(
  handler: (req: Request) => Response | Promise<Response>,
): {
  fetchImpl: typeof fetch;
  calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[];
} {
  const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const text = await req.clone().text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({ url: req.url, method: req.method, headers, body });
    return handler(req);
  };
  return { fetchImpl, calls };
}

const MOCK_XLSX_B64 = Buffer.from("fake-xlsx-bytes").toString("base64");
const OFFICIAL_AR_B64 = readFileSync(
  join(repoRoot, "workers/prescope-submit/test/fixtures/assessment-results-official-v39.xlsx"),
).toString("base64");
const COVER_STUB_AR_B64 = readFileSync(
  join(repoRoot, "workers/prescope-submit/test/fixtures/assessment-results-blank.xlsx"),
).toString("base64");

function mockPackResponse(over: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      preAssessment: { filename: "CUI-Pre-Assessment-Harborline.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: MOCK_XLSX_B64 },
      requiredData: { filename: "CUI-Required-Data-OSC-Harborline.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: MOCK_XLSX_B64 },
      assessmentResults: { filename: "CUI-Assessment-Results-Harborline.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: OFFICIAL_AR_B64 },
      ...over,
    }),
    { status: 200 },
  );
}

describe("FILL_MODE=container client (mock fetch)", () => {
  const mockBox: BoxClient = liveBox(new Map());
  mockBox.mode = "mock";

  it("POSTs answers with Bearer secret and never returns workbook bytes on the result object fields used by HTTP", async () => {
    const { fetchImpl, calls } = recordingFetch(() => mockPackResponse());
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({
        BOX_MODE: "mock",
        FILL_MODE: "container",
        FILL_CONTAINER_URL: "https://fill.example:8788/",
      }),
      mockBox,
      { fetchImpl },
    );
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack) throw new Error("expected pack");
    assert.equal(filled.source, "container");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://fill.example:8788/fill");
    assert.equal(calls[0]?.method, "POST");
    assert.equal(calls[0]?.headers.authorization, "Bearer test-secret");
    assert.equal(calls[0]?.headers["content-type"], "application/json");
    const posted = calls[0]?.body as {
      answers?: { hqname?: string };
      templates?: unknown;
      allowAssessmentResultsStub?: boolean;
      assessmentResultsFromBytesOnly?: boolean;
    };
    assert.equal(posted.answers?.hqname, "Harborline Precision LLC");
    assert.equal(posted.templates, undefined);
    assert.equal(posted.allowAssessmentResultsStub, false);
    assert.equal(posted.assessmentResultsFromBytesOnly, true);
    assert.match(filled.pack.preAssessment.filename, /^CUI-Pre-Assessment-/);
    assert.match(filled.pack.requiredData.filename, /^CUI-Required-Data-OSC-/);
    assert.match(filled.pack.assessmentResults?.filename ?? "", /^CUI-Assessment-Results-/);
    assert.equal(filled.pack.preAssessment.buffer.toString("utf8"), "fake-xlsx-bytes");
    assert.equal(JSON.stringify(filled.pack.preAssessment).includes("fake-xlsx-bytes"), false);
    const arNames = xlsxWorksheetNames(filled.pack.assessmentResults!.buffer);
    assert.equal(arNames.includes("Cover"), false);
    for (const name of ASSESSMENT_RESULTS_OFFICIAL_REQUIRED_SHEETS) {
      assert.equal(arNames.includes(name), true, `missing ${name}`);
    }
  });

  it("refuses Cover-stub sidecar output instead of uploading it", async () => {
    const { fetchImpl } = recordingFetch(() =>
      mockPackResponse({
        assessmentResults: {
          filename: "CUI-Assessment-Results-Harborline.xlsx",
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64: COVER_STUB_AR_B64,
        },
      }),
    );
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({
        BOX_MODE: "mock",
        FILL_MODE: "container",
        FILL_CONTAINER_URL: "https://fill.example",
      }),
      mockBox,
      { fetchImpl },
    );
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack) throw new Error("expected pack");
    assert.equal(filled.pack.assessmentResults, undefined);
    assert.match(filled.pack.assessmentResultsSkipped ?? "", /Cover|stub|official assessor tabs/i);
    assert.match(ASSESSMENT_RESULTS_OUTPUT_STUB_REJECTED, /Cover/);
  });

  it("accepts official-shaped sidecar output and keeps required assessor tabs", async () => {
    const { fetchImpl } = recordingFetch(() => mockPackResponse());
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({
        BOX_MODE: "mock",
        FILL_MODE: "container",
        FILL_CONTAINER_URL: "https://fill.example",
      }),
      mockBox,
      { fetchImpl },
    );
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack?.assessmentResults) throw new Error("expected Assessment Results");
    const names = xlsxWorksheetNames(filled.pack.assessmentResults.buffer);
    assert.equal(names.includes("Cover"), false);
    assert.equal(names.includes("Assessment Information"), false);
    assert.equal(names.includes("Record of Assessment"), false);
    assert.deepEqual(
      ASSESSMENT_RESULTS_OFFICIAL_REQUIRED_SHEETS.filter((name) => !names.includes(name)),
      [],
    );
  });

  it("fails closed when FILL_CONTAINER_URL and PRESCOPE_FILL are both missing", async () => {
    const { fetchImpl, calls } = recordingFetch(() => {
      throw new Error("must not fetch");
    });
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({ BOX_MODE: "mock", FILL_MODE: "container", FILL_CONTAINER_URL: "" }),
      mockBox,
      { fetchImpl },
    );
    assert.equal(filled.ok, false);
    if (filled.ok) throw new Error("expected failure");
    assert.match(filled.error, /FILL_CONTAINER_URL|PRESCOPE_FILL/);
    assert.equal(calls.length, 0);
  });

  it("maps a container 503 to FailedFill without treating it as success", async () => {
    const { fetchImpl } = recordingFetch(() => new Response("overloaded", { status: 503 }));
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({ BOX_MODE: "mock", FILL_MODE: "container", FILL_CONTAINER_URL: "https://fill.example" }),
      mockBox,
      { fetchImpl },
    );
    assert.equal(filled.ok, false);
    if (filled.ok) throw new Error("expected failure");
    assert.equal(filled.error, "Fill container 503");
  });

  it("rejects a 200 that omits workbook base64", async () => {
    const { fetchImpl } = recordingFetch(
      () => new Response(JSON.stringify({ preAssessment: { filename: "x.xlsx" } }), { status: 200 }),
    );
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({ BOX_MODE: "mock", FILL_MODE: "container", FILL_CONTAINER_URL: "https://fill.example" }),
      mockBox,
      { fetchImpl },
    );
    assert.equal(filled.ok, false);
    if (filled.ok) throw new Error("expected failure");
    assert.match(filled.error, /no workbooks/);
  });

  it("allows Assessment Results skip when the sidecar omits that workbook", async () => {
    const { fetchImpl } = recordingFetch(() =>
      mockPackResponse({
        assessmentResults: undefined,
        assessmentResultsSkipped: "official blank missing",
      }),
    );
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({ BOX_MODE: "mock", FILL_MODE: "container", FILL_CONTAINER_URL: "https://fill.example" }),
      mockBox,
      { fetchImpl },
    );
    assert.equal(filled.ok, true);
    if (!filled.ok || !filled.pack) throw new Error("expected pack");
    assert.equal(filled.pack.assessmentResults, undefined);
    assert.match(filled.pack.assessmentResultsSkipped ?? "", /official blank missing/);
  });

  it("does not extract global fetch (workerd Illegal invocation on HTTP sidecar)", async () => {
    const original = globalThis.fetch;
    const branded = function brandedFetch(this: unknown, _input: RequestInfo | URL, _init?: RequestInit) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation: function called with incorrect `this` reference.");
      }
      return mockPackResponse();
    } as typeof fetch;
    globalThis.fetch = branded;
    try {
      const unbound = globalThis.fetch;
      assert.throws(
        () => {
          void unbound("https://fill.example/fill", { method: "POST" });
        },
        /Illegal invocation/,
      );
      const filled = await fillEmassForSubmit(
        harborlineOscAnswers(),
        env({ BOX_MODE: "mock", FILL_MODE: "container", FILL_CONTAINER_URL: "https://fill.example" }),
        mockBox,
      );
      assert.equal(filled.ok, true);
      if (!filled.ok) throw new Error("expected pack");
      assert.equal(filled.source, "container");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("PRESCOPE_FILL stub.fetch keeps this (workerd Illegal invocation)", async () => {
    const stub = {
      fetch(this: unknown, _input: RequestInfo | URL, _init?: RequestInit) {
        if (this !== stub) {
          throw new TypeError("Illegal invocation: function called with incorrect `this` reference.");
        }
        return Promise.resolve(mockPackResponse());
      },
    };
    const unbound = stub.fetch;
    assert.throws(() => {
      void unbound("https://prescope-fill.internal/fill");
    }, /Illegal invocation/);
    const ns = {
      idFromName: () => "prescope-fill",
      get: () => stub,
    };
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({
        BOX_MODE: "mock",
        FILL_MODE: "container",
        FILL_CONTAINER_URL: "",
        PRESCOPE_FILL: ns as unknown as WorkerEnv["PRESCOPE_FILL"],
      }),
      mockBox,
    );
    assert.equal(filled.ok, true);
    if (!filled.ok) throw new Error("expected pack");
    assert.equal(filled.source, "container");
  });

  it("asFillFetch default is not the unbound global fetch", () => {
    assert.notStrictEqual(asFillFetch(), fetch);
  });

  it("forwards live Box template bytes so the sidecar still calls fillEmassXlsxPack", async () => {
    const fixture = await officialResultsFixture();
    const files = new Map<string, { name: string; body: Uint8Array }>([
      ["fil_results", { name: "CMMC_Level2_AssessmentResults_Template.xlsx", body: fixture }],
    ]);
    const { fetchImpl, calls } = recordingFetch(() => mockPackResponse());
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({
        FILL_MODE: "container",
        FILL_CONTAINER_URL: "https://fill.example",
        BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "fil_results",
      }),
      liveBox(files),
      { fetchImpl },
    );
    assert.equal(filled.ok, true);
    const posted = calls[0]?.body as {
      templates?: { assessmentResults?: { base64?: string } };
      allowAssessmentResultsStub?: boolean;
      assessmentResultsFromBytesOnly?: boolean;
    };
    assert.ok(posted.templates?.assessmentResults?.base64);
    assert.equal(posted.templates?.assessmentResults?.base64, Buffer.from(fixture).toString("base64"));
    assert.equal(posted.allowAssessmentResultsStub, false);
    assert.equal(posted.assessmentResultsFromBytesOnly, true);
  });

  it("does not POST Cover-stub name-match bytes to the sidecar", async () => {
    const fixture = await coverStubFixture();
    const files = new Map<string, { name: string; body: Uint8Array }>([
      ["fil_stub", { name: "CMMC_Level2_AssessmentResults_Template.xlsx", body: fixture }],
    ]);
    const { fetchImpl, calls } = recordingFetch(() =>
      mockPackResponse({
        assessmentResults: undefined,
        assessmentResultsSkipped: "official blank missing",
      }),
    );
    const filled = await fillEmassForSubmit(
      harborlineOscAnswers(),
      env({
        FILL_MODE: "container",
        FILL_CONTAINER_URL: "https://fill.example",
        BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "",
        BOX_TEMPLATE_FOLDER_ID: "000000000000",
      }),
      liveBox(files),
      { fetchImpl },
    );
    assert.equal(filled.ok, true);
    const posted = calls[0]?.body as { templates?: { assessmentResults?: { base64?: string } } };
    assert.equal(posted.templates?.assessmentResults, undefined);
  });
});

describe("container /fill Assessment Results (exceljs)", () => {
  const prevRoot = process.env.EMASS_TEMPLATE_ROOT;
  const prevStub = process.env.EMASS_ALLOW_ASSESSMENT_RESULTS_STUB;

  async function withTemplateRoot<T>(fn: () => Promise<T>): Promise<T> {
    process.env.EMASS_TEMPLATE_ROOT = repoRoot;
    process.env.EMASS_ALLOW_ASSESSMENT_RESULTS_STUB = "";
    try {
      return await fn();
    } finally {
      process.env.EMASS_TEMPLATE_ROOT = prevRoot;
      process.env.EMASS_ALLOW_ASSESSMENT_RESULTS_STUB = prevStub;
    }
  }

  it("skips Assessment Results when official bytes are omitted (never stubs)", async () => {
    await withTemplateRoot(async () => {
      const out = await handleFillHttp(
        "POST",
        "/fill",
        new Headers({ Authorization: "Bearer test-secret" }),
        JSON.stringify({ answers: harborlineOscAnswers() }),
        "test-secret",
      );
      assert.equal(out.status, 200);
      const data = out.data as { assessmentResults?: { base64?: string }; assessmentResultsSkipped?: string };
      assert.equal(data.assessmentResults, undefined);
      assert.match(data.assessmentResultsSkipped ?? "", /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID|tabs|official/i);
    });
  });

  it("fills official v3.9 bytes in place and does not add Cover", async () => {
    await withTemplateRoot(async () => {
      const fixture = await officialResultsFixture();
      const out = await handleFillHttp(
        "POST",
        "/fill",
        new Headers({ Authorization: "Bearer test-secret" }),
        JSON.stringify({
          answers: harborlineOscAnswers(),
          templates: { assessmentResults: { base64: Buffer.from(fixture).toString("base64") } },
        }),
        "test-secret",
      );
      assert.equal(out.status, 200, JSON.stringify(out.data));
      const data = out.data as { assessmentResults?: { base64?: string } };
      assert.ok(data.assessmentResults?.base64);
      const raw = Buffer.from(data.assessmentResults.base64, "base64");
      const wb = await readFilledWorkbook(raw);
      assert.deepEqual(wb.worksheets.map((s) => s.name), [...ASSESSMENT_RESULTS_OFFICIAL_SHEETS]);
      assert.equal(wb.getWorksheet("Cover"), undefined);
      assert.equal(worksheetCell(wb, "Assessment", "D2"), "Harborline Precision LLC");
      assert.equal(worksheetCell(wb, "Assessment", "D4"), "Harborline Precision");
      const zipNames = xlsxWorksheetNames(raw);
      assert.equal(zipNames.includes("Cover"), false);
      assert.deepEqual(
        ASSESSMENT_RESULTS_OFFICIAL_REQUIRED_SHEETS.filter((name) => !zipNames.includes(name)),
        [],
      );
    });
  });

  it("does not emit a Cover stub when env+POST opt into allowStub without official bytes", async () => {
    await withTemplateRoot(async () => {
      process.env.EMASS_ALLOW_ASSESSMENT_RESULTS_STUB = "1";
      const out = await handleFillHttp(
        "POST",
        "/fill",
        new Headers({ Authorization: "Bearer test-secret" }),
        JSON.stringify({ answers: harborlineOscAnswers(), allowAssessmentResultsStub: true }),
        "test-secret",
      );
      assert.equal(out.status, 200, JSON.stringify(out.data));
      const data = out.data as { assessmentResults?: { base64?: string }; assessmentResultsSkipped?: string };
      assert.equal(data.assessmentResults, undefined);
      assert.match(data.assessmentResultsSkipped ?? "", /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID|tabs|official/i);
    });
  });

  it("rejects Cover stub bytes even if EMASS_ALLOW_ASSESSMENT_RESULTS_STUB is unset", async () => {
    await withTemplateRoot(async () => {
      const fixture = await coverStubFixture();
      const out = await handleFillHttp(
        "POST",
        "/fill",
        new Headers({ Authorization: "Bearer test-secret" }),
        JSON.stringify({
          answers: harborlineOscAnswers(),
          templates: { assessmentResults: { base64: Buffer.from(fixture).toString("base64") } },
        }),
        "test-secret",
      );
      assert.equal(out.status, 200, JSON.stringify(out.data));
      const data = out.data as { assessmentResults?: { base64?: string }; assessmentResultsSkipped?: string };
      assert.equal(data.assessmentResults, undefined);
      assert.match(data.assessmentResultsSkipped ?? "", /Cover|stub|official/i);
    });
  });
});
