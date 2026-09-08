/**
 * Box REST client (CCG + folder create + upload/download).
 * No Box secrets leave this module. CI must use BOX_MODE=mock.
 */
import { boxAuthMode, boxMode, trim, type WorkerEnv } from "./env.ts";
import {
  ASSESSMENT_RESULTS_NAME_MATCH_STUB,
  ASSESSMENT_RESULTS_STUB_REJECTED,
  acceptOfficialAssessmentResultsBytes,
} from "../../../src/lib/assessment-results-sheets.ts";

const BOX_API = "https://api.box.com/2.0";
const BOX_UPLOAD = "https://upload.box.com/api/2.0";
const BOX_TOKEN = "https://api.box.com/oauth2/token";

export const PREASSESSMENT_BLANK_NAME = "CMMC-L2-Pre-Assessment-Form-v3.9.xlsx";
export const REQUIRED_DATA_BLANK_NAME = "Required-Data-OSC.xlsx";
/** Keep in sync with `ASSESSMENT_RESULTS_BOX_BLANK_ALIASES` in src/lib/emass-xlsx.ts. */
export const ASSESSMENT_RESULTS_BLANK_NAMES = [
  "CMMC_Level2_AssessmentResults_Template.xlsx",
  "CMMC_Level2_AssessmentResults_Template",
] as const;

export function normalizeEmassBlankName(name: string): string {
  return name.trim().toLowerCase().replace(/\.xlsx$/i, "").replace(/[\s_\-]+/g, "");
}

export function isAssessmentResultsBlankName(fileName: string): boolean {
  const n = normalizeEmassBlankName(fileName);
  if (!n || n.startsWith("cui")) return false;
  return ASSESSMENT_RESULTS_BLANK_NAMES.some((alias) => normalizeEmassBlankName(alias) === n);
}

function namesMatch(fileName: string, expected: string): boolean {
  return normalizeEmassBlankName(fileName) === normalizeEmassBlankName(expected);
}

export type BoxFolder = { id: string; name: string; url: string };
export type BoxFile = { id: string; name: string };
export type CreateFolderOpts = { reuseIfExists?: boolean };

