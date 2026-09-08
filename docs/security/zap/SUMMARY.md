# Scoping Track B — ZAP Baseline summary

**Generated:** `2026-09-05T16:27:09Z`  
**Engine:** local official ZAP **2.17.0** (`zap.sh -cmd -autorun`) on Java 21. Docker was **not** available on the cloud VM (`docker: command not found`); the harness fell back as designed.  
**Target:** `https://prescope-intake.example.workers.dev/intake`  
**Source:** `zap-baseline-report.html` / `zap-baseline-report.json`  
**Method:** ZAP Baseline equivalent — traditional spider (38 URLs, 2 threads, `postForm=false`) + passive rules. **No active scan. No submit-secret probe. No live form POST.**

Architect (Dave) gates remediations. This file is not a license to write exploit PoCs.

## Counts

| Severity | Findings |
| --- | ---: |
| High | **0** |
| Medium | **0** |
| Low | 4 |
| Informational | 2 |

High and Medium are listed first (none). The Low items are header gaps on `/_next/static/*` or known Next/OpenNext residuals. HTML `/intake` already sends HSTS, CSP, `X-Frame-Options: DENY`, `nosniff`, and `no-store`.

## Findings

### 1. Strict-Transport-Security Header Not Set

| | |
| --- | --- |
| **Severity (ZAP risk)** | Low |
| **OWASP Top 10 (2021)** | A05:2021 Security Misconfiguration |
| **CWE / plugin** | CWE-319 / 10035 |
| **URL** | `https://prescope-intake.example.workers.dev/_next/static/css/3bd605b165ba0def.css` (and four `/_next/static/media/*.woff2` fonts) |
| **Evidence snippet** | Header absent on those static responses. `/intake` HTML **does** send `Strict-Transport-Security: max-age=31536000; includeSubDomains` (twice — middleware + `next.config`). |
| **Recommended fix** | Stamp HSTS on `/_next/static/*` as well. Today `src/middleware.ts` skips `_next/static` so OpenNext/ASSETS serve CSS/fonts without the page headers. Cloudflare Cache / a Worker transform on `/_next/:path*` is enough; browsers already inherit HSTS from the HTML response for this host. |
| **False positive / residual?** | **Partial residual, not a missing HSTS on the app.** Do not treat as “HSTS unset on Track B.” Submit Worker `GET /health` also lacks HSTS on the wire (see below) — likely `*.workers.dev` platform policy plus a deploy that does not emit `PII_HEADERS` CSP/HSTS. |

### 2. X-Content-Type-Options Header Missing

| | |
| --- | --- |
| **Severity (ZAP risk)** | Low |
| **OWASP Top 10 (2021)** | A05:2021 Security Misconfiguration |
| **CWE / plugin** | CWE-693 / 10021 |
| **URL** | Same `/_next/static/css` and `/_next/static/media/*.woff2` set as #1 |
| **Evidence snippet** | `x-content-type-options` not present on immutable static assets. `/intake` sends `nosniff` (duplicated). |
| **Recommended fix** | Same as #1: apply `X-Content-Type-Options: nosniff` on the static asset path. Low risk — CSS/woff2 already have correct `Content-Type`. |
| **False positive / residual?** | Residual on static only. HTML/API already covered by Track B hardening (PSC-B-02 / PSC-05). |

### 3. Server Leaks Information via "X-Powered-By"

| | |
| --- | --- |
| **Severity (ZAP risk)** | Low |
| **OWASP Top 10 (2021)** | A05:2021 Security Misconfiguration |
| **CWE / plugin** | CWE-497 / 10037 |
| **URL** | `https://prescope-intake.example.workers.dev/intake` (also `/`, `/robots.txt`, `/sitemap.xml`) |
| **Evidence snippet** | `x-powered-by: Next.js` |
| **Recommended fix** | `poweredByHeader: false` in `next.config.ts` (and confirm OpenNext does not re-add it). Fingerprint only. |
| **False positive / residual?** | True finding, **low value**. Not an access-control bypass. `x-opennext: 1` is a second fingerprint. |

### 4. Big Redirect Detected (Potential Sensitive Information Leak)

| | |
| --- | --- |
| **Severity (ZAP risk)** | Low |
| **OWASP Top 10 (2021)** | A05:2021 Security Misconfiguration |
| **CWE / plugin** | CWE-201 / 10044 |
| **URL** | `https://prescope-intake.example.workers.dev` and `/` → `Location: /intake` |
| **Evidence snippet** | `Location header URI length: 7 [/intake]. Predicted response size: 307. Response Body Length: 6,912.` |
| **Recommended fix** | Optional: make the `/` → `/intake` 307 a header-only redirect (empty body). Next/OpenNext currently returns a full HTML document with the Location header. |
| **False positive / residual?** | **Mostly false positive for PII leak.** Body is the public intake shell, not assessor data. Confirmed `no-store` + security headers on the 307. No CUI/PII in that body. |

