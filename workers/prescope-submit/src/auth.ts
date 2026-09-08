/** Shared-secret gate. Query strings are never credentials. */

export const FILL_KEY_HEADER = "X-Prescope-Fill-Key";

export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  const len = Math.max(left.length, right.length, 1);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/** Bearer first, then X-Prescope-Fill-Key. Query `?key=` is ignored even if present. */
export function providedSubmitSecret(headers: Headers): string {
  const auth = headers.get("Authorization") ?? "";
  const bearer = /^Bearer\s+(\S+)/i.exec(auth);
  if (bearer?.[1]) return bearer[1];
  return (headers.get(FILL_KEY_HEADER) ?? "").trim();
}

export function submitSecretMatches(provided: string, expected: string): boolean {
  const want = expected.trim();
  if (!want) return false;
  return timingSafeEqualString(provided, want);
}

export function authorizeRequest(headers: Headers, expectedSecret: string): boolean {
  return submitSecretMatches(providedSubmitSecret(headers), expectedSecret);
}
