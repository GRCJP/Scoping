import assert from "node:assert/strict";
import { register } from "node:module";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

register(new URL("./exceljs-resolve.mjs", import.meta.url).href, import.meta.url);

import { harborlineOscAnswers } from "../../../src/lib/demo-fill.ts";
import type { BoxClient, BoxFile, BoxFolder } from "../src/box.ts";
import { fillConcurrency, type WorkerEnv } from "../src/env.ts";
import { fillEmassForSubmit } from "../src/fill.ts";
import worker from "../src/index.ts";
import { handleSubmit, resetSubmitIdempotencyForTests } from "../src/submit.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function env(over: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    PRESCOPE_SUBMIT_SECRET: "test-secret",
    BOX_MODE: "mock",
    FILL_MODE: "skip",
    BOX_AUTH_MODE: "ccg",
    BOX_SUBJECT_TYPE: "enterprise",
    BOX_DROPS_PARENT_ID: "parent-drops",
    BOX_TEMPLATE_FOLDER_ID: "",
    BOX_PREASSESSMENT_TEMPLATE_FILE_ID: "",
    BOX_REQUIRED_DATA_TEMPLATE_FILE_ID: "",
    BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "",
    MAIL_PROVIDER: "stub",
    EMASS_TEMPLATE_ROOT: "",
    FILL_CONTAINER_URL: "",
    ...over,
  };
}

function post(
  path: string,
  body: unknown,
  secret?: string | null,
  extraHeaders?: Record<string, string>,
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (secret !== null) headers.Authorization = `Bearer ${secret ?? "test-secret"}`;
  return new Request(`https://prescope.example${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function recordingSubmitBox(): {
  box: BoxClient;
  events: string[];
  created: BoxFolder[];
  deleted: string[];
  renamed: { id: string; name: string }[];
} {
  const events: string[] = [];
  const created: BoxFolder[] = [];
  const deleted: string[] = [];
  const renamed: { id: string; name: string }[] = [];
  const folders = new Map<string, BoxFolder>();
  const files = new Map<string, BoxFile[]>();
  let n = 0;
  const box: BoxClient = {
    mode: "mock",
    async createFolder(_parentId, name) {
      events.push("create");
      const folder = { id: `fld_${++n}`, name, url: `https://app.box.com/folder/${n}` };
      created.push(folder);
      folders.set(folder.id, folder);
      files.set(folder.id, []);
      return folder;
    },
    async getFolder(folderId) {
      events.push("get");
      const folder = folders.get(folderId);
      if (!folder) throw new Error("folder not found");
      return folder;
    },
    async deleteFolder(folderId) {
      events.push("delete");
      deleted.push(folderId);
      folders.delete(folderId);
    },
    async renameFolder(folderId, name) {
      events.push("rename");
      renamed.push({ id: folderId, name });
      const folder = folders.get(folderId);
      if (folder) folder.name = name;
      return { id: folderId, name, url: `https://app.box.com/folder/${folderId}` };
    },
    async uploadFile(folderId, name) {
      events.push("upload");
      const file = { id: `fil_${++n}`, name };
      const list = files.get(folderId) ?? [];
      list.push(file);
      files.set(folderId, list);
      return file;
    },
    async downloadFile() {
      return new Uint8Array();
    },
    async findChildFile(folderId, name) {
      return (files.get(folderId) ?? []).find((f) => f.name === name) ?? null;
    },
    async findChildFolder() {
      return null;
    },
    async listChildFiles(folderId) {
      return [...(files.get(folderId) ?? [])];
    },
  };
  return { box, events, created, deleted, renamed };
}