### 5. Information Disclosure - Suspicious Comments

| | |
| --- | --- |
| **Severity (ZAP risk)** | Informational |
| **OWASP Top 10 (2021)** | A05:2021 Security Misconfiguration |
| **CWE / plugin** | CWE-615 / 10027 |
| **URL** | `/_next/static/chunks/*.js` including `app/intake/page-*.js` |
| **Evidence snippet** | Token matches: `bug`, `query`, `select`, `admin`, `from` inside minified Next/React/core-js and the Harborline **demo fixture** (`//harborline.example` … `hlocage`). |
| **Recommended fix** | None for production security. Do not strip Next error-URL comments. Demo fixture strings are intentional local samples (`src/lib/samples.ts`), not live OSC PII. |
| **False positive / residual?** | **False positive.** Classic ZAP `\bBUG\b` / `\bSELECT\b` / `\bADMIN\b` hits on minified vendor JS and the committed Harborline example. |

### 6. Modern Web Application

| | |
| --- | --- |
| **Severity (ZAP risk)** | Informational |
| **OWASP Top 10 (2021)** | — (not a vulnerability) |
| **CWE / plugin** | — / 10109 |
| **URL** | `https://prescope-intake.example.workers.dev/` |
| **Evidence snippet** | `<script src="/_next/static/chunks/4bd1b696-c023c6e3521b1417.js" async=""></script>` |
| **Recommended fix** | None. ZAP is telling operators that an Ajax/modern spider would crawl the App Router more thoroughly. |
| **False positive / residual?** | Informational. Traditional spider still collected 38 URLs including `/intake`. Ajax/`ZAP_LIGHT=1` was **not** run here (no Docker, no browser pack). Admin can re-run with Docker + `ZAP_LIGHT=1` if they want the extra crawl. Still no active scan. |

## Submit Worker — HEADER / TLS / CORS (not spidered)

Observation only. Details: `submit-observe.md`.

| Check | Result |
| --- | --- |
| `GET /` and `GET /health` | 200 `{"ok":true,"service":"prescope-submit"}` |
| CORS | `Access-Control-Allow-Origin` **absent** on intake-origin and `evil.example` preflights. `OPTIONS /submit` → 404. Good (no `*`). |
| TLS | TLSv1.3, `TLS_AES_256_GCM_SHA384`, cert `CN=example.workers.dev` (Google Trust Services WE1). |
| HSTS / CSP on the wire | **Absent** on live `GET /health` despite `workers/prescope-submit/src/http.ts` setting both. `Cache-Control: no-store, private`, `nosniff`, `X-Frame-Options: DENY` are present. |
| Writes | Not tested. No `Authorization` header, no secret guess, no POST flood. |

Treat missing submit HSTS on `*.workers.dev` as a **platform residual** unless a custom domain is attached. Architect can still decide whether the live Worker is an older deploy than `http.ts`.

## Assessor surfaces — soft touch

See `assessor-soft-touch.md`. Matches Track B hardening (`docs/security/owasp-track-b.md` PSC-B-01):

| Request | Status |
| --- | --- |
| `GET /assessor` (Accept: HTML) | **307** → `/assessor/login` |
| `GET /assessor/login` | **200** |
| `POST /api/assessor/session` `{}` | **401** `{"error":"Invalid key."}` |
| `GET /api/assessor/emass` | **404** |
| `GET /api/submissions` | **404** |

No keys were sent. No brute-force.

## Not a ZAP finding (already documented)

- **CSP `script-src` includes `'unsafe-inline'` and `'unsafe-eval'`** on HTML (PSC-B-04 / PSC-05). ZAP did not raise a CSP alert because a policy is present. Residual until nonces exist on the Worker.
- **Duplicated security headers** on HTML (`HSTS, HSTS` / `nosniff, nosniff`) from middleware + `next.config` both applying. Harmless; optional cleanup.

## Out of scope / not tested

- Active scan (injected attack payloads).
- Brute-force or guessing of `PRESCOPE_SUBMIT_SECRET` / `PSC_ASSESSOR_KEY`.
- Authenticated assessor chrome beyond the soft-touch table.
- Submit Worker `POST /submit` (trusted caller only).
- Box, eMASS fill container, Track A / Power Pages, or any host outside the operator's `*.example.workers.dev` pair.

Re-run: `bash scripts/zap-baseline.sh`. How-to: `README.md` in this folder.
