#!/usr/bin/env bash
# Reproducible OWASP ZAP Baseline against the authorized Scoping Track B intake.
# Preferred: official Docker image. Fallback: local official Linux package (Java 11+).
# Spider + passive only. No active scan, no secret brute-force, no form POST to live submit.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="${ZAP_TARGET:-https://prescope-intake.example.workers.dev/intake}"
OUT_DIR="${ZAP_OUT_DIR:-docs/security/zap}"
ZAP_IMAGE="${ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"
SPIDER_MINS="${ZAP_SPIDER_MINS:-2}"
LIGHT="${ZAP_LIGHT:-0}"
ZAP_RUNTIME="${ZAP_RUNTIME:-$ROOT/.zap-runtime}"
ZAP_VERSION="${ZAP_VERSION:-2.17.0}"
ZAP_TARBALL_URL="${ZAP_TARBALL_URL:-https://github.com/zaproxy/zaproxy/releases/download/v${ZAP_VERSION}/ZAP_${ZAP_VERSION}_Linux.tar.gz}"
ZAP_TARBALL_SHA256="${ZAP_TARBALL_SHA256:-efe799aaa3627db683b43f00c9c210aea0b75c00cc8f0a0f0434d12bb3ddde5a}"

mkdir -p "$OUT_DIR"
OUT_ABS="$(cd "$OUT_DIR" && pwd)"
RUN_LOG="$OUT_ABS/RUN.txt"
CONF="$ROOT/.zap/baseline.conf"

origin="${TARGET}"
origin="${origin#https://}"
origin="${origin#http://}"
origin="https://${origin%%/*}"

have_docker() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

log() { printf '%s\n' "$*" | tee -a "$RUN_LOG"; }

: > "$RUN_LOG"
log "Scoping Track B — ZAP Baseline"
log "started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "target: $TARGET"
log "origin: $origin"
log "out: $OUT_ABS"
log "spider_mins: $SPIDER_MINS"
log "light_ajax: $LIGHT"
log "constraints: no active scan; no form POST; no submit secret probe; assessor APIs out of scope"

ZAP_OPTS=(
  -config spider.threadCount=2
  -config spider.postForm=false
  -config spider.processForm=false
  -config connection.timeoutInSecs=20
)
ZAP_OPTS_STR="${ZAP_OPTS[*]}"

run_docker() {
  log "engine: docker $ZAP_IMAGE"
  cp "$CONF" "$OUT_ABS/baseline.conf"
  extra=()
  if [[ "$LIGHT" == "1" ]]; then
    extra+=(-j)
    log "light: modern/ajax spider enabled (still no active scan)"
  fi
  # Reports must live under the mounted /zap/wrk directory.
  docker run --rm \
    -v "$OUT_ABS:/zap/wrk:rw" \
    -t "$ZAP_IMAGE" \
    zap-baseline.py \
      -t "$TARGET" \
      -c baseline.conf \
      -m "$SPIDER_MINS" \
      -I \
      -T 10 \
      -r zap-baseline-report.html \
      -J zap-baseline-report.json \
      -w zap-baseline-report.md \
      -z "-silent $ZAP_OPTS_STR" \
      "${extra[@]}"
}

ensure_local_zap() {
  if [[ -x "${ZAP_HOME:-}/zap.sh" ]]; then
    printf '%s\n' "$ZAP_HOME"
    return
  fi
  if [[ -x "$ZAP_RUNTIME/ZAP_${ZAP_VERSION}/zap.sh" ]]; then
    printf '%s\n' "$ZAP_RUNTIME/ZAP_${ZAP_VERSION}"
    return
  fi
  if command -v zap.sh >/dev/null 2>&1; then
    dirname "$(command -v zap.sh)"
    return
  fi
  mkdir -p "$ZAP_RUNTIME"
  local tar="$ZAP_RUNTIME/ZAP_${ZAP_VERSION}_Linux.tar.gz"
  if [[ ! -f "$tar" ]]; then
    log "downloading official ZAP ${ZAP_VERSION} Linux package (not committed)"
    curl -L --fail --retry 4 --retry-delay 4 -o "$tar" "$ZAP_TARBALL_URL"
  fi
  local sha
  sha="$(sha256sum "$tar" | awk '{print $1}')"
  if [[ "$sha" != "$ZAP_TARBALL_SHA256" ]]; then
    log "ERROR: ZAP tarball sha256 mismatch: $sha"
    exit 3
  fi
  tar -xzf "$tar" -C "$ZAP_RUNTIME"
  printf '%s\n' "$ZAP_RUNTIME/ZAP_${ZAP_VERSION}"
}

run_local() {
  if ! command -v java >/dev/null 2>&1; then
    log "ERROR: Docker is unavailable and Java is not installed."
    log "Install Docker and re-run, or install a JRE 11+ and re-run this script."
    exit 3
  fi
  local zap_home
  zap_home="$(ensure_local_zap)"
  log "engine: local $zap_home/zap.sh ($(java -version 2>&1 | head -1))"

  local light_jobs=""
  if [[ "$LIGHT" == "1" ]]; then
    log "light: extra traditional spider minute (ajax skipped unless Docker; no browser pack here)"
    light_jobs="$(cat <<EOF
  - type: spider
    parameters:
      context: prescope-intake
      url: "${TARGET}"
      maxDuration: 1
      maxDepth: 10
      threadCount: 2
      postForm: false
      processForm: false
      userAgent: "ScopingAuthorizedDAST/1.0 (ZAP-Baseline-light)"
EOF
)"
  fi

  local plan="$OUT_ABS/zap-baseline-plan.yaml"
  python3 - "$ROOT/.zap/baseline.yaml.tpl" "$plan" "$origin" "$TARGET" "$OUT_ABS" "$SPIDER_MINS" "$light_jobs" <<'PY'
