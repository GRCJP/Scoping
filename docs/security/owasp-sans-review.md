# Scoping (OSC Discovery) — OWASP / SANS application security review

**Audience:** Architect (copy to the C3PAO lead / LCCA, Acme Assessments)  
**Reviewer role:** Senior application security engineer  
**Rubric:** OWASP ASVS (v4.0.3, focused on V4 access control, V5 validation, V13 API, V14 config), OWASP Top 10 2021 and 2025, SANS CWE Top 25  
**Scope:** Public 8-step OSC environment intake on this GitHub repo (`GRCJP/Assessment-Scoping`). OSC does not log in. Answers live in an in-memory `Map`. Box is not connected. No CUI was entered or invented for this review.  
**Method:** Static review of `src/app/api/`, public intake vs assessor chrome vs drop links, middleware, store, markdown rendering, brand/logo file serving, env examples, and gitignore. No exploits, PoCs, payloads, or weaponized reproduction steps.  
**Reviewed revision:** `0409fce` (`main` at review start)  
**Date:** 2026-09-03

### Remediation note (hardening PR)

Findings below are unchanged. This table records what the follow-up PR implemented — no exploits or PoCs were added.

**Read this table first.** The Executive summary and every finding body below are preserved exactly as written on 2026-09-03 against revision `0409fce`. They are a historical record, not a description of current `main`. Where the two disagree, this table and `docs/security/owasp-track-b.md` are current.

| ID | Status |
| --- | --- |
| **PSC-01** | Fixed. Query `?key=` is ignored. Header `x-prescope-assessor-key` or HttpOnly SameSite=Strict cookie (`/assessor/login`). Constant-time compare. `GET /api/submissions/[id]` returns a DTO without `fingerprint`. |
| **PSC-02** | Fixed. Ids are `crypto.randomUUID()` (path format allowlisted). Public `/drop/[id]/customer` and `/success/[id]` do not look up the store (no official/TPOC email). |
| **PSC-03** | Fixed. Server `normalizeAnswers` + `validate.ts` (`firstIncompleteGap`): field allowlist, types, lengths, enums, email/UEI/CAGE, `consent === true`, reject extra keys and array-as-object. 64 KiB body cap. |
| **PSC-04** | Fixed (dates route). ISO `YYYY-MM-DD`, calendar-valid, note max 500, path id format. |
| **PSC-05** | Fixed. CSP (`frame-ancestors 'none'`), HSTS, `X-Frame-Options`, `Referrer-Policy: no-referrer`, `nosniff`, `Permissions-Policy` via `next.config.ts` and middleware (OpenNext). Residual: `'unsafe-inline'` / `'unsafe-eval'` — see `docs/security/owasp-track-b.md`. |
| **PSC-06** | Fixed. `Cache-Control: no-store, private` on PII JSON/pages, submission APIs, and **all** `POST /api/submit` responses including errors. |
| **PSC-07** | Fixed (cheap). In-memory rate limit on `POST /api/submit` and store cap (250). |
| **PSC-11** | Fixed (cheap). Empty key fails closed unless Host is loopback. |
| PSC-08–10, PSC-12–16 | Not in this PR. |

---

## Executive summary (historical — revision `0409fce`, 2026-09-03)

> **Superseded in part.** PSC-01, PSC-02, PSC-03, PSC-04, PSC-05, PSC-06, PSC-07 and PSC-11 were fixed after this
> summary was written. In particular: `?key=` is no longer accepted, `POST /api/submit` now validates server-side,
> and ids are `crypto.randomUUID()`. The present-tense statements below describe `0409fce`, not current `main`.

This app is a **public, unauthenticated intake** with a **shared-secret gate** in front of assessor chrome and submission APIs. That design can be acceptable for a local demo. On any network-reachable host it is not: **knowing or guessing a submission id is enough to read customer-facing PII**, and **knowing the assessor key (including via `?key=` in the URL) is enough to list and dump every intake**.

The largest *code* gap called out in review — **input validation** — is confirmed. Client-side `validate.ts` is thorough. `POST /api/submit` does not reuse it. The server accepts almost any JSON object with two truthy consents and a non-empty org name plus email. There are **no server-side length limits, enum allowlists, email/UEI/CAGE format checks, or field allowlists**.