export type BoxClient = {
  mode: "mock" | "live";
  createFolder: (parentId: string, name: string, opts?: CreateFolderOpts) => Promise<BoxFolder>;
  getFolder: (folderId: string) => Promise<BoxFolder>;
  deleteFolder: (folderId: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<BoxFolder>;
  uploadFile: (folderId: string, name: string, body: Uint8Array, contentType: string) => Promise<BoxFile>;
  downloadFile: (fileId: string) => Promise<Uint8Array>;
  findChildFile: (folderId: string, name: string) => Promise<BoxFile | null>;
  findChildFolder: (parentId: string, name: string) => Promise<BoxFolder | null>;
  listChildFiles: (folderId: string) => Promise<BoxFile[]>;
};

function folderUrl(id: string): string {
  return `https://app.box.com/folder/${id}`;
}

function safeDispositionName(name: string): string {
  return name.replace(/["\\\r\n]/g, "-");
}

type TokenCache = { token: string; exp: number };

function mockBoxClient(): BoxClient {
  let n = 0;
  const next = (prefix: string) => `${prefix}${++n}`;
  const files = new Map<string, Uint8Array>();
  const folderFiles = new Map<string, BoxFile[]>();
  const folders = new Map<string, { id: string; name: string; parentId: string; url: string }>();
  return {
    mode: "mock",
    async createFolder(parentId, name, opts) {
      if (opts?.reuseIfExists) {
        for (const existing of folders.values()) {
          if (existing.parentId === parentId && existing.name === name) {
            return { id: existing.id, name: existing.name, url: existing.url };
          }
        }
      }
      const id = next("fld_");
      const folder = { id, name, parentId, url: folderUrl(id) };
      folders.set(id, folder);
      folderFiles.set(id, []);
      return { id, name, url: folder.url };
    },
    async getFolder(folderId) {
      const folder = folders.get(folderId);
      if (!folder) throw new Error("Box mock: folder not found");
      return { id: folder.id, name: folder.name, url: folder.url };
    },
    async deleteFolder(folderId) {
      if (!folders.has(folderId)) throw new Error("Box mock: folder not found");
      folders.delete(folderId);
      folderFiles.delete(folderId);
    },
    async renameFolder(folderId, name) {
      const folder = folders.get(folderId);
      if (!folder) throw new Error("Box mock: folder not found");
      folder.name = name;
      return { id: folder.id, name, url: folder.url };
    },
    async uploadFile(folderId, name, body) {
      const id = next("fil_");
      files.set(id, body);
      const file = { id, name };
      const list = folderFiles.get(folderId) ?? [];
      list.push(file);
      folderFiles.set(folderId, list);
      return file;
    },
    async downloadFile(fileId) {
      const body = files.get(fileId);
      if (!body) throw new Error("Box mock: file not found");
      return body;
    },
    async findChildFile(folderId, name) {
      return (folderFiles.get(folderId) ?? []).find((f) => namesMatch(f.name, name)) ?? null;
    },
    async findChildFolder(parentId, name) {
      for (const folder of folders.values()) {
        if (folder.parentId === parentId && folder.name === name) {
          return { id: folder.id, name: folder.name, url: folder.url };
        }
      }
      return null;
    },
    async listChildFiles(folderId) {
      return [...(folderFiles.get(folderId) ?? [])];
    },
  };
}

async function ccgToken(env: WorkerEnv, fetchImpl: typeof fetch, cache: TokenCache | null): Promise<{ token: string; cache: TokenCache }> {
  const now = Date.now();
  if (cache && cache.exp > now + 60_000) return { token: cache.token, cache };

  const clientId = trim(env.BOX_CLIENT_ID);
  const clientSecret = trim(env.BOX_CLIENT_SECRET);
  const enterpriseId = trim(env.BOX_ENTERPRISE_ID);
  if (!clientId || !clientSecret || !enterpriseId) {
    throw new Error("Box CCG is missing BOX_CLIENT_ID, BOX_CLIENT_SECRET, or BOX_ENTERPRISE_ID.");
  }

  const subjectType = trim(env.BOX_SUBJECT_TYPE) || "enterprise";
  const subjectId = trim(env.BOX_SUBJECT_ID) || enterpriseId;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    box_subject_type: subjectType,
    box_subject_id: subjectId,
  });

  const res = await fetchImpl(BOX_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Box token ${res.status}`);
  const json = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Box token response missing access_token");
  const next: TokenCache = {
    token: json.access_token,
    exp: now + Math.max(60, Number(json.expires_in) || 3600) * 1000,
  };
  return { token: next.token, cache: next };
}

function liveBoxClient(env: WorkerEnv, fetchImpl: typeof fetch): BoxClient {
  let cache: TokenCache | null = null;

  const auth = async () => {
    if (boxAuthMode(env) === "jwt") {
      throw new Error(
        "BOX_AUTH_MODE=jwt is reserved. Use CCG (BOX_CLIENT_ID / BOX_CLIENT_SECRET / BOX_ENTERPRISE_ID) in this slice.",
      );
    }
    const got = await ccgToken(env, fetchImpl, cache);
    cache = got.cache;
    return got.token;
  };

  async function listItems(folderId: string): Promise<{ id: string; name: string; type: string }[]> {
    const token = await auth();
    const url = `${BOX_API}/folders/${folderId}/items?fields=id,name,type&limit=1000`;
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Box list folder ${res.status}`);
    const json = JSON.parse(text) as { entries?: { id?: string; name?: string; type?: string }[] };
    return (json.entries ?? []).filter((e): e is { id: string; name: string; type: string } => Boolean(e.id));
  }

  async function createFolderOnce(
    parentId: string,
    name: string,
    attempt: number,
    opts?: CreateFolderOpts,
  ): Promise<BoxFolder> {
    const token = await auth();
    const res = await fetchImpl(`${BOX_API}/folders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, parent: { id: parentId } }),
    });
    const text = await res.text();
    if (res.status === 409) {
      if (opts?.reuseIfExists) {
        const existing = (await listItems(parentId)).find((e) => e.type === "folder" && e.name === name);
        if (existing) return { id: existing.id, name: existing.name || name, url: folderUrl(existing.id) };
        throw new Error("Box create folder 409 and existing folder was not found");
      }
      if (attempt < 2) {
        return createFolderOnce(parentId, `${name} (${crypto.randomUUID().slice(0, 8)})`, attempt + 1, opts);
      }
    }
    if (!res.ok) throw new Error(`Box create folder ${res.status}`);
    const json = JSON.parse(text) as { id?: string; name?: string };
    if (!json.id) throw new Error("Box create folder returned no id");
    return { id: json.id, name: json.name || name, url: folderUrl(json.id) };
  }

  return {
    mode: "live",
    async createFolder(parentId, name, opts) {
      return createFolderOnce(parentId, name, 0, opts);
    },
    async getFolder(folderId) {
      const token = await auth();
      const res = await fetchImpl(`${BOX_API}/folders/${folderId}?fields=id,name`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Box get folder ${res.status}`);
      const json = JSON.parse(text) as { id?: string; name?: string };
      if (!json.id) throw new Error("Box get folder returned no id");
      return { id: json.id, name: json.name || "", url: folderUrl(json.id) };
    },
    async deleteFolder(folderId) {
      const token = await auth();
      const res = await fetchImpl(`${BOX_API}/folders/${folderId}?recursive=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error(`Box delete folder ${res.status}`);
    },
    async renameFolder(folderId, name) {
      const token = await auth();
      const res = await fetchImpl(`${BOX_API}/folders/${folderId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Box rename folder ${res.status}`);
      const json = JSON.parse(text) as { id?: string; name?: string };
      const id = json.id || folderId;
      return { id, name: json.name || name, url: folderUrl(id) };
    },
    async uploadFile(folderId, name, body, contentType) {
      const token = await auth();
      const attributes = JSON.stringify({ name, parent: { id: folderId } });
      const form = new FormData();
      form.append("attributes", attributes);
      form.append("file", new Blob([body], { type: contentType }), safeDispositionName(name));
      const res = await fetchImpl(`${BOX_UPLOAD}/files/content`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: form,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Box upload ${res.status}`);
      const json = JSON.parse(text) as { entries?: { id?: string; name?: string }[] };
      const entry = json.entries?.[0];
      if (!entry?.id) throw new Error("Box upload returned no file id");
      return { id: entry.id, name: entry.name || name };
    },
    async downloadFile(fileId) {
      const token = await auth();
      const res = await fetchImpl(`${BOX_API}/files/${fileId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`Box download ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async listChildFiles(folderId) {
      return (await listItems(folderId))
        .filter((e) => e.type === "file")
        .map((e) => ({ id: e.id, name: e.name || "" }));
    },
    async findChildFile(folderId, name) {
      return (await this.listChildFiles(folderId)).find((f) => namesMatch(f.name, name)) ?? null;
    },
    async findChildFolder(parentId, name) {
      const hit = (await listItems(parentId)).find((e) => e.type === "folder" && e.name === name);
      return hit ? { id: hit.id, name: hit.name || name, url: folderUrl(hit.id) } : null;
    },
  };
}

export function createBoxClient(env: WorkerEnv, fetchImpl: typeof fetch = fetch): BoxClient {
  if (boxMode(env) === "mock") return mockBoxClient();
  return liveBoxClient(env, fetchImpl);
}

/** Track B: one drop folder. No 00–03 children (that skeleton is Track A / Automate). */
export async function createDropFolder(
  box: BoxClient,
  parentId: string,
  dropName: string,
  opts?: CreateFolderOpts,
): Promise<BoxFolder> {
  return box.createFolder(parentId, dropName, opts);
}

/** Prefix so a leftover drop after a failed upload is not mistaken for a complete submit. */
export function failedDropName(name: string): string {
  const prefix = "Failed- ";
  const next = name.startsWith(prefix) ? name : `${prefix}${name}`;
  return next.slice(0, 255);
}

/** Best-effort: delete an incomplete drop, or rename it Failed- so it is not a useful-looking empty folder. */
export async function abandonDropFolder(box: BoxClient, drop: BoxFolder): Promise<"deleted" | "renamed" | "left"> {
  try {
    await box.deleteFolder(drop.id);
    return "deleted";
  } catch {
    try {
      await box.renameFolder(drop.id, failedDropName(drop.name));
      return "renamed";
    } catch {
      return "left";
    }
  }
}

export type BlankTemplates = {
  preAssessment?: Uint8Array;
  requiredData?: Uint8Array;
  assessmentResults?: Uint8Array;
  /** Set when AR bytes were missing or a Cover stub (name-match or file id). */
  assessmentResultsSkipped?: string;
};

async function acceptAssessmentResultsBytes(
  bytes: Uint8Array,
  via: "file-id" | "name-match",
): Promise<{ bytes?: Uint8Array; skipped?: string }> {
  const accepted = acceptOfficialAssessmentResultsBytes(bytes);
  if (accepted.bytes) return accepted;
  if (via === "name-match") {
    return { skipped: ASSESSMENT_RESULTS_NAME_MATCH_STUB };
  }
  return { skipped: accepted.skipped || ASSESSMENT_RESULTS_STUB_REJECTED };
}

export async function loadBlankTemplates(box: BoxClient, env: WorkerEnv): Promise<BlankTemplates> {
  const out: BlankTemplates = {};
  const preId = trim(env.BOX_PREASSESSMENT_TEMPLATE_FILE_ID);
  const reqId = trim(env.BOX_REQUIRED_DATA_TEMPLATE_FILE_ID);
  const resultsId = trim(env.BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID);
  if (preId) out.preAssessment = await box.downloadFile(preId);
  if (reqId) out.requiredData = await box.downloadFile(reqId);
  if (resultsId) {
    const accepted = await acceptAssessmentResultsBytes(await box.downloadFile(resultsId), "file-id");
    if (accepted.bytes) out.assessmentResults = accepted.bytes;
    else out.assessmentResultsSkipped = accepted.skipped;
  }
  const folderId = trim(env.BOX_TEMPLATE_FOLDER_ID);
  if (folderId && (!out.preAssessment || !out.requiredData || !out.assessmentResults)) {
    const listed = await box.listChildFiles(folderId);
    if (!out.preAssessment) {
      const f = listed.find((file) => namesMatch(file.name, PREASSESSMENT_BLANK_NAME));
      if (f) out.preAssessment = await box.downloadFile(f.id);
    }
    if (!out.requiredData) {
      const f = listed.find((file) => namesMatch(file.name, REQUIRED_DATA_BLANK_NAME));
      if (f) out.requiredData = await box.downloadFile(f.id);
    }
    // Empty file id → name-match. If that file is the Cover stub, refuse (do not
    // fall back to an in-repo docs/emass file of the same name).
    if (!out.assessmentResults && !resultsId) {
      const f = listed.find((file) => isAssessmentResultsBlankName(file.name));
      if (f) {
        const accepted = await acceptAssessmentResultsBytes(await box.downloadFile(f.id), "name-match");
        if (accepted.bytes) out.assessmentResults = accepted.bytes;
        else out.assessmentResultsSkipped = accepted.skipped;
      }
    }
  }
  return out;
}
