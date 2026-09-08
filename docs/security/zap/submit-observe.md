# Submit Worker — HEADER / TLS / CORS observation

Generated: `2026-09-05T16:27:09Z`
Origin: `https://prescope-submit.example.workers.dev`

Observation only. No `Authorization` probe, no secret brute-force, one request per path below.

| Probe | Method | Status | Notes |
| --- | --- | --- | --- |
| `https://prescope-submit.example.workers.dev/` | GET | 200 | Unauthenticated health-shaped GET `/`. ACAO: `absent` |
| `https://prescope-submit.example.workers.dev/health` | GET | 200 | Documented unauthenticated `GET /health`. ACAO: `absent` |
| `https://prescope-submit.example.workers.dev/submit` | OPTIONS | 404 | CORS preflight from the intake origin. Look for missing `Access-Control-Allow-*`. ACAO: `absent` |
| `https://prescope-submit.example.workers.dev/submit` | OPTIONS | 404 | CORS preflight from an unrelated origin. Must not reflect `*`. ACAO: `absent` |
| `https://prescope-submit.example.workers.dev/submit` | GET | 404 | GET `/submit` (POST-only route). Expect 404, not a write. ACAO: `absent` |

## Headers of interest (`GET /health`)

- `Strict-Transport-Security`: `absent`
- `Content-Security-Policy`: `absent`
- `Cache-Control`: `no-store, private`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `Referrer-Policy`: `no-referrer`

Cloudflare may omit custom HSTS on `*.workers.dev` (shared parent). Treat a missing HSTS header there as a platform residual unless a custom domain is attached.

Machine-readable copy: `submit-observe.json`.

## TLS

```
CONNECTION ESTABLISHED
Protocol version: TLSv1.3
Ciphersuite: TLS_AES_256_GCM_SHA384
Peer certificate: CN = example.workers.dev
Hash used: SHA256
Signature type: ECDSA
Verification: OK
Server Temp Key: X25519, 253 bits
DONE

issuer=C = US, O = Google Trust Services, CN = WE1
subject=CN = example.workers.dev
notBefore=Sep  4 19:38:59 2026 GMT
notAfter=Dec  3 20:36:16 2026 GMT
X509v3 Subject Alternative Name: 
    DNS:example.workers.dev, DNS:*.example.workers.dev
```
