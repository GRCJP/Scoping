import type { NextRequest } from "next/server";

export const ASSESSOR_COOKIE = "psc_assessor";
export const ASSESSOR_HEADER = "x-prescope-assessor-key";

export const ASSESSOR_LOGIN_PATH = "/assessor/login";
export const ASSESSOR_SESSION_PATH = "/api/assessor/session";

/** HTML login + session cookie API. Must stay off the AuthZ gate (chicken-and-egg). */
export function isAssessorPublicPath(pathname: string): boolean {
  if (pathname === ASSESSOR_LOGIN_PATH || pathname.startsWith(`${ASSESSOR_LOGIN_PATH}/`)) return true;
  return pathname === ASSESSOR_SESSION_PATH || pathname.startsWith(`${ASSESSOR_SESSION_PATH}/`);
}

/**
 * Assessor / PII surfaces the OSC must never reach.
 * `/api/assessor/session` is excluded via isAssessorPublicPath so a bad key
 * reaches the handler (401) instead of a middleware 404.
 */
export const ASSESSOR_GATED_PATHS: readonly RegExp[] = [
  /^\/assessor(?:\/|$)/,
  /^\/drop\/[^/]+\/internal(?:\/|$)/,
  /^\/api\/submissions(?:\/|$)/,
  /^\/api\/assessor(?:\/|$)/,
];

export function isAssessorGatedPath(pathname: string): boolean {
  if (isAssessorPublicPath(pathname)) return false;
  return ASSESSOR_GATED_PATHS.some((re) => re.test(pathname));
}

export type AssessorSessionDecision =
  | { ok: true; open?: boolean }
  | { ok: false; status: 401 | 404; error: string };

/**
 * Login API contract: wrong key → 401. Empty configured key off-loopback → 404
 * (fail closed, no oracle that a key exists). Middleware must not intercept.
 */
export function decideAssessorSessionLogin(opts: {
  configuredKey: string;
  providedKey: string;
  loopback: boolean;
}): AssessorSessionDecision {
  const key = opts.configuredKey.trim();
  if (!key) {
    return opts.loopback ? { ok: true, open: true } : { ok: false, status: 404, error: "Not found" };
  }
  if (!assessorSecretMatches(opts.providedKey, key)) {
    return { ok: false, status: 401, error: "Invalid key." };
  }
  return { ok: true };
}

export function configuredAssessorKey(env: NodeJS.ProcessEnv = process.env): string {
  return (env.PSC_ASSESSOR_KEY ?? "").trim();
}

/**
 * Header or cookie only. Query `?key=` is never read — even if present and correct.
 */
export function providedAssessorSecretFrom(parts: {
  header?: string | null;
  cookie?: string | null;
  /** Ignored. Query keys must never authenticate. */
  query?: string | null;
}): { value: string; via: "header" | "cookie" | "" } {
  const header = parts.header?.trim() ?? "";
  if (header) return { value: header, via: "header" };
  const cookie = parts.cookie?.trim() ?? "";
  if (cookie) return { value: cookie, via: "cookie" };
  return { value: "", via: "" };
}

export function providedAssessorSecret(req: NextRequest): { value: string; via: "header" | "cookie" | "" } {
  return providedAssessorSecretFrom({
    header: req.headers.get(ASSESSOR_HEADER),
    cookie: req.cookies.get(ASSESSOR_COOKIE)?.value,
    query: req.nextUrl.searchParams.get("key"),
  });
}

/** Constant-time string compare. Length mismatch still scans both sides. */
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

export function assessorSecretMatches(provided: string, expected: string): boolean {
  if (!expected) return false;
  return timingSafeEqualString(provided, expected);
}

export function hostnameFromHostHeader(hostHeader: string): string {
  const raw = hostHeader.trim().toLowerCase();
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end >= 0 ? raw.slice(1, end) : raw.replace(/^\[|\]$/g, "");
  }
  if ((raw.match(/:/g) || []).length > 1) return raw.split("%")[0] ?? raw;
  return raw.split(":")[0] ?? "";
}

export function isLoopbackHostname(hostHeader: string): boolean {
  const hostname = hostnameFromHostHeader(hostHeader);
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

/**
 * Loopback Host only. Do not trust X-Forwarded-* to open the gate.
 * Empty PSC_ASSESSOR_KEY is allowed solely on 127.0.0.1 / localhost / ::1.
 */
export function isLoopbackHost(req: NextRequest): boolean {
  const host = req.headers.get("host") ?? req.nextUrl.host ?? "";
  return isLoopbackHostname(host);
}

export type AssessorGateDecision = "allow" | "deny" | "open-loopback";

export function decideAssessorGate(opts: {
  configuredKey: string;
  provided: string;
  loopback: boolean;
}): AssessorGateDecision {
  const key = opts.configuredKey.trim();
  if (!key) return opts.loopback ? "open-loopback" : "deny";
  return assessorSecretMatches(opts.provided, key) ? "allow" : "deny";
}

export function assessorCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}
