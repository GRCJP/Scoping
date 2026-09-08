/**
 * POST /submit orchestration (Track B / Cloudflare).
 * Fill eMASS first (CPU-heavy, no Box folder). Then create one drop under
 * BOX_DROPS_PARENT_ID and upload answers markdown + filled xlsx in one phase.
 * Mail hooks (stub or Resend). No 00–03 children (Track A / Automate).
 * Trusted caller only. Response may include Box ids. Never filled xlsx bytes.
 *
 * Admin: serial submits only. Optional Idempotency-Key / drop.folderId reuse
 * the same folder on retry. Do not fire parallel smokes (Worker 503).
 */
import { parseSubmitBody } from "../../../src/lib/submit-body.ts";
import { answersMarkdown, dropFolderName, sanitizeCustomer } from "../../../src/lib/docs.ts";
import { easternDate } from "../../../src/lib/scoring.ts";
import { orgName } from "../../../src/lib/types.ts";
import { boxMode, trim, type WorkerEnv } from "./env.ts";
import {
  abandonDropFolder,
  createBoxClient,
  createDropFolder,
  type BoxClient,
  type BoxFile,
  type BoxFolder,
} from "./box.ts";
import { fillEmassForSubmit, type FillResult } from "./fill.ts";
import { customerConfirmationEmail, dispatchMail, internalBoxLinkEmail } from "./mail.ts";
import { bad, json } from "./http.ts";

const MAX_BODY_BYTES = 64 * 1024;
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_IDEMPOTENCY = 64;
const FOLDER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const IDEMPOTENCY_KEY_RE = /^[\x21-\x7E]{1,128}$/;

export type SubmitDeps = {
  box?: BoxClient;
  fill?: (answers: Parameters<typeof fillEmassForSubmit>[0], env: WorkerEnv, box: BoxClient) => Promise<FillResult>;
};

type IdemRecord =
  | { state: "ok"; body: unknown }
  | { state: "folder"; folder: BoxFolder };

const idempotencyStore = new Map<string, IdemRecord>();

export function resetSubmitIdempotencyForTests(): void {
  idempotencyStore.clear();
}

export function parseIdempotencyKey(raw: string | null): { ok: true; key?: string } | { ok: false; error: string } {
  if (raw == null) return { ok: true };
  const key = raw.trim();
  if (!key) return { ok: true };
  if (!IDEMPOTENCY_KEY_RE.test(key)) return { ok: false, error: "Invalid Idempotency-Key." };
  return { ok: true, key };
}

export function parseResumeFolderId(raw: unknown): { ok: true; folderId?: string } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true };
  if (typeof raw !== "string") return { ok: false, error: "Invalid drop.folderId." };
  const folderId = raw.trim();
  if (!folderId) return { ok: true };
  if (!FOLDER_ID_RE.test(folderId)) return { ok: false, error: "Invalid drop.folderId." };
  return { ok: true, folderId };
}

function rememberIdempotency(key: string | undefined, rec: IdemRecord): void {
  if (!key) return;
  if (!idempotencyStore.has(key) && idempotencyStore.size >= MAX_IDEMPOTENCY) {
    const first = idempotencyStore.keys().next().value;
    if (first) idempotencyStore.delete(first);
  }
  idempotencyStore.set(key, rec);
}

function forgetIdempotency(key: string | undefined): void {
  if (key) idempotencyStore.delete(key);
}

function splitWorkerBody(text: string): { answersJson: string; resumeRaw: unknown } {
  try {
    const body = JSON.parse(text) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { answersJson: text, resumeRaw: undefined };
    }
    const rec = body as Record<string, unknown>;
    const drop = rec.drop;
    const resumeRaw =
      drop && typeof drop === "object" && !Array.isArray(drop)
        ? (drop as { folderId?: unknown }).folderId
        : undefined;
    const rest = { ...rec };
    delete rest.drop;
    return { answersJson: JSON.stringify(rest), resumeRaw };
  } catch {
    return { answersJson: text, resumeRaw: undefined };
  }
}

async function uploadUnlessPresent(
  box: BoxClient,
  folderId: string,
  name: string,
  body: Uint8Array,
  contentType: string,
): Promise<{ file: BoxFile; reused: boolean }> {
  const existing = await box.findChildFile(folderId, name);
  if (existing) return { file: existing, reused: true };
  return { file: await box.uploadFile(folderId, name, body, contentType), reused: false };
}