Assessor HTML is mostly React text (good — not `dangerouslySetInnerHTML`). Brand/logo path traversal is already allowlisted and tested. No SQL, shell, or user-controlled SSRF was found. No secrets are committed. Box remains disconnected.

**Do not treat this as production-ready for real OSC PII until AuthZ, identifiers, and server-side validation are fixed.**

Counts as assessed on 2026-09-03. The Status column reflects current `main`.

| Severity | Count | IDs | Status on current `main` |
| --- | --- | --- | --- |
| Critical | 0 | — | — |
| High | 3 | PSC-01, PSC-02, PSC-03 | All fixed |
| Medium | 4 | PSC-04, PSC-05, PSC-06, PSC-07 | All fixed (PSC-05 has a documented CSP residual) |
| Low | 5 | PSC-08, PSC-09, PSC-10, PSC-11, PSC-12 | PSC-11 fixed; PSC-08, PSC-09, PSC-10, PSC-12 open |
| Info | 4 | PSC-13, PSC-14, PSC-15, PSC-16 | Informational; no change |

Critical was reserved for unauthenticated bulk dump of all intakes or a live CUI/Box token leak. Neither is present **if** `PSC_ASSESSOR_KEY` is set and `NODE_ENV=production`.

---

## Trust boundaries (verified)

| Surface | Who | Gate | Looks up store by id |
| --- | --- | --- | --- |
| `/`, `/intake` | Public OSC | None | No |
| `POST /api/submit` | Public OSC | None (intended) | Writes store |
| `/success` | Public OSC | None | No (sessionStorage only) |
| `/success/[id]` | Anyone with id | **None** | **Yes** — first name |
| `/drop/[id]/customer` | Anyone with id | **None** | **Yes** — email, org/folder names, file list |
| `/drop/[id]/internal` | Assessor | `PSC_ASSESSOR_KEY` | Yes — 00 Internal markdown |
| `/assessor`, `/assessor/[id]` | Assessor | `PSC_ASSESSOR_KEY` | Yes — full record in HTML |
| `GET /api/submissions` | Assessor | `PSC_ASSESSOR_KEY` | Lists all rows |
| `GET /api/submissions/[id]` | Assessor | `PSC_ASSESSOR_KEY` | **Full `Submission` JSON** |
| `GET /api/submissions/[id]/answers` | Assessor (linked from public drop) | `PSC_ASSESSOR_KEY` | Answers markdown download |
| `POST`/`PATCH` `.../dates` | Assessor | `PSC_ASSESSOR_KEY` | Mutates `preferredDates` |
| `GET /api/brand/logo` | Public | None | No (disk pack only) |

Middleware (`src/middleware.ts`) fail-closes assessor routes when the key is unset **and** `NODE_ENV !== "development"`. Local `next dev` is intentionally open.

---

## Confirmed findings

### PSC-01 — Shared assessor secret in the query string; one key lists and dumps every intake

| | |
| --- | --- |
| **Severity** | High |
| **OWASP 2021** | A01 Broken Access Control; A07 Identification and Authentication Failures |
| **OWASP 2025** | Broken Access Control; Authentication Failures |
| **CWE / SANS** | CWE-306 (missing authentication), CWE-639 (user-controlled key), CWE-598 (sensitive data in query string), CWE-208 (timing-unsafe compare) |
| **ASVS** | V4.1.1, V4.2.1, V2.2.1 (no real authenticator), V3.2 (no session) |

**Evidence**

```13:37:src/middleware.ts
const INTERNAL = [
  /^\/assessor(?:\/|$)/,
  /^\/drop\/[^/]+\/internal(?:\/|$)/,
  /^\/api\/submissions(?:\/|$)/,
];
// ...
  const provided =
    req.headers.get("x-prescope-assessor-key")?.trim() ||
    req.nextUrl.searchParams.get("key")?.trim() ||
    "";

  return provided === key ? NextResponse.next() : notFound();
```

