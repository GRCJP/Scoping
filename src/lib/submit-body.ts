import { normalizeAnswers, validateNormalizedAnswers } from "./normalize-answers.ts";

export const MAX_SUBMIT_BODY_BYTES = 64 * 1024;

export type SubmitParseFail = { ok: false; error: string; status: number; field?: string };
export type SubmitParseOk = { ok: true; answers: import("./types.ts").FormAnswers };
export type SubmitParseResult = SubmitParseOk | SubmitParseFail;

export function parseSubmitBody(text: string, contentLengthHeader?: string | null): SubmitParseResult {
  const declared = Number(contentLengthHeader || "0");
  if (Number.isFinite(declared) && declared > MAX_SUBMIT_BODY_BYTES) {
    return { ok: false, error: "Payload too large.", status: 413 };
  }
  if (new TextEncoder().encode(text).length > MAX_SUBMIT_BODY_BYTES) {
    return { ok: false, error: "Payload too large.", status: 413 };
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Invalid JSON.", status: 400 };
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON.", status: 400 };
  }
  const rec = body as Record<string, unknown>;
  if (Object.keys(rec).some((k) => k !== "answers")) {
    return { ok: false, error: "Unexpected field.", status: 400 };
  }

  const normalized = normalizeAnswers(rec.answers);
  if (!normalized.ok) return { ok: false, error: normalized.error, status: 400, field: normalized.field };

  const incomplete = validateNormalizedAnswers(normalized.answers);
  if (incomplete) return { ok: false, error: incomplete.error, status: 400, field: incomplete.field };

  return { ok: true, answers: normalized.answers };
}