describe("POST /submit (mock Box, skip fill)", () => {
  it("returns 401 without a secret", async () => {
    const res = await worker.fetch(post("/submit", { answers: harborlineOscAnswers() }, null), env());
    assert.equal(res.status, 401);
  });

  it("returns 401 with a wrong secret", async () => {
    const res = await worker.fetch(post("/submit", { answers: harborlineOscAnswers() }, "nope"), env());
    assert.equal(res.status, 401);
  });

  it("rejects a bad JSON body after auth", async () => {
    const res = await worker.fetch(post("/api/submit", { nope: true }), env());
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /Unexpected field|Invalid/);
  });

  it("creates a flat mock drop, uploads answers markdown, stubs mail, never returns xlsx bytes", async () => {
    const res = await worker.fetch(post("/submit", { answers: harborlineOscAnswers() }), env());
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      id: string;
      orchstatus: string;
      drop: {
        folderId: string;
        folderName: string;
        children?: Record<string, string>;
        answersFileId: string;
        answersFileName: string;
        files?: string[];
        xlsx: { skipped?: boolean };
        boxMode: string;
      };
      mail: { kind: string; body: string; note: string; status: string; provider: string }[];
      handling: { filledXlsx: string };
    };
    assert.match(body.id, /^[0-9a-f-]{36}$/i);
    assert.equal(body.orchstatus, "AssessorsEmailed");
    assert.equal(body.drop.boxMode, "mock");
    assert.match(body.drop.folderName, /Harborline Precision - OSC Discovery -/);
    assert.equal(body.drop.children, undefined);
    assert.equal(JSON.stringify(body.drop).includes("00 Internal"), false);
    assert.equal(JSON.stringify(body.drop).includes("01 Answers"), false);
    assert.ok(body.drop.answersFileId);
    assert.match(body.drop.answersFileName, /Harborline Precision - OSC Discovery Answers - .+\.md$/);
    assert.deepEqual(body.drop.files, [body.drop.answersFileName]);
    assert.equal(body.drop.xlsx.skipped, true);
    assert.equal(body.mail.length, 2);
    assert.equal(body.mail[0]?.kind, "customer_confirmation");
    assert.equal(body.mail[0]?.status, "stubbed");
    assert.equal(body.mail[0]?.provider, "stub");
    assert.equal(body.mail[0]?.body.includes("box.com"), false);
    assert.equal(body.mail[1]?.kind, "internal_box_link");
    assert.equal(body.mail[1]?.status, "stubbed");
    assert.equal(body.mail[1]?.provider, "stub");
    assert.match(body.mail[1]?.body ?? "", /app\.box\.com\/folder/);
    assert.equal(body.mail[1]?.body.includes("00 Internal"), false);
    assert.match(JSON.stringify(body), /Never emailed/);
    assert.equal(JSON.stringify(body).includes("UEsDB"), false);
  });

  it("FILL_MODE=node fills CUI xlsx names without returning workbook bytes", async () => {
    const res = await worker.fetch(
      post("/submit", { answers: harborlineOscAnswers() }),
      env({ FILL_MODE: "node", EMASS_TEMPLATE_ROOT: repoRoot }),
    );
    assert.equal(res.status, 200, await res.clone().text());
    const body = (await res.json()) as {
      drop: {
        children?: Record<string, string>;
        answersFileName: string;
        files?: string[];
        xlsx: {
          preAssessment?: { name: string };
          requiredData?: { name: string };
          assessmentResults?: { name: string };
          skipped?: boolean;
        };
        fillSource: string;
      };
    };
    assert.equal(body.drop.fillSource, "node");
    assert.equal(body.drop.children, undefined);
    assert.match(body.drop.answersFileName, /\.md$/);
    assert.equal(body.drop.xlsx.skipped, undefined);
    assert.match(body.drop.xlsx.preAssessment?.name ?? "", /^CUI-Pre-Assessment-/);
    assert.match(body.drop.xlsx.requiredData?.name ?? "", /^CUI-Required-Data-OSC-/);
    assert.match(body.drop.xlsx.assessmentResults?.name ?? "", /^CUI-Assessment-Results-/);
    const files = body.drop.files ?? [];
    assert.equal(files.filter((n) => n.endsWith(".xlsx")).length, 3);
    assert.equal(files.some((n) => n.endsWith(".md")), true);
    assert.equal(JSON.stringify(body).includes("UEsDB"), false);
  });

  it("GET /health does not require a secret", async () => {
    const res = await worker.fetch(new Request("https://prescope.example/health"), env());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; service: string };
    assert.equal(body.ok, true);
    assert.equal(body.service, "prescope-submit");
    assert.match(res.headers.get("Strict-Transport-Security") ?? "", /max-age=31536000/);
    assert.match(res.headers.get("Cache-Control") ?? "", /no-store/);
  });

  it("unauthorized POST /submit still sends no-store and HSTS", async () => {
    const res = await worker.fetch(post("/submit", { answers: harborlineOscAnswers() }, null), env());
    assert.equal(res.status, 401);
    assert.match(res.headers.get("Cache-Control") ?? "", /no-store/);
    assert.match(res.headers.get("Strict-Transport-Security") ?? "", /max-age=31536000/);
  });
});

