import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  abandonDropFolder,
  createBoxClient,
  createDropFolder,
  failedDropName,
  isAssessmentResultsBlankName,
  loadBlankTemplates,
  type BoxClient,
} from "../src/box.ts";
import type { WorkerEnv } from "../src/env.ts";
import { ASSESSMENT_RESULTS_NAME_MATCH_STUB } from "../../../src/lib/assessment-results-sheets.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const officialAr = () =>
  new Uint8Array(readFileSync(join(repoRoot, "workers/prescope-submit/test/fixtures/assessment-results-official-v39.xlsx")));
const coverStubAr = () =>
  new Uint8Array(readFileSync(join(repoRoot, "workers/prescope-submit/test/fixtures/assessment-results-blank.xlsx")));

function recordingBox(): { box: BoxClient; created: { parentId: string; name: string }[] } {
  const created: { parentId: string; name: string }[] = [];
  const folders = new Map<string, { id: string; name: string; url: string }>();
  const box: BoxClient = {
    mode: "mock",
    async createFolder(parentId, name) {
      created.push({ parentId, name });
      const folder = { id: `fld_${created.length}`, name, url: `https://app.box.com/folder/${created.length}` };
      folders.set(folder.id, folder);
      return folder;
    },
    async getFolder(folderId) {
      const folder = folders.get(folderId);
      if (!folder) throw new Error("folder not found");
      return folder;
    },
    async deleteFolder(folderId) {
      folders.delete(folderId);
    },
    async renameFolder(folderId, name) {
      const folder = folders.get(folderId);
      if (!folder) throw new Error("folder not found");
      folder.name = name;
      return folder;
    },
    async uploadFile(_folderId, name) {
      return { id: "fil_1", name };
    },
    async downloadFile() {
      return new Uint8Array();
    },
    async findChildFile() {
      return null;
    },
    async findChildFolder() {
      return null;
    },
    async listChildFiles() {
      return [];
    },
  };
  return { box, created };
}

