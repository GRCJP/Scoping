# Assessor gated surfaces — soft touch

One unauthenticated request each. No key guessing, no brute-force.

| Method | URL | Status | Body snippet |
| --- | --- | --- | --- |
| GET | `https://prescope-intake.example.workers.dev/assessor` | 307 | `` |
| GET | `https://prescope-intake.example.workers.dev/assessor/login` | 200 | `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-s` |
| GET | `https://prescope-intake.example.workers.dev/api/assessor/emass` | 404 | `{"error":"Not found"}` |
| GET | `https://prescope-intake.example.workers.dev/api/submissions` | 404 | `{"error":"Not found"}` |
| POST | `https://prescope-intake.example.workers.dev/api/assessor/session` | 401 | `{"error":"Invalid key."}` |

Expected (Track B hardening): HTML `/assessor` → 307 `/assessor/login`;
`POST /api/assessor/session` with an empty body → **401**; other `/api/assessor/*` and `/api/submissions` → **404**.