`.env.example` documents `/assessor?key=<this value>`. `GET /api/submissions/[id]` returns the entire `Submission` object (answers, both emails, `internalMarkdown`, fingerprint):

```11:13:src/app/api/submissions/[id]/route.ts
  const s = getSubmission(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(s);
```

Assessor chrome links (`AssessorShell`, list/detail) do **not** propagate `?key=`. After the first keyed hit, in-app navigation 404s unless the operator pastes the key again. That is a usability bug; the security issue is the opposite: the secret is a URL.

**Impact**

- One static secret is authorization for **every** intake, not per-record, per-role, or per-assessor.
- Query-string secrets appear in browser history, Referer, access logs, screenshots, and shared links.
- `===` comparison is not constant-time (secondary).
- No audit trail of who listed or exported PII.

**Remediation (safe)**

- Stop accepting `?key=`. Header or HttpOnly `Secure; SameSite=Strict` cookie only.
- Replace the shared secret with real assessor auth (IdP / passkeys / magic-link to a named mailbox). Scope tokens per submission if OSC-facing links must exist.
- Compare secrets with a constant-time helper.
- Return a DTO from `GET /api/submissions/[id]`, not the raw store object (drop `fingerprint`, internal-only fields unless the caller is assessor-authorized).
- Do not log the key or the full answers body.

---

### PSC-02 — IDOR on public customer drop and thank-you; identifiers are not capability-grade

| | |
| --- | --- |
| **Severity** | High |
| **OWASP 2021 / 2025** | A01 Broken Access Control |
| **CWE / SANS** | CWE-639, CWE-330 / CWE-338 (weak PRNG), CWE-862 (missing authorization) |
| **ASVS** | V4.1.3, V4.2.1, V2.9 (insufficient entropy for capability URLs) |

**Evidence**

Ids are `osc_` plus 12 base-36 characters from `Math.random()`, not `crypto.randomUUID()` / `crypto.getRandomValues()`:

```8:18:src/lib/orchestrate.ts
function idPart(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function processSubmission(raw: FormAnswers): Submission {
  const answers: FormAnswers = {
    ...raw,
    employees_total: (raw.employees_total || raw.employees || "").trim(),
    evidence_share: "Box",
  };
  const id = `osc_${idPart()}${idPart()}`.slice(0, 16);
```

`/drop/[id]/customer` is **not** in the middleware deny list. It loads the submission and renders the Assessment Official / TPOC email and folder names:

```11:27:src/app/drop/[id]/customer/page.tsx
export default async function CustomerDropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getSubmission(id);
  if (!s) notFound();
  // ...
        <p className="text-xs text-white">Editor · {contactEmail(s.answers)}</p>
```

`/success/[id]` also looks up the store and prints the contact first name (PII confirmation that the id exists):

```11:16:src/app/success/[id]/page.tsx
  const { id } = await params;
  const s = getSubmission(id);
  if (!s) notFound();
  const brand = loadBrand();
  const first = contactName(s.answers).split(" ")[0] || "there";
```

The customer drop links “01 Answers” to `GET /api/submissions/{id}/answers`, which **is** key-gated. An OSC who only has the drop URL cannot download their markdown when the key is set. The page still discloses email and org identity.

**Impact**

- Authorization is “know the id.” Ids are returned in `POST /api/submit`, embedded in simulated emails, and appear in `/drop/{id}/customer` and `/success/{id}`.
- `Math.random()` is not a CSPRNG. Combined with a short, prefixed, fixed-shape token, ids are a poor capability secret (ASVS treats unguessable tokens as authenticators).
- Anyone who sees a thank-you or drop URL (email forward, ticket, screen share) can reopen the customer drop and read the email address.
- Existence oracle: valid ids return 200 + name; unknown ids 404.

**Remediation (safe)**

- Generate ids with `crypto.randomUUID()` (or a 128+ bit unguessable token). Do not prefix a guessable scheme if the id is the only secret.
- Treat customer drop / success-by-id as capability URLs: high entropy, single-purpose, optional expiry, not the same id used in assessor chrome.
- Or stop server lookups on public pages (the stateless `/success` path already does this).
- Do not put official email on an unauthenticated page. Confirm identity with a one-time link to the submitted mailbox if a drop must be public.
- Validate path `id` against an allowlist (`^osc_[a-z0-9]{12}$` today; UUID later). Reject everything else with 404.