import pathlib, sys
tpl, dest, origin, target, report_dir, mins, light = sys.argv[1:8]
text = pathlib.Path(tpl).read_text()
text = (
    text.replace("__TARGET_ORIGIN__", origin)
    .replace("__TARGET_URL__", target)
    .replace("__REPORT_DIR__", report_dir)
    .replace("__SPIDER_MINS__", mins)
    .replace("__LIGHT_JOBS__", light)
)
pathlib.Path(dest).write_text(text)
print("wrote", dest)
PY

  # Dedicated home so add-on cache stays out of the repo.
  local home="$ZAP_RUNTIME/home"
  mkdir -p "$home"
  # -silent: no update check. Automation plan is spider + passive + report only.
  "$zap_home/zap.sh" -cmd -silent -nostdout \
    -dir "$home" \
    -config "network.connection.timeoutInSecs=20" \
    "${ZAP_OPTS[@]}" \
    -autorun "$plan"
}

ENGINE=""
if have_docker; then
  ENGINE="docker"
  run_docker
else
  log "docker: not available on this host — falling back to official Linux package"
  ENGINE="local-linux"
  run_local
fi

# Soft-touch assessor surfaces (one GET/POST each, no keys).
ASSESSOR_MD="$OUT_ABS/assessor-soft-touch.md"
python3 - "$origin" "$ASSESSOR_MD" <<'PY'
import pathlib, subprocess, sys, json
origin, dest = sys.argv[1:3]
probes = [
    ("GET", f"{origin}/assessor", {"Accept": "text/html"}),
    ("GET", f"{origin}/assessor/login", {"Accept": "text/html"}),
    ("GET", f"{origin}/api/assessor/emass", {"Accept": "application/json"}),
    ("GET", f"{origin}/api/submissions", {"Accept": "application/json"}),
    ("POST", f"{origin}/api/assessor/session", {"Accept": "application/json", "Content-Type": "application/json"}),
]
rows = []
for method, url, headers in probes:
    cmd = ["curl", "-sS", "-D", "-", "-o", "/tmp/zap-soft-body", "-w", "\n%{http_code}", "-X", method, url]
    for k, v in headers.items():
        cmd.extend(["-H", f"{k}: {v}"])
    if method == "POST":
        cmd.extend(["--data", "{}"])
    p = subprocess.run(cmd, check=False, capture_output=True, text=True)
    out = p.stdout or ""
    parts = out.rsplit("\n", 1)
    hdr = parts[0] if len(parts) == 2 else out
    code = parts[1].strip() if len(parts) == 2 else "?"
    status_line = next((ln for ln in hdr.splitlines() if ln.startswith("HTTP/")), "")
    try:
        body = pathlib.Path("/tmp/zap-soft-body").read_text(errors="replace")[:120].replace("\n", " ")
    except FileNotFoundError:
        body = ""
    rows.append((method, url, code or status_line, body))

lines = [
    "# Assessor gated surfaces — soft touch",
    "",
    "One unauthenticated request each. No key guessing, no brute-force.",
    "",
    "| Method | URL | Status | Body snippet |",
    "| --- | --- | --- | --- |",
]
for method, url, code, body in rows:
    safe = body.replace("|", "\\|")
    lines.append(f"| {method} | `{url}` | {code} | `{safe}` |")
lines += [
    "",
    "Expected (Track B hardening): HTML `/assessor` → 307 `/assessor/login`;",
    "`POST /api/assessor/session` with an empty body → **401**; other `/api/assessor/*` and `/api/submissions` → **404**.",
    "",
]
pathlib.Path(dest).write_text("\n".join(lines) + "\n")
print("wrote", dest)
PY

# Submit Worker observation (headers / TLS / CORS only).
if [[ "${ZAP_SKIP_SUBMIT_OBSERVE:-0}" != "1" ]]; then
  bash "$ROOT/scripts/zap-observe-submit.sh"
fi

# Summarize if a JSON report landed (name varies slightly by engine).
JSON_REPORT=""
for cand in \
  "$OUT_ABS/zap-baseline-report.json" \
  "$OUT_ABS/zap-baseline-report.json.json"
do
  if [[ -f "$cand" ]]; then
    JSON_REPORT="$cand"
    break
  fi
done
# AF sometimes writes zap-baseline-report.json or zap-baseline-report
if [[ -z "$JSON_REPORT" ]]; then
  JSON_REPORT="$(find "$OUT_ABS" -maxdepth 1 -type f -name '*baseline*.json' ! -name 'submit-observe.json' | head -1 || true)"
fi
if [[ -n "${JSON_REPORT}" && -f "$ROOT/scripts/zap-summarize.py" ]]; then
  python3 "$ROOT/scripts/zap-summarize.py" --json "$JSON_REPORT" --out "$OUT_ABS/SUMMARY.md" \
    --engine "$ENGINE" --target "$TARGET" || log "summarize: non-fatal failure"
fi

log "engine_used: $ENGINE"
log "finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "reports: $OUT_ABS"
ls -la "$OUT_ABS" | tee -a "$RUN_LOG"
