import { sanitizeCustomer } from "./docs";
import { easternDate } from "./scoring";
import { orgName, type Submission } from "./types";

export type BoxWriteStatus = "skipped" | "uploaded" | "failed";

export type BoxConfig = {
  customerLink: string;
  accessToken: string;
  answersFolderId: string;
  uploadsFolderId: string;
  dropsParentId: string;
  templateFolderId: string;
};

function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Server-only. Never send this object to the OSC. */
export function getBoxConfig(): BoxConfig {
  return {
    customerLink: trimEnv("PSC_BOX_CUSTOMER_LINK"),
    accessToken: trimEnv("PSC_BOX_ACCESS_TOKEN") || trimEnv("BOX_ACCESS_TOKEN"),
    answersFolderId: trimEnv("PSC_BOX_ANSWERS_FOLDER_ID"),
    uploadsFolderId: trimEnv("PSC_BOX_UPLOADS_FOLDER_ID"),
    dropsParentId: trimEnv("PSC_BOX_DROPS_PARENT_ID"),
    templateFolderId: trimEnv("PSC_BOX_TEMPLATE_FOLDER_ID"),
  };
}

export function publicBoxLink(config = getBoxConfig()): string {
  return config.customerLink;
}

export function canWriteAnswers(config = getBoxConfig()): boolean {
  return Boolean(config.accessToken && config.answersFolderId);
}

export function answersFileName(org: string, submittedon: string, id: string): string {
  const day = easternDate(new Date(submittedon));
  return `${sanitizeCustomer(org)} - OSC Discovery Answers - ${day} - ${id}.md`;
}

function safeDispositionName(name: string): string {
  return name.replace(/["\\\r\n]/g, "-");
}

type UploadResult =
  | { ok: true; fileId: string; name: string }
  | { ok: false; detail: string };

async function uploadMarkdown(opts: {
  token: string;
  folderId: string;
  name: string;
  body: string;
}): Promise<UploadResult> {
  const attributes = JSON.stringify({
    name: opts.name,
    parent: { id: opts.folderId },
  });
  const form = new FormData();
  form.append("attributes", attributes);
  form.append(
    "file",
    new Blob([opts.body], { type: "text/markdown; charset=utf-8" }),
    safeDispositionName(opts.name)
  );

  const res = await fetch("https://upload.box.com/api/2.0/files/content", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      Accept: "application/json",
    },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, detail: `Box upload ${res.status}` };
  }
  try {
    const json = JSON.parse(text) as { entries?: { id?: string; name?: string }[] };
    const entry = json.entries?.[0];
    if (!entry?.id) return { ok: false, detail: "Box upload returned no file id" };
    return { ok: true, fileId: entry.id, name: entry.name || opts.name };
  } catch {
    return { ok: false, detail: "Box upload returned invalid JSON" };
  }
}

/**
 * Point the thank-you CTA at the configured 01+02 Box link and, when a token
 * plus 01 Answers folder id are present, write the public answers markdown.
 * Does not create folders, collaborations, or shared links. Never writes 00 Internal.
 */
export async function applyBoxHandoff(submission: Submission): Promise<Submission> {
  const config = getBoxConfig();
  const customerLink = config.customerLink || submission.box.customerLink;
  const live = Boolean(config.customerLink);

  let writeStatus: BoxWriteStatus = "skipped";
  let writeDetail =
    "No Box token or 01 Answers folder id. OSC still sees the configured customer link if set. Create the tree by hand, then paste PSC_BOX_ANSWERS_FOLDER_ID and PSC_BOX_ACCESS_TOKEN.";
  let answersFileId: string | undefined;

  if (canWriteAnswers(config)) {
    const name = answersFileName(orgName(submission.answers), submission.submittedon, submission.id);
    const result = await uploadMarkdown({
      token: config.accessToken,
      folderId: config.answersFolderId,
      name,
      body: submission.answersMarkdown,
    });
    if (result.ok) {
      writeStatus = "uploaded";
      writeDetail = `Wrote ${result.name} into 01 Answers. 02 Uploads is for evidence. 00 Internal was not touched.`;
      answersFileId = result.fileId;
    } else {
      writeStatus = "failed";
      writeDetail = result.detail;
    }
  }

  const next: Submission = {
    ...submission,
    box: {
      ...submission.box,
      customerLink,
      live,
      writeStatus,
      writeDetail,
      answersFileId,
      parentName: live ? "Box · 01 Answers + 02 Uploads" : submission.box.parentName,
      parentNote: live
        ? "Configured customer evidence link. 00 Internal is not on this link."
        : submission.box.parentNote,
    },
    customerEmail: {
      ...submission.customerEmail,
      body: submission.customerEmail.body.replace(submission.box.customerLink, customerLink),
    },
  };

  const handoffBeat = next.beats.find((b) => b.beat === 4);
  if (handoffBeat) {
    handoffBeat.detail = live
      ? `Customer CTA uses PSC_BOX_CUSTOMER_LINK (01+02 only). ${writeDetail}`
      : `No PSC_BOX_CUSTOMER_LINK yet — thank-you uses the simulated drop. ${writeDetail}`;
    handoffBeat.status = writeStatus === "failed" ? "info" : "ok";
  }

  return next;
}
