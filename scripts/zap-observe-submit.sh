#!/usr/bin/env bash
# HEADER / TLS / CORS observation only for the authorized submit Worker.
# Does not guess secrets, does not POST authenticated attack payloads,
# and does not flood the Worker.
set -euo pipefail

SUBMIT_ORIGIN="${SUBMIT_ORIGIN:-https://prescope-submit.example.workers.dev}"
OUT_DIR="${ZAP_OUT_DIR:-docs/security/zap}"
mkdir -p "$OUT_DIR"

OUT_JSON="$OUT_DIR/submit-observe.json"
OUT_MD="$OUT_DIR/submit-observe.md"
HOST="${SUBMIT_ORIGIN#https://}"
HOST="${HOST#http://}"
HOST="${HOST%%/*}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fetch() {
  local name="$1" method="$2" url="$3"
  shift 3
  local hdr="$tmp/$name.hdr" body="$tmp/$name.body"
  local code
  code="$(curl -sS -D "$hdr" -o "$body" -w '%{http_code}' -X "$method" "$url" "$@")"
  printf '%s\t%s\t%s\t%s\n' "$name" "$method" "$url" "$code"
}

{
  fetch root GET "$SUBMIT_ORIGIN/"
  fetch health GET "$SUBMIT_ORIGIN/health"
  fetch options_submit OPTIONS "$SUBMIT_ORIGIN/submit" \
    -H "Origin: https://prescope-intake.example.workers.dev" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: authorization,content-type"
  fetch options_cross OPTIONS "$SUBMIT_ORIGIN/submit" \
    -H "Origin: https://evil.example" \
    -H "Access-Control-Request-Method: POST"
  fetch get_submit GET "$SUBMIT_ORIGIN/submit"
} > "$tmp/fetches.txt"

tls_brief="$(echo | openssl s_client -servername "$HOST" -connect "$HOST:443" -brief 2>&1 || true)"
tls_cert="$(echo | openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null | openssl x509 -noout -issuer -subject -dates -ext subjectAltName 2>/dev/null || true)"

python3 - "$OUT_JSON" "$OUT_MD" "$SUBMIT_ORIGIN" "$tmp" <<'PY'
import json, pathlib, re, sys
from datetime import datetime, timezone

out_json, out_md, origin, tmp = sys.argv[1:5]
tmp = pathlib.Path(tmp)

def parse_headers(text: str) -> dict[str, str]:
    lines = text.splitlines()
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if not line.strip():
            break
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        key = k.strip().lower()
        val = v.strip()
        headers[key] = f"{headers[key]}, {val}" if key in headers else val
    return headers

def load(name: str) -> dict:
    hdr = (tmp / f"{name}.hdr").read_text(errors="replace")
    body = (tmp / f"{name}.body").read_text(errors="replace")
    status_line = hdr.splitlines()[0] if hdr.strip() else ""
    m = re.search(r"\s(\d{3})\s", status_line)
    return {
        "status_line": status_line.strip(),
        "status": int(m.group(1)) if m else None,
        "headers": parse_headers(hdr),
        "body": body[:400],
    }

fetches = {}
for line in (tmp / "fetches.txt").read_text().splitlines():
    name, method, url, code = line.split("\t")
    fetches[name] = {"method": method, "url": url, "curl_http_code": int(code), **load(name)}

interesting = [
    "strict-transport-security",
    "content-security-policy",
    "access-control-allow-origin",
    "access-control-allow-headers",
    "access-control-allow-methods",
    "access-control-allow-credentials",
    "cache-control",
    "pragma",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "content-type",
    "server",
]

def pick(headers: dict[str, str]) -> dict[str, str | None]:
    return {k: headers.get(k) for k in interesting}

health = fetches["health"]
options = fetches["options_submit"]
options_cross = fetches["options_cross"]
tls_brief = pathlib.Path(tmp).joinpath("tls.brief")  # filled below by caller via env files