export async function handleSubmit(request: Request, env: WorkerEnv, deps: SubmitDeps = {}): Promise<Response> {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return bad("Payload too large.", 413);
  }

  let text: string;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) return bad("Payload too large.", 413);
    text = new TextDecoder().decode(buf);
  } catch {
    return bad("Invalid body.");
  }

  const idem = parseIdempotencyKey(request.headers.get("Idempotency-Key"));
  if (!idem.ok) return bad(idem.error, 400);
  const idempotencyKey = idem.key;

  const cached = idempotencyKey ? idempotencyStore.get(idempotencyKey) : undefined;
  if (cached?.state === "ok") return json(cached.body);

  const split = splitWorkerBody(text);
  const resume = parseResumeFolderId(split.resumeRaw);
  if (!resume.ok) return bad(resume.error, 400);

  const parsed = parseSubmitBody(split.answersJson, request.headers.get("content-length"));
  if (!parsed.ok) return bad(parsed.error, parsed.status, parsed.field);

  const answers = parsed.answers;
  const id = crypto.randomUUID();
  const submittedon = new Date().toISOString();
  const org = orgName(answers);
  const dropName = dropFolderName(org, submittedon);

  const parentId = trim(env.BOX_DROPS_PARENT_ID);
  if (boxMode(env) === "live" && !parentId) {
    return bad("BOX_DROPS_PARENT_ID is not set.", 503);
  }

  const box = deps.box ?? createBoxClient(env);
  const fill = deps.fill ?? fillEmassForSubmit;
  let orchstatus = "Submitted";

  const filled = await fill(answers, env, box);
  if (!filled.ok) {
    return json({ error: "FailedFill", detail: filled.error, orchstatus: "FailedFill", id }, 502);
  }

  const resumeId = resume.folderId || (cached?.state === "folder" ? cached.folder.id : undefined);
  let drop: BoxFolder;
  let minted = false;

  if (resumeId) {
    try {
      drop = await box.getFolder(resumeId);
      if (idempotencyKey) rememberIdempotency(idempotencyKey, { state: "folder", folder: drop });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Resume folder not found.";
      return json({ error: "FailedBox", detail, orchstatus: "FailedBox", id }, 502);
    }
  } else {
    try {
      drop = await createDropFolder(box, parentId || "0", dropName, {
        reuseIfExists: Boolean(idempotencyKey),
      });
      minted = true;
      orchstatus = "DropCreated";
      if (idempotencyKey) rememberIdempotency(idempotencyKey, { state: "folder", folder: drop });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Box create failed.";
      return json({ error: "FailedBox", detail, orchstatus: "FailedBox", id }, 502);
    }
  }

  const answersFileName = `${sanitizeCustomer(org)} - OSC Discovery Answers - ${easternDate(new Date(submittedon))}.md`;

  const failAfterDrop = async (detail: string): Promise<Response> => {
    if (minted) {
      const abandoned = await abandonDropFolder(box, drop);
      if (abandoned === "deleted" || abandoned === "renamed") {
        forgetIdempotency(idempotencyKey);
        return json({ error: "FailedBox", detail, orchstatus: "FailedBox", id, abandoned }, 502);
      }
    }
    return json(
      {
        error: "FailedBox",
        detail,
        orchstatus: "FailedBox",
        id,
        drop: { folderId: drop.id, folderName: drop.name, folderUrl: drop.url },
      },
      502,
    );
  };

  let answersFileId: string | undefined;
  let uploadedNew = false;
  try {
    const uploaded = await uploadUnlessPresent(
      box,
      drop.id,
      answersFileName,
      new TextEncoder().encode(answersMarkdown(answers, submittedon, "standard")),
      "text/markdown; charset=utf-8",
    );
    answersFileId = uploaded.file.id;
    uploadedNew ||= !uploaded.reused;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Box upload failed.";
    return failAfterDrop(detail);
  }

  let xlsx:
    | {
        preAssessment: { fileId: string; name: string };
        requiredData: { fileId: string; name: string };
        assessmentResults?: { fileId: string; name: string };
        assessmentResultsSkipped?: string;
      }
    | { skipped: true; reason: string }
    | undefined;

  const uploadedNames = [answersFileName];

  if (filled.pack) {
    try {
      const pre = await uploadUnlessPresent(
        box,
        drop.id,
        filled.pack.preAssessment.filename,
        new Uint8Array(filled.pack.preAssessment.buffer),
        filled.pack.preAssessment.contentType || XLSX_TYPE,
      );
      const req = await uploadUnlessPresent(
        box,
        drop.id,
        filled.pack.requiredData.filename,
        new Uint8Array(filled.pack.requiredData.buffer),
        filled.pack.requiredData.contentType || XLSX_TYPE,
      );
      uploadedNew ||= !pre.reused || !req.reused;
      uploadedNames.push(pre.file.name, req.file.name);
      xlsx = {
        preAssessment: { fileId: pre.file.id, name: pre.file.name },
        requiredData: { fileId: req.file.id, name: req.file.name },
      };
      if (filled.pack.assessmentResults) {
        const results = await uploadUnlessPresent(
          box,
          drop.id,
          filled.pack.assessmentResults.filename,
          new Uint8Array(filled.pack.assessmentResults.buffer),
          filled.pack.assessmentResults.contentType || XLSX_TYPE,
        );
        uploadedNew ||= !results.reused;
        uploadedNames.push(results.file.name);
        xlsx.assessmentResults = { fileId: results.file.id, name: results.file.name };
      } else if (filled.pack.assessmentResultsSkipped) {
        xlsx.assessmentResultsSkipped = filled.pack.assessmentResultsSkipped;
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Box upload failed.";
      return failAfterDrop(detail);
    }
  } else {
    xlsx = { skipped: true, reason: "FILL_MODE=skip" };
  }

  const mail = uploadedNew
    ? await dispatchMail([customerConfirmationEmail(answers), internalBoxLinkEmail(answers, drop.url, env)], env)
    : [];
  orchstatus = "AssessorsEmailed";

  const body = {
    id,
    submittedon,
    orchstatus,
    path: "standard",
    drop: {
      folderId: drop.id,
      folderName: drop.name,
      folderUrl: drop.url,
      parentId: parentId || null,
      answersFileId,
      answersFileName,
      files: uploadedNames,
      xlsx,
      boxMode: box.mode,
      fillSource: filled.source,
      resumed: Boolean(resumeId) && !minted,
    },
    mail,
    handling: {
      filledXlsx: "CUI (When Filled In). Box drop only. Never emailed.",
      customerEmail: "Confirmation only. No Box link.",
      internalEmail: "Box folder link only. No xlsx.",
    },
  };

  if (idempotencyKey) rememberIdempotency(idempotencyKey, { state: "ok", body });
  return json(body);
}