describe("Track B fill-then-create and idempotent retry", () => {
  it("rejects an invalid Idempotency-Key and still rejects unexpected fields", async () => {
    resetSubmitIdempotencyForTests();
    const badKey = await worker.fetch(
      post("/submit", { answers: harborlineOscAnswers() }, "test-secret", { "Idempotency-Key": "has space" }),
      env(),
    );
    assert.equal(badKey.status, 400);
    const sneak = await worker.fetch(post("/submit", { answers: harborlineOscAnswers(), sneak: true }), env());
    assert.equal(sneak.status, 400);
  });

  it("defaults FILL_CONCURRENCY to 1 (serial workbooks)", () => {
    assert.equal(fillConcurrency(env()), 1);
    assert.equal(fillConcurrency(env({ FILL_CONCURRENCY: "3" })), 3);
    assert.equal(fillConcurrency(env({ FILL_CONCURRENCY: "nope" })), 1);
  });

  it("fills before creating the Box drop", async () => {
    resetSubmitIdempotencyForTests();
    const { box, events } = recordingSubmitBox();
    const res = await handleSubmit(post("/submit", { answers: harborlineOscAnswers() }), env(), {
      box,
      fill: async () => {
        events.push("fill");
        return { ok: true, pack: null, source: "skip" };
      },
    });
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(events[0], "fill");
    assert.equal(events[1], "create");
    assert.ok(events.includes("upload"));
  });

  it("container fill success stamps fillSource and still creates Box after fill", async () => {
    resetSubmitIdempotencyForTests();
    const { box, events } = recordingSubmitBox();
    const b64 = Buffer.from("xlsx").toString("base64");
    const res = await handleSubmit(post("/submit", { answers: harborlineOscAnswers() }), env({
      FILL_MODE: "container",
      FILL_CONTAINER_URL: "https://fill.example",
    }), {
      box,
      fill: (answers, workerEnv, fillBox) =>
        fillEmassForSubmit(answers, workerEnv, fillBox, {
          fetchImpl: async () =>
            new Response(
              JSON.stringify({
                preAssessment: { filename: "CUI-Pre-Assessment-H.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: b64 },
                requiredData: { filename: "CUI-Required-Data-OSC-H.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: b64 },
                assessmentResults: { filename: "CUI-Assessment-Results-H.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: b64 },
              }),
            ),
        }),
    });
    assert.equal(res.status, 200, await res.clone().text());
    const body = (await res.json()) as { drop: { fillSource?: string; xlsx?: { preAssessment?: { name: string } } } };
    assert.equal(body.drop.fillSource, "container");
    assert.match(body.drop.xlsx?.preAssessment?.name ?? "", /^CUI-Pre-Assessment-/);
    assert.equal(events[0], "create");
    assert.equal(JSON.stringify(body).includes("UEsDB"), false);
    assert.equal(JSON.stringify(body).includes(b64), false);
  });

  it("container fill failure is FailedFill before any Box folder", async () => {
    resetSubmitIdempotencyForTests();
    const { box, created, events } = recordingSubmitBox();
    const res = await handleSubmit(post("/submit", { answers: harborlineOscAnswers() }), env({
      FILL_MODE: "container",
      FILL_CONTAINER_URL: "https://fill.example",
    }), {
      box,
      fill: (answers, workerEnv, fillBox) =>
        fillEmassForSubmit(answers, workerEnv, fillBox, {
          fetchImpl: async () => new Response("nope", { status: 503 }),
        }),
    });
    assert.equal(res.status, 502);
    const body = (await res.json()) as { error?: string; detail?: string; drop?: unknown };
    assert.equal(body.error, "FailedFill");
    assert.match(body.detail ?? "", /Fill container 503/);
    assert.equal(body.drop, undefined);
    assert.equal(created.length, 0);
    assert.equal(events.includes("create"), false);
  });

  it("does not create a drop when fill fails", async () => {
    resetSubmitIdempotencyForTests();
    const { box, created, events } = recordingSubmitBox();
    const res = await handleSubmit(post("/submit", { answers: harborlineOscAnswers() }), env(), {
      box,
      fill: async () => ({ ok: false, error: "exceljs exploded" }),
    });
    assert.equal(res.status, 502);
    const body = (await res.json()) as { error?: string; drop?: unknown };
    assert.equal(body.error, "FailedFill");
    assert.equal(body.drop, undefined);
    assert.equal(created.length, 0);
    assert.equal(events.includes("create"), false);
  });

  it("reuses the same folder when Idempotency-Key is repeated", async () => {
    resetSubmitIdempotencyForTests();
    const { box, created } = recordingSubmitBox();
    const req = () =>
      post("/submit", { answers: harborlineOscAnswers() }, "test-secret", { "Idempotency-Key": "admin-smoke-1" });
    const first = await handleSubmit(req(), env(), {
      box,
      fill: async () => ({ ok: true, pack: null, source: "skip" }),
    });
    assert.equal(first.status, 200, await first.clone().text());
    const firstBody = (await first.json()) as { id: string; drop: { folderId: string } };
    const second = await handleSubmit(req(), env(), {
      box,
      fill: async () => ({ ok: true, pack: null, source: "skip" }),
    });
    assert.equal(second.status, 200, await second.clone().text());
    const secondBody = (await second.json()) as { id: string; drop: { folderId: string } };
    assert.equal(created.length, 1);
    assert.equal(secondBody.drop.folderId, firstBody.drop.folderId);
    assert.equal(secondBody.id, firstBody.id);
  });

  it("resumes into drop.folderId instead of minting another folder", async () => {
    resetSubmitIdempotencyForTests();
    const { box, created } = recordingSubmitBox();
    const existing = await box.createFolder("parent-drops", "Harborline Precision - OSC Discovery - resume");
    const res = await handleSubmit(
      post("/submit", { answers: harborlineOscAnswers(), drop: { folderId: existing.id } }),
      env(),
      {
        box,
        fill: async () => ({ ok: true, pack: null, source: "skip" }),
      },
    );
    assert.equal(res.status, 200, await res.clone().text());
    const body = (await res.json()) as { drop: { folderId: string; resumed?: boolean } };
    assert.equal(body.drop.folderId, existing.id);
    assert.equal(body.drop.resumed, true);
    assert.equal(created.length, 1);
  });

  it("deletes a minted drop when upload fails after create", async () => {
    resetSubmitIdempotencyForTests();
    const { box, created, deleted } = recordingSubmitBox();
    const failing: BoxClient = {
      ...box,
      async uploadFile() {
        throw new Error("upload exploded");
      },
    };
    const res = await handleSubmit(post("/submit", { answers: harborlineOscAnswers() }), env(), {
      box: failing,
      fill: async () => ({ ok: true, pack: null, source: "skip" }),
    });
    assert.equal(res.status, 502);
    const body = (await res.json()) as { error?: string; abandoned?: string; drop?: unknown };
    assert.equal(body.error, "FailedBox");
    assert.equal(body.abandoned, "deleted");
    assert.equal(body.drop, undefined);
    assert.equal(created.length, 1);
    assert.deepEqual(deleted, [created[0]?.id]);
  });
});
