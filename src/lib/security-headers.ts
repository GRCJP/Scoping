/** Shared security + PII cache headers. Imported by next.config.ts, middleware, and API routes. */

export const PII_CACHE_CONTROL = "no-store, private";

export const PII_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": PII_CACHE_CONTROL,
  Pragma: "no-cache",
};

export const STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains";

/**
 * CSP is tight on framing and navigation.
 *
 * Residual (OpenNext / Next App Router): `script-src` keeps `'unsafe-inline'`
 * and `'unsafe-eval'`. Nonces are not wired through the OpenNext Worker
 * bootstrap; stripping those tokens breaks intake. Do not treat this CSP as
 * XSS-proof. Framing (`frame-ancestors`), `object-src`, and
 * `upgrade-insecure-requests` are the enforceable bits.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const GLOBAL_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "Strict-Transport-Security", value: STRICT_TRANSPORT_SECURITY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

export const PII_NO_STORE_HEADERS: { key: string; value: string }[] = [
  { key: "Cache-Control", value: PII_CACHE_CONTROL },
  { key: "Pragma", value: "no-cache" },
];

const PII_PATHS = [
  /^\/api\/submit(?:\/|$)/,
  /^\/api\/submissions(?:\/|$)/,
  /^\/api\/assessor(?:\/|$)/,
  /^\/assessor(?:\/|$)/,
  /^\/drop(?:\/|$)/,
  /^\/success(?:\/|$)/,
];

export function isPiiPath(pathname: string): boolean {
  return PII_PATHS.some((re) => re.test(pathname));
}

/** Apply global headers (and no-store on PII) onto an existing Headers object. */
export function applySecurityHeaders(headers: Headers, pathname = ""): void {
  for (const { key, value } of GLOBAL_SECURITY_HEADERS) {
    headers.set(key, value);
  }
  if (pathname && isPiiPath(pathname)) {
    for (const { key, value } of PII_NO_STORE_HEADERS) {
      headers.set(key, value);
    }
  }
}