---

### PSC-03 — `POST /api/submit` does not validate types, lengths, enums, or field allowlists

| | |
| --- | --- |
| **Severity** | High (validation gap; primary ask) |
| **OWASP 2021** | A03 Injection; A04 Insecure Design |
| **OWASP 2025** | Injection; Insecure Design |
| **CWE / SANS** | **CWE-20** (improper input validation) — Top 25; CWE-1287 (improper validation of specified type); CWE-770 (unbounded allocation) |
| **ASVS** | V5.1.1–V5.1.4, V5.2.1–V5.2.3, V13.2.2 |

**Evidence**

Client `src/lib/validate.ts` enforces required fields, a weak email regex, and step logic. It is imported by `IntakeForm` only.

Server submit checks JSON parse, `answers` is a non-null object, two consents are truthy, and `orgName` / `contactEmail` are non-empty. It then stores the object:

```28:64:src/app/api/submit/route.ts
export async function POST(req: Request) {
  let body: { answers?: FormAnswers };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const answers = body.answers;
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Missing answers" }, { status: 400 });
  }
  answers.evidence_share = "Box";
  if (!answers.consent_nocui || !answers.consent_notassessment) {
    // ...
  }
  if (!orgName(answers) || !contactEmail(answers)) {
    // ...
  }
  // ...
  const submission = await applyBoxHandoff(processSubmission(answers));
  putSubmission(submission, fingerprint);
```

`processSubmission` spreads the client object (`{ ...raw }`). Extra keys, wrong types, oversized strings, and non-enum values are persisted and later rendered into markdown and assessor HTML.

`typeof answers !== "object"` is true for **arrays**. Consents accept any truthy value, not `=== true`. Email is not checked server-side (`contactEmail` is only `.trim()`). UEI, CAGE, phones, and all enums (`SCOPE_MODES`, `YES_NO_*`, `CUI_LOCATIONS`, …) are unchecked. `sps` has no max length or per-row schema. Free-text fields have no max length.

Fingerprint is `JSON.stringify(answers)` stored as a second `Map` key — a second copy of the payload.

**Impact**

- Browser validation is bypassed by any direct POST (ASVS: validate on the server).
- Stored answers can be arbitrary size → process memory exhaustion (in-memory `Map`).
- Extra keys ride into `GET /api/submissions/[id]` and markdown (`String(x)` on unknown values).
- Enum bypass produces misleading assessor summaries (`runScope` / `answersMarkdown` trust the strings).
- Weak or missing email checks allow junk or header-like strings into simulated email `to:` fields (harmful if a later mailer is wired without sanitizing).

**Remediation (safe)**

- Build a server `normalizeAnswers(unknown): FormAnswers | 400` that:
  - Starts from `emptyAnswers()`.
  - Copies **allowlisted keys only**.
  - Coerces booleans with `=== true`.
  - Allowlists every enum via `src/lib/choices.ts`.
  - Caps string lengths (e.g. 200 for names/ids, 20 for UEI/CAGE, 254 for email, 2–4k for notes).
  - Caps `sps` (e.g. 20) and uses `normalizeProvider`.
  - Rejects arrays for `answers`, unknown keys (or drops them), and non-strings where a string is required.
- Re-run `firstIncompleteGap` / `validateStep` on the normalized object before persist.
- Enforce email with a tighter pattern (or reject if `includes("\n")` / `includes(",")`).
- Cap JSON body size (Next `experimental.middlewareClientMaxBodySize` or an explicit byte check).
- Do not use the raw client object as the fingerprint key.

---

### PSC-04 — Dates mutation: weak field validation (gated, still a contract gap)

| | |
| --- | --- |
| **Severity** | Medium |
| **OWASP** | A03 / Injection; A04 Insecure Design (2021/2025) |
| **CWE** | CWE-20 |
| **ASVS** | V5.1.2, V13.2.2 |

**Evidence**

