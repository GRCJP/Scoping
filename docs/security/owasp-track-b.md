# Track B (Cloudflare) — OWASP 2021 hardening

**Audience:** Architect / C3PAO lead  
**Scope:** Live intake Worker (`prescope-intake`) + submit Worker (`prescope-submit`). No exploits, PoCs, or secret probing.  
**Rubric:** OWASP Top 10 2021. Draft reviews #16 / #17 stay report-only; Track A remediations already landed in #18.

## Findings → remediations (this PR)

| ID | OWASP 2021 | Severity | Fix |
| --- | --- | --- | --- |
| **PSC-B-01** | A01 Broken Access Control | High | Middleware no longer 404s `POST /api/assessor/session`. Login + session API are public paths. A bad key reaches the handler and returns **401**. Other `/api/assessor/*` (eMASS) stay gated. |
| **PSC-B-02** | A05 Security Misconfiguration | Medium | `Strict-Transport-Security: max-age=31536000; includeSubDomains` on intake (middleware + `next.config`) and on every submit Worker JSON response. |
| **PSC-B-03** | A01 / A04 (cache of PII) | Medium | `POST /api/submit` uses `jsonPii` so **errors and successes** send `Cache-Control: no-store, private`. Middleware also stamps no-store on `/api/submit`. |
| **PSC-B-04** | A05 CSP | Residual | Framing / `object-src` / `upgrade-insecure-requests` tightened. **`script-src` still includes `'unsafe-inline'` and `'unsafe-eval'`** — required for Next App Router + OpenNext bootstrap. Nonces are not wired on the Worker. Do not treat CSP as XSS-proof. |

## Follow-ups (not in this PR)

- Replace the shared `PSC_ASSESSOR_KEY` with a named assessor IdP (Cloudflare Access, passkeys, or mailbox magic-link).
- Put Cloudflare Access (or equivalent mTLS / service token) in front of `prescope-submit` so the shared `PRESCOPE_SUBMIT_SECRET` is not the only network gate.

PRs #16 / #17 remain useful as the original write-up; do not duplicate those reports here.

## How to verify

From the repo root (no live secret guessing):

```
npm test
```

Checks that matter for this PR:

- `isAssessorGatedPath("/api/assessor/session") === false`
- `decideAssessorSessionLogin({ providedKey: "nope", … })` → `{ status: 401 }`
- `isAssessorGatedPath("/api/assessor/emass") === true`
- Security headers include HSTS; `/api/submit` is a PII no-store path
- Submit Worker `GET /health` and unauthorized `POST /submit` include HSTS + `no-store`

After deploy (operator, on the live host):

1. `POST /api/assessor/session` with a wrong JSON `key` → **401** (not 404). Login form still works.
2. Response headers on `/intake` and submit Worker `/health` include `Strict-Transport-Security`.
3. `POST /api/submit` with invalid JSON → 400 and `Cache-Control: no-store, private`.
4. Intake pages still render (CSP residual tokens must stay).

Do not add payloads, exploit scripts, or attempts to recover Worker secrets.

Authorized live DAST (ZAP Baseline, spider + passive only): [`zap/`](zap/).