describe("createDropFolder (Track B flat drop)", () => {
  it("creates only the drop folder — no 00–03 children", async () => {
    const { box, created } = recordingBox();
    const drop = await createDropFolder(box, "parent-drops", "Harborline Precision - OSC Discovery - 2026-09-04");
    assert.equal(created.length, 1);
    assert.equal(created[0]?.parentId, "parent-drops");
    assert.equal(drop.name, "Harborline Precision - OSC Discovery - 2026-09-04");
    assert.equal(
      created.some((c) => /^(00 Internal|01 Answers|02 Uploads|03 Scoping call)$/.test(c.name)),
      false,
    );
  });

  it("BOX_MODE=mock uploads files onto the drop itself", async () => {
    const box = createBoxClient({ BOX_MODE: "mock" } as WorkerEnv);
    const drop = await createDropFolder(box, "parent-drops", "Acme - OSC Discovery - 2026-09-04");
    await box.uploadFile(drop.id, "Acme - OSC Discovery Answers - 2026-09-04.md", new Uint8Array([1]), "text/markdown");
    await box.uploadFile(drop.id, "CUI-Pre-Assessment-Acme.xlsx", new Uint8Array([2]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await box.uploadFile(drop.id, "CUI-Required-Data-OSC-Acme.xlsx", new Uint8Array([3]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await box.uploadFile(drop.id, "CUI-Assessment-Results-Acme.xlsx", new Uint8Array([4]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const hit = await box.findChildFile(drop.id, "Acme - OSC Discovery Answers - 2026-09-04.md");
    assert.ok(hit);
    assert.equal(hit?.name.endsWith(".md"), true);
    assert.ok(await box.findChildFile(drop.id, "CUI-Pre-Assessment-Acme.xlsx"));
    assert.ok(await box.findChildFile(drop.id, "CUI-Required-Data-OSC-Acme.xlsx"));
    assert.ok(await box.findChildFile(drop.id, "CUI-Assessment-Results-Acme.xlsx"));
    assert.equal(await box.findChildFile(drop.id, "00 Internal"), null);
  });
});

describe("loadBlankTemplates Assessment Results aliases", () => {
  it("downloads official v3.9 bytes by alias from the Templates folder", async () => {
    const bytes = officialAr();
    const box = createBoxClient({ BOX_MODE: "mock" } as WorkerEnv);
    await box.uploadFile(
      "000000000000",
      "CMMC_Level2_AssessmentResults_Template",
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const got = await loadBlankTemplates(box, {
      BOX_TEMPLATE_FOLDER_ID: "000000000000",
      BOX_PREASSESSMENT_TEMPLATE_FILE_ID: "",
      BOX_REQUIRED_DATA_TEMPLATE_FILE_ID: "",
      BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "",
    } as WorkerEnv);
    assert.deepEqual(got.assessmentResults, bytes);
    assert.equal(got.assessmentResultsSkipped, undefined);
    assert.equal(isAssessmentResultsBlankName("CMMC_Level2_AssessmentResults_Template.xlsx"), true);
    assert.equal(isAssessmentResultsBlankName("cmmc_level2_assessmentresults_template.xlsx"), true);
  });

  it("rejects name-match Cover stub when file id is empty (live Ops path)", async () => {
    const box = createBoxClient({ BOX_MODE: "mock" } as WorkerEnv);
    await box.uploadFile(
      "000000000000",
      "CMMC_Level2_AssessmentResults_Template.xlsx",
      coverStubAr(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const got = await loadBlankTemplates(box, {
      BOX_TEMPLATE_FOLDER_ID: "000000000000",
      BOX_PREASSESSMENT_TEMPLATE_FILE_ID: "",
      BOX_REQUIRED_DATA_TEMPLATE_FILE_ID: "",
      BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "",
    } as WorkerEnv);
    assert.equal(got.assessmentResults, undefined);
    assert.match(got.assessmentResultsSkipped ?? "", /Cover stub|name-match/i);
    assert.match(ASSESSMENT_RESULTS_NAME_MATCH_STUB, /BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID/);
  });

  it("prefers BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID official bytes over a folder Cover stub", async () => {
    const box = createBoxClient({ BOX_MODE: "mock" } as WorkerEnv);
    const official = officialAr();
    await box.uploadFile(
      "templates",
      "CMMC_Level2_AssessmentResults_Template.xlsx",
      coverStubAr(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const uploaded = await box.uploadFile(
      "other",
      "official-ar.xlsx",
      official,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const got = await loadBlankTemplates(box, {
      BOX_TEMPLATE_FOLDER_ID: "templates",
      BOX_PREASSESSMENT_TEMPLATE_FILE_ID: "",
      BOX_REQUIRED_DATA_TEMPLATE_FILE_ID: "",
      BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: uploaded.id,
    } as WorkerEnv);
    assert.deepEqual(got.assessmentResults, official);
    assert.equal(got.assessmentResultsSkipped, undefined);
  });

  it("rejects a Cover stub even when BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID points at it", async () => {
    const box = createBoxClient({ BOX_MODE: "mock" } as WorkerEnv);
    const uploaded = await box.uploadFile(
      "templates",
      "CMMC_Level2_AssessmentResults_Template.xlsx",
      coverStubAr(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const got = await loadBlankTemplates(box, {
      BOX_TEMPLATE_FOLDER_ID: "templates",
      BOX_PREASSESSMENT_TEMPLATE_FILE_ID: "",
      BOX_REQUIRED_DATA_TEMPLATE_FILE_ID: "",
      BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: uploaded.id,
    } as WorkerEnv);
    assert.equal(got.assessmentResults, undefined);
    assert.match(got.assessmentResultsSkipped ?? "", /Cover|stub|official/i);
  });
});

describe("abandon incomplete drop", () => {
  it("deletes when deleteFolder works", async () => {
    const { box } = recordingBox();
    const drop = await createDropFolder(box, "parent-drops", "Harborline Precision - OSC Discovery - 2026-09-05");
    const result = await abandonDropFolder(box, drop);
    assert.equal(result, "deleted");
    await assert.rejects(() => box.getFolder(drop.id));
  });

  it("renames to Failed- when delete fails", async () => {
    const box: BoxClient = {
      mode: "mock",
      async createFolder(_parentId, name) {
        return { id: "fld_1", name, url: "https://app.box.com/folder/1" };
      },
      async getFolder() {
        return { id: "fld_1", name: "Failed- leftover", url: "https://app.box.com/folder/1" };
      },
      async deleteFolder() {
        throw new Error("no delete");
      },
      async renameFolder(_id, name) {
        return { id: "fld_1", name, url: "https://app.box.com/folder/1" };
      },
      async uploadFile(_folderId, name) {
        return { id: "fil_1", name };
      },
      async downloadFile() {
        return new Uint8Array();
      },
      async findChildFile() {
        return null;
      },
      async findChildFolder() {
        return null;
      },
      async listChildFiles() {
        return [];
      },
    };
    const result = await abandonDropFolder(box, {
      id: "fld_1",
      name: "Harborline Precision - OSC Discovery - 2026-09-05",
      url: "https://app.box.com/folder/1",
    });
    assert.equal(result, "renamed");
    assert.equal(
      failedDropName("Harborline Precision - OSC Discovery - 2026-09-05"),
      "Failed- Harborline Precision - OSC Discovery - 2026-09-05",
    );
  });
});