```6:38:src/app/api/submissions/[id]/dates/route.ts
function asDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const v = item.trim();
    if (!v) continue;
    out.push(v);
    if (out.length >= 3) break;
  }
  return out;
}
// ...
  const note = typeof body.note === "string" ? body.note.trim() : "";
```

Route is under `/api/submissions`, so the assessor key applies. `PreferredDatesForm` is **not imported** by any page (dead UI). README still describes preferred dates on `/success/[id]`.

**Impact**

- Any string (not ISO `YYYY-MM-DD`) is stored; `note` is unbounded.
- If a later change mounts the form on a public success page **without** sending the assessor key, the POST will 404 in production (broken UX) or, if the gate is relaxed, become an unauthenticated write (IDOR). Do not un-gate this route.

**Remediation (safe)**

- Allowlist `^\d{4}-\d{2}-\d{2}$`, calendar-valid dates, and `note` max length (e.g. 500).
- Validate path `id` format.
- Keep the assessor gate. If OSC must set dates, use a separate capability token, not this API as-is.
- Delete or wire `PreferredDatesForm` so docs match code.

---

### PSC-05 — Missing security headers; no CSP / frame controls

| | |
| --- | --- |
| **Severity** | Medium |
| **OWASP 2021 / 2025** | A05 Security Misconfiguration |
| **CWE** | CWE-693 (protection mechanism failure), CWE-1021 (clickjacking) |
| **ASVS** | V14.4.1–V14.4.3, V14.5.4 |

**Evidence**

`next.config.ts` only sets `reactStrictMode`. No `headers()`, no CSP, no `X-Frame-Options` / `frame-ancestors`, no `X-Content-Type-Options`, no `Referrer-Policy`, no HSTS. Root layout has no `<meta http-equiv>` fallbacks.

**Impact**

- Public intake can be framed (clickjacking / UI redress on consents).
- Assessor `?key=` leaks via Referer to any later cross-origin navigation.
- Missing `nosniff` on downloads and logo.

**Remediation (safe)**

In `next.config.ts` `headers()` (or the hosting layer):

- `Content-Security-Policy`: default-src `'self'`; script-src `'self'` (adjust for Next inline if needed); `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer` (or `same-origin`) — required while `?key=` exists
- `Permissions-Policy` disable camera/mic/geolocation
- HSTS only on the real HTTPS hostname

---

### PSC-06 — Answers download and submission JSON lack `Cache-Control: no-store`

| | |
| --- | --- |
| **Severity** | Medium |
| **OWASP** | A01; A04 (2021/2025) |
| **CWE** | CWE-524 (cache), CWE-539 (persistent cookies/cache — shared proxy) |
| **ASVS** | V8.1.1, V8.2.1, V14.4.5 |

**Evidence**

Pages and APIs set `dynamic = "force-dynamic"` (helps Next skip static generation). `GET /api/brand/logo` sets `Cache-Control: no-store`. `GET /api/submissions/[id]/answers` and `GET /api/submissions/[id]` do not. Filename is taken from store data (sanitized for quotes/CRLF only).

If an operator fetches answers with `?key=` on the URL, a shared cache or browser disk cache may retain the markdown **and** the secret.

**Remediation (safe)**

- `Cache-Control: no-store, private` and `Pragma: no-cache` on every submission, answers, dates, and assessor HTML response.
- Never put the assessor key in GET URLs (see PSC-01).

---

### PSC-07 — Unauthenticated submit has no rate limit or anti-automation

| | |
| --- | --- |
| **Severity** | Medium |
| **OWASP** | A04 Insecure Design (2021/2025) |
| **CWE** | CWE-770, CWE-307 |
| **ASVS** | V13.2.3, V4.2.2 (abuse of public API) |

**Evidence**

Dedupe is a 60s exact-fingerprint lock only (`DEDUPE_WINDOW_MS`). There is no IP / token bucket, no CAPTCHA, no max store size. Each accepted POST adds a `Submission` plus a fingerprint string to `globalThis` maps.

**Impact**

A noisy client can fill process memory and drown the assessor list with junk orgs (availability and integrity of the console). Not a confidentiality break by itself.

**Remediation (safe)**

