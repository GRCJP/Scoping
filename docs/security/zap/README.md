# OWASP ZAP — Scoping Track B (authorized DAST)

Live baseline scan of the operator's Cloudflare intake. **Spider + passive only.** No active scan, no exploit PoCs, no submit/assessor secret guessing.

Architect (Dave) gates remediations. Do not merge scan noise into product changes from this folder alone.

## In scope

| Surface | What we do |
| --- | --- |
| `https://prescope-intake.example.workers.dev/intake` and same-origin paths the spider reaches | ZAP Baseline (`zap-baseline.py` or equivalent Automation Framework plan) |
| Same host `/assessor/*`, `/api/assessor/*`, `/api/submissions` | Soft-touch: one unauthenticated request each. Record 307 / 401 / 404. Do not attack. |
| `https://prescope-submit.example.workers.dev` | HEADER / TLS / CORS observation only (`GET /`, `GET /health`, `OPTIONS /submit`). **Do not** POST with guessed `Authorization` values. |

Out of scope: other accounts’ `*.workers.dev` hosts, Box, Power Pages / Track A, active scan (`zap-full-scan.py`), Ajax/modern spider unless you pass `ZAP_LIGHT=1` on a machine that already has the ZAP Docker image.

## Reports in this folder

| File | What it is |
| --- | --- |
| `zap-baseline-report.html` | Full ZAP HTML report |
| `zap-baseline-report.json` | Machine-readable alerts |
| `SUMMARY.md` | High/Medium first, mapped to OWASP Top 10 2021, with evidence snippets and false-positive notes |
| `submit-observe.md` / `.json` | Submit Worker header + TLS + CORS |
| `assessor-soft-touch.md` | Gated-surface status codes |
| `RUN.txt` | Engine used (Docker vs local Java), timestamps, command metadata |
| `zap-baseline-plan.yaml` | Exact Automation Framework plan from the local fallback run |

**This run (2026-09-05):** cloud VM had **no Docker**. Baseline used ZAP 2.17.0 Linux + Java 21. **0 High / 0 Medium.** See `SUMMARY.md`.

## Re-run locally (preferred: Docker)

Needs Docker and network access to the authorized hosts. From the repo root:

```
bash scripts/zap-baseline.sh
```

This pulls `ghcr.io/zaproxy/zaproxy:stable` (or `owasp/zap2docker-stable` if you set `ZAP_IMAGE`) and runs:

```
zap-baseline.py \
  -t https://prescope-intake.example.workers.dev/intake \
  -c .zap/baseline.conf \
  -r zap-baseline-report.html \
  -J zap-baseline-report.json
```

Rate-limit knobs already in the script: 2 spider minutes, 2 threads, `postForm=false` / `processForm=false` so the live intake form is **not** submitted.

Optional extra traditional/modern spider (still no active scan):

```
ZAP_LIGHT=1 bash scripts/zap-baseline.sh
```

Submit observation only:

```
bash scripts/zap-observe-submit.sh
```

## Re-run without Docker

The same script falls back to the official ZAP **2.17.0** Linux package (`zap.sh -cmd -autorun`) when Docker is missing and Java 11+ is present. The tarball is downloaded into gitignored `.zap-runtime/` and is **not** committed.

```
# first run downloads ~233 MB once
bash scripts/zap-baseline.sh
```

Pin override: `ZAP_HOME=/path/to/ZAP_2.17.0`.

## CI

`.github/workflows/zap-baseline.yml` is **`workflow_dispatch` only**. It does not run on push or pull_request (avoids DoS-ing the Workers from every commit). Operator: Actions → *zap-baseline* → Run workflow.

## What this is not

- Not `zap-full-scan.py` / not the ZAP active scanner.
- Not permission to brute-force `PRESCOPE_SUBMIT_SECRET` or `PSC_ASSESSOR_KEY`.
- Not a replacement for the static review in `docs/security/owasp-track-b.md` and `docs/security/owasp-sans-review.md`.
