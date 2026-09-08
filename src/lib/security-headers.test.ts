import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySecurityHeaders,
  CONTENT_SECURITY_POLICY,
  GLOBAL_SECURITY_HEADERS,
  isPiiPath,
  PII_CACHE_CONTROL,
  PII_NO_STORE_HEADERS,
  STRICT_TRANSPORT_SECURITY,
} from "./security-headers.ts";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("security headers (PSC-05, PSC-06)", () => {
  it("sets CSP frame-ancestors, HSTS, Referrer-Policy, and nosniff", () => {
    assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
    assert.match(CONTENT_SECURITY_POLICY, /default-src 'self'/);
    assert.match(CONTENT_SECURITY_POLICY, /upgrade-insecure-requests/);
    const keys = Object.fromEntries(GLOBAL_SECURITY_HEADERS.map((h) => [h.key, h.value]));
    assert.equal(keys["Referrer-Policy"], "no-referrer");
    assert.equal(keys["X-Frame-Options"], "DENY");
    assert.equal(keys["X-Content-Type-Options"], "nosniff");
    assert.equal(keys["Strict-Transport-Security"], STRICT_TRANSPORT_SECURITY);
    assert.match(STRICT_TRANSPORT_SECURITY, /max-age=31536000/);
  });

  it("documents residual unsafe-inline / unsafe-eval for OpenNext", () => {
    assert.match(CONTENT_SECURITY_POLICY, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
    const source = readFileSync(join(srcRoot, "lib/security-headers.ts"), "utf8");
    assert.match(source, /Residual \(OpenNext/);
    assert.match(source, /unsafe-inline/);
  });

  it("uses no-store on PII responses including /api/submit", () => {
    assert.equal(PII_CACHE_CONTROL, "no-store, private");
    assert.ok(PII_NO_STORE_HEADERS.some((h) => h.key === "Cache-Control" && h.value.includes("no-store")));
    assert.equal(isPiiPath("/api/submit"), true);
    assert.equal(isPiiPath("/intake"), false);
    const headers = new Headers();
    applySecurityHeaders(headers, "/api/submit");
    assert.match(headers.get("Cache-Control") ?? "", /no-store/);
    assert.equal(headers.get("Strict-Transport-Security"), STRICT_TRANSPORT_SECURITY);
    const submit = readFileSync(join(srcRoot, "app/api/submit/route.ts"), "utf8");
    assert.match(submit, /jsonPii/);
    assert.equal(submit.includes("NextResponse.json"), false);
  });
});