- Cap store size and reject with 429/503.
- Rate-limit `/api/submit` at the edge (and locally in middleware).
- Optional proof-of-work or hosted CAPTCHA if this is internet-facing.

---

### PSC-08 — CSRF: no Origin/Referer check on state-changing POSTs

| | |
| --- | --- |
| **Severity** | Low |
| **OWASP 2021 / 2025** | A01 (CSRF is access control) |
| **CWE** | CWE-352 (Top 25) |
| **ASVS** | V4.2.2, V13.2.3 |

**Evidence**

No CSRF token, no Origin allowlist. Cookies are not used for the assessor gate (header or query). Cross-site `fetch` of `application/json` typically triggers a CORS preflight; this app does not send `Access-Control-Allow-Origin`, so a **browser** cross-origin JSON POST should fail. A simple HTML form cannot easily POST JSON.

**Impact**

Residual: non-browser clients and future cookie-based auth. Today CSRF is not the main write path; **unauthenticated submit (PSC-03/07)** is.

**Remediation (safe)**

- If cookies are introduced: `SameSite=Strict`, CSRF token or double-submit, reject mismatched `Origin`.
- Even without cookies, reject `POST /api/submit` when `Origin` is present and not same-host (defense in depth).

---

### PSC-09 — Stored content injection into assessor markdown (script XSS not confirmed)

| | |
| --- | --- |
| **Severity** | Low |
| **OWASP** | A03 Injection (2021/2025) |
| **CWE** | CWE-79 (Top 25) — **mitigated for HTML/JS**; residual markdown/UI spoof |
| **ASVS** | V5.2.1, V5.3.3 |

**Evidence**

`src/lib/markdown.tsx` builds React text/`<strong>`/`<em>` — no `dangerouslySetInnerHTML`. Assessor detail and 00 Internal render `internalMarkdown`, which interpolates org name, UEI, CAGE, emails, and scope strings (`src/lib/docs.ts`). React encodes HTML.

User strings that contain `|`, `#`, or `**` can break tables or add headings in the assessor brief (integrity / social-engineering of the assessor, not browser script exec). `answersMarkdown` is offered as a file download (`text/markdown`), not inlined on the customer drop.

**Remediation (safe)**

- Escape `|`, backticks, and leading `#` when interpolating into markdown tables.
- Keep rendering in React (do not switch to `dangerouslySetInnerHTML` or a raw HTML markdown library without a sanitizer).
- Field length limits (PSC-03) reduce blast radius.

---

### PSC-10 — Client trusts `json.redirect` from submit (today hardcoded)

| | |
| --- | --- |
| **Severity** | Low |
| **OWASP** | A01 (open redirect) |
| **CWE** | CWE-601 |
| **ASVS** | V5.1.5 |

**Evidence**

Server always returns `redirect: "/success"`. Client does `router.push(json.redirect || "/success")` (`IntakeForm.tsx`). `NEXT_PUBLIC_PUBLIC_SITE_URL` is used as the Exit `Link` href without an allowlist (operator-controlled env).

**Impact**

No user-controlled redirect today. A future “redirect to Box” that copies `PSC_BOX_CUSTOMER_LINK` or a client field into `redirect` would become an open redirect. Env `publicSiteUrl` can already point Exit off-site if mis-set.

**Remediation (safe)**

- Client: allowlist `json.redirect` to `/success` only (ignore anything else).
- Allowlist `publicSiteUrl` to relative paths or `https:` hosts you own.

---

### PSC-11 — Development fail-open and `NODE_ENV` footgun

| | |
| --- | --- |
| **Severity** | Low (config) |
| **OWASP** | A05 Security Misconfiguration |
| **CWE** | CWE-1188 (insecure default initialization) |
| **ASVS** | V14.1.3, V14.2.1 |

**Evidence**

```26:28:src/middleware.ts
  if (!key) {
    return process.env.NODE_ENV === "development" ? NextResponse.next() : notFound();
  }
```

`npm run dev` binds `127.0.0.1:43127` (good). If `next dev` is started on `0.0.0.0`, or `NODE_ENV` is wrong on a shared host, **assessor routes and `/api/submissions` are public**.