doc = {
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "scope": "HEADER/TLS/CORS observation only. No secret guessing. No authenticated POST flood.",
    "origin": origin,
    "fetches": {
        name: {
            "method": row["method"],
            "url": row["url"],
            "status": row["status"],
            "headers_of_interest": pick(row["headers"]),
            "body_snippet": row["body"],
        }
        for name, row in fetches.items()
    },
}

# TLS files written by the shell after this? We'll read sibling names if present.
for fname, key in (("tls.brief", "tls_brief"), ("tls.cert", "tls_cert")):
    p = tmp / fname
    if p.exists():
        doc[key] = p.read_text(errors="replace").strip()

pathlib.Path(out_json).write_text(json.dumps(doc, indent=2) + "\n")

cors = options["headers"]
lines = [
    "# Submit Worker — HEADER / TLS / CORS observation",
    "",
    f"Generated: `{doc['generated_at']}`",
    f"Origin: `{origin}`",
    "",
    "Observation only. No `Authorization` probe, no secret brute-force, one request per path below.",
    "",
    "| Probe | Method | Status | Notes |",
    "| --- | --- | --- | --- |",
]
notes = {
    "root": "Unauthenticated health-shaped GET `/`.",
    "health": "Documented unauthenticated `GET /health`.",
    "options_submit": "CORS preflight from the intake origin. Look for missing `Access-Control-Allow-*`.",
    "options_cross": "CORS preflight from an unrelated origin. Must not reflect `*`.",
    "get_submit": "GET `/submit` (POST-only route). Expect 404, not a write.",
}
for name, row in fetches.items():
    acao = row["headers"].get("access-control-allow-origin") or "absent"
    lines.append(
        f"| `{row['url']}` | {row['method']} | {row['status']} | {notes.get(name, '')} ACAO: `{acao}` |"
    )

hsts = health["headers"].get("strict-transport-security") or "absent"
csp = health["headers"].get("content-security-policy") or "absent"
lines += [
    "",
    "## Headers of interest (`GET /health`)",
    "",
    f"- `Strict-Transport-Security`: `{hsts}`",
    f"- `Content-Security-Policy`: `{csp}`",
    f"- `Cache-Control`: `{health['headers'].get('cache-control', 'absent')}`",
    f"- `X-Content-Type-Options`: `{health['headers'].get('x-content-type-options', 'absent')}`",
    f"- `X-Frame-Options`: `{health['headers'].get('x-frame-options', 'absent')}`",
    f"- `Referrer-Policy`: `{health['headers'].get('referrer-policy', 'absent')}`",
    "",
    "Cloudflare may omit custom HSTS on `*.workers.dev` (shared parent). Treat a missing HSTS header there as a platform residual unless a custom domain is attached.",
    "",
    "Machine-readable copy: `submit-observe.json`.",
    "",
]
pathlib.Path(out_md).write_text("\n".join(lines))
print(f"wrote {out_json}")
print(f"wrote {out_md}")
PY

# Attach TLS after the first python pass, then rewrite JSON with TLS.
printf '%s\n' "$tls_brief" > "$tmp/tls.brief"
printf '%s\n' "$tls_cert" > "$tmp/tls.cert"
python3 - "$OUT_JSON" "$tmp/tls.brief" "$tmp/tls.cert" <<'PY'
import json, pathlib, sys
p, brief, cert = map(pathlib.Path, sys.argv[1:4])
doc = json.loads(p.read_text())
doc["tls_brief"] = brief.read_text(errors="replace").strip()
doc["tls_cert"] = cert.read_text(errors="replace").strip()
p.write_text(json.dumps(doc, indent=2) + "\n")
print("updated TLS fields in", p)
PY

# Append TLS to markdown
{
  echo "## TLS"
  echo
  echo '```'
  echo "$tls_brief"
  echo
  echo "$tls_cert"
  echo '```'
} >> "$OUT_MD"

echo "Submit observation complete (no authenticated POST)."
