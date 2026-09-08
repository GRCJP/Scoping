/** RFC 4122 UUID (crypto.randomUUID / CSPRNG). Path ids must match this exactly. */
export const SUBMISSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function newSubmissionId(): string {
  return crypto.randomUUID();
}

/** 128-bit CSPRNG hex token, optionally prefixed for non-capability labels. */
export function newOpaqueId(prefix = ""): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return `${prefix}${hex}`;
}

export function isSubmissionId(id: unknown): id is string {
  return typeof id === "string" && SUBMISSION_ID_RE.test(id);
}

/** Public thank-you path. Always includes the submission id. */
export function successPathForId(id: string): string | null {
  return isSubmissionId(id) ? `/success/${id}` : null;
}