**Remediation (safe)**

- Require `PSC_ASSESSOR_KEY` whenever `HOST !== 127.0.0.1` (or always, even in dev).
- Fail closed if the key is empty, regardless of `NODE_ENV`.

---

### PSC-12 — PII collected vs “no CUI / no CUID / no SPRS” disclaimer

| | |
| --- | --- |
| **Severity** | Low (policy / minimization) |
| **OWASP** | A04 Insecure Design; A09 Logging (2021) / Security Logging (2025) |
| **CWE** | CWE-359 (privacy), CWE-201 (insertion of sensitive information) |
| **ASVS** | V8.3.4, V9 (communications — N/A until mailer exists) |

**Evidence**

Welcome cards and the gold banner say no CUI, hostnames, paths, or IPs. Consents require the OSC to attest. `validate.ts` / copy repeat “not a CUID / not SPRS.”

The form still collects: HQ/OSC names, UEI, CAGE, city/state, Assessment Official and TPOC **names, titles, emails, phones**, provider names and POC emails, CUI *location classes*, MFA product name, optional site names.

Server does not enforce minimization: type fields `address1`, `address2`, `zip`, `website`, `employees`, `cui_flow`, `poam_notes`, etc. are accepted if a client sends them (`emptyAnswers` + spread).

No application audit log of who read an intake. Store is process memory (see residual).

**Impact**

This is **CUI-adjacent PII and CMMC scoping data**, not CUI, if the OSC follows the banner. A pasted SPRS score, CUID, or CUI snippet would be stored and shown to assessors with no server-side detection (detection is out of scope and easy to get wrong; do not build a CUI classifier here).

**Remediation (safe)**

- Server allowlist = fields the UI actually asks (PSC-03). Drop unused address/website keys or collect them only if product requires.
- Keep the banner and consents (already present).
- Retention: TTL on the `Map`; wipe on process restart is not a control.
- When a real mailbox exists: send the OSC copy only to the submitted Official email after format check; never BCC a public list.

---

### PSC-13 — Brand / logo path serving (positive control; residual SVG)

| | |
| --- | --- |
| **Severity** | Info |
| **OWASP** | A01 / A03 (path traversal — **not confirmed**) |
| **CWE** | CWE-22 (Top 25) — mitigated; CWE-79 residual for operator-supplied SVG |

**Evidence**

`selectedBrandId` and `safeLogoFilename` reject `../`, slashes, and spaces. Tests in `src/lib/brand.test.ts` cover traversal. `readOverlayLogo` joins `org-logos|brands` + allowlisted id + allowlisted filename. `GET /api/brand/logo` is not user-path-parameterized.

**Residual:** an operator-placed `.svg` is served as `image/svg+xml`. `<img>` does not execute script; opening the API URL as a document might. Prefer PNG for packs, or serve SVG with `Content-Disposition: attachment` / sanitized subset.

No customer logos are committed (`.gitignore` + READMEs). Do not change that.

---

### PSC-14 — Secrets in repo and env examples

| | |
| --- | --- |
| **Severity** | Info (pass) |
| **OWASP** | A02 Cryptographic Failures / A05 |
| **CWE** | CWE-798 (hard-coded credentials) — **not found** |

`.env` / `.env.local` are gitignored. `.env.example` and `.env.local.example` have empty `PSC_ASSESSOR_KEY`, `PSC_BOX_*`. `src/lib/box.ts` reads tokens from env only and does not echo them to the OSC payload. `NEXT_PUBLIC_*` values are branding, not secrets (mailbox is an example.com address). No `AKIA` / PEM / live tokens in source.

**Residual:** `BOX_ACCESS_TOKEN` as an alias is easy to confuse with a long-lived user token. When Box is connected, use a scoped, rotatable app token and never put it in `NEXT_PUBLIC_*`.

---

### PSC-15 — Injection classes not found (SQL, OS command, SSRF, unsafe eval)

| | |
| --- | --- |
| **Severity** | Info (pass) |
| **OWASP** | A03 / A10 SSRF |
| **CWE** | CWE-89, CWE-78, CWE-918, CWE-94, CWE-1321 |

No database, no `child_process`, no `eval`. Box upload URL is a string literal (`https://upload.box.com/api/2.0/files/content`). Folder ids come from env, not the OSC. Client `router.push` is not fed query params from the URL.

JSON.parse of `answers` plus `{ ...raw }` is not classic prototype pollution in current Node (JSON `__proto__` is an own key). Still copy via allowlist (PSC-03) so unexpected keys never persist.

---

### PSC-16 — CORS

| | |
| --- | --- |
| **Severity** | Info (pass, keep it that way) |

No `Access-Control-Allow-Origin` on APIs. Browser cross-origin reads of `/api/submissions` should fail. Do not add `*` CORS if a SPA is split later without an allowlist.

---

## Residual risk / out of scope

These are **not** scored as product defects of the current GitHub demo; they become defects if the host or integrations change.

| Topic | Why residual |
| --- | --- |
| **In-memory `Map` on `globalThis`** | Lost on restart; not shared across serverless instances; any process memory dump is a full PII breach; documented in README. Not a substitute for encryption at rest or tenant isolation. |
| **Box not connected** | `applyBoxHandoff` is skipped without token + folder id. No live shared-link or CUI library access was reviewed. Connecting Box without re-reviewing folder ACLs (00 Internal vs 01/02) is a new engagement. |
| **Simulated email** | No SMTP. When added, treat `customerEmail.to` as attacker-controlled (header injection). |
| **No OSC login** | Product choice. Then **capability URLs must be unguessable** (PSC-02) or there is no AuthZ. |
| **CUI / CUID / SPRS** | Policy + consent only. Free text can still hold prohibited content. Do not invent CUI to test this. |
| **Power Pages / Dataverse / maker-kit docs** | Separate host. Not this Next app’s runtime. |
| **Supply chain** | `package-lock.json` not fully audited; Next 15.4.x — apply upstream advisories as usual. |
| **Multi-assessor / legal hold** | No identities, no retention, no legal-hold flag. |

---

## Input validation matrix (every write/read)

| Input | Validated today | Gap |
| --- | --- | --- |
| `POST /api/submit` body JSON | Parse only | No schema (PSC-03) |
| `answers` object | Non-null object (arrays pass) | Allowlist + types |
| `consent_*` | Truthy | Require `=== true` |
| `oscname` / `hqname` / emails | Non-empty trim | Format, length, charset |
| All other `FormAnswers` fields | **None on server** | Enums, lengths, `sps` cap |
| Path `id` (all `[id]` routes) | Map lookup only | Format allowlist |
| `dates[]` | String, max 3, non-empty | ISO date + range |
| `note` | Type string, trim | Max length |
| Query `key` | Equality to env | Do not use query (PSC-01) |
| Header `x-prescope-assessor-key` | Equality | Constant-time |
| `BRAND` / logo filename | Allowlist + tests | Keep; SVG policy (PSC-13) |
| Query params on public pages | Unused for answers | n/a |

---

## Suggested fix order (architect)

1. **AuthZ model:** real assessor auth; kill `?key=`; unguessable or mailbox-bound customer links (PSC-01, PSC-02).  
2. **Server `normalizeAnswers` + reuse `validate.ts` + body/store caps** (PSC-03, PSC-07).  
3. **Headers + `no-store` on PII responses** (PSC-05, PSC-06).  
4. **Dates schema** if the form is kept (PSC-04).  
5. **Markdown interpolation escaping** (PSC-09).  
6. Fail-closed key in all environments (PSC-11).

No production code was changed in this review. Prefer tests around `normalizeAnswers` and middleware (header-only key, reject query key, reject empty key outside loopback) when you implement.

---

## References (internal)

- `src/middleware.ts` — assessor gate  
- `src/app/api/submit/route.ts`, `src/app/api/submissions/**`  
- `src/lib/validate.ts` (client-only today)  
- `src/lib/store.ts`, `src/lib/orchestrate.ts`  
- `src/lib/brand.ts`, `src/lib/load-brand.ts`  
- `.env.example`, `.gitignore`, `org-logos/README.md`
