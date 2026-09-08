#!/usr/bin/env python3
"""Turn a ZAP traditional-json report into docs/security/zap/SUMMARY.md."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# pluginid → OWASP Top 10 2021. Names are hints only; ids are authoritative.
OWASP_BY_PLUGIN: dict[str, str] = {
    "2": "A01:2021 Broken Access Control",
    "3": "A07:2021 Identification and Authentication Failures",
    "10010": "A05:2021 Security Misconfiguration",
    "10011": "A02:2021 Cryptographic Failures",
    "10015": "A04:2021 Insecure Design",
    "10016": "A05:2021 Security Misconfiguration",
    "10017": "A08:2021 Software and Data Integrity Failures",
    "10019": "A05:2021 Security Misconfiguration",
    "10020": "A05:2021 Security Misconfiguration",
    "10021": "A05:2021 Security Misconfiguration",
    "10023": "A05:2021 Security Misconfiguration",
    "10024": "A01:2021 Broken Access Control",
    "10025": "A01:2021 Broken Access Control",
    "10027": "A05:2021 Security Misconfiguration",
    "10031": "A03:2021 Injection",
    "10035": "A05:2021 Security Misconfiguration",
    "10036": "A02:2021 Cryptographic Failures",
    "10037": "A05:2021 Security Misconfiguration",
    "10038": "A05:2021 Security Misconfiguration",
    "10040": "A02:2021 Cryptographic Failures",
    "10044": "A05:2021 Security Misconfiguration",
    "10049": "A04:2021 Insecure Design",
    "10050": "A04:2021 Insecure Design",
    "10054": "A05:2021 Security Misconfiguration",
    "10055": "A05:2021 Security Misconfiguration",
    "10061": "A05:2021 Security Misconfiguration",
    "10063": "A05:2021 Security Misconfiguration",
    "10096": "A05:2021 Security Misconfiguration",
    "10098": "A05:2021 Security Misconfiguration",
    "10099": "A05:2021 Security Misconfiguration",
    "10105": "A07:2021 Identification and Authentication Failures",
    "10109": "A05:2021 Security Misconfiguration",
    "10110": "A05:2021 Security Misconfiguration",
    "10112": "A05:2021 Security Misconfiguration",
    "10202": "A01:2021 Broken Access Control",
    "40014": "A01:2021 Broken Access Control",
    "90011": "A05:2021 Security Misconfiguration",
    "90022": "A05:2021 Security Misconfiguration",
    "90033": "A05:2021 Security Misconfiguration",
}

# Alert-name keywords when plugin id is missing from the table.
OWASP_BY_NAME: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"content.security.policy|csp", re.I), "A05:2021 Security Misconfiguration"),
    (re.compile(r"strict-transport|hsts", re.I), "A05:2021 Security Misconfiguration"),
    (re.compile(r"x-frame|clickjack|frame-ancestors", re.I), "A05:2021 Security Misconfiguration"),
    (re.compile(r"cookie", re.I), "A05:2021 Security Misconfiguration"),
    (re.compile(r"cors|cross-domain|cross.origin", re.I), "A05:2021 Security Misconfiguration"),
    (re.compile(r"xss|cross.site.script", re.I), "A03:2021 Injection"),
    (re.compile(r"csrf|anti-csrf", re.I), "A01:2021 Broken Access Control"),
    (re.compile(r"cache-control|pragma|storable", re.I), "A04:2021 Insecure Design"),
    (re.compile(r"mixed content|tls|ssl", re.I), "A02:2021 Cryptographic Failures"),
    (re.compile(r"server leak|x-powered|information disclosure", re.I), "A05:2021 Security Misconfiguration"),
]

RISK_ORDER = {"High": 0, "Medium": 1, "Low": 2, "Informational": 3, "Info": 3}


def owasp_for(pluginid: str, name: str) -> str:
    if pluginid in OWASP_BY_PLUGIN:
        return OWASP_BY_PLUGIN[pluginid]
    for pat, label in OWASP_BY_NAME:
        if pat.search(name):
            return label
    return "Unmapped — see evidence / CWE in the HTML report"


def risk_label(alert: dict) -> str:
    raw = (alert.get("riskdesc") or alert.get("risk") or "").strip()
    # "Medium (Medium)" → Medium
    head = raw.split("(", 1)[0].strip() or raw
    if head in RISK_ORDER:
        return head
    code = str(alert.get("riskcode") or "")
    return {"3": "High", "2": "Medium", "1": "Low", "0": "Informational"}.get(code, raw or "Informational")


def sites_from(doc: object) -> list[dict]:
    if isinstance(doc, dict) and "site" in doc:
        site = doc["site"]
        return site if isinstance(site, list) else [site]
    if isinstance(doc, list):
        return doc
    return []


def alerts_from(site: dict) -> list[dict]:
    alerts = site.get("alerts") or site.get("alerts") or []
    if isinstance(alerts, dict):
        return [alerts]
    return list(alerts)


def first_instance(alert: dict) -> dict:
    inst = alert.get("instances") or []
    if isinstance(inst, dict):
        inst = [inst]
    return inst[0] if inst else {}


def snippet(text: str, limit: int = 180) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def likely_false_positive(alert: dict, url: str) -> str:
    name = (alert.get("name") or alert.get("alert") or "").lower()
    evidence = (first_instance(alert).get("evidence") or "").lower()
    notes: list[str] = []
    if "x-xss-protection" in name:
        notes.append("Likely noise — modern browsers ignore X-XSS-Protection; CSP is the control.")
    if "timestamp disclosure" in name:
        notes.append("Often a false positive on static hashes / Cloudflare Ray IDs / font filenames.")
    if "strict-transport-security" in name and "workers.dev" in url:
        notes.append(
            "Possible platform residual — Cloudflare may omit custom HSTS on *.workers.dev (shared parent)."
        )
    if "csp" in name and "unsafe-inline" in evidence:
        notes.append(
            "Known residual (PSC-B-04 / PSC-05) — Next/OpenNext still needs 'unsafe-inline'/'unsafe-eval' on script-src."
        )
    if "x-powered-by" in name or "server leaks" in name:
        notes.append("Informational fingerprint (Next.js / Cloudflare). Not an authz bypass.")
    if "anti-csrf" in name or "csrf" in name:
        notes.append(
            "Public unauthenticated intake is intentional; JSON POST without cookie auth is the current write path."
        )
    return " ".join(notes)


def load_report(path: Path) -> dict:
    raw = json.loads(path.read_text())
    if not isinstance(raw, dict):
        return {"site": raw}
    return raw


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--engine", default="unknown")
    ap.add_argument("--target", default="")
    args = ap.parse_args()

    path = Path(args.json)
    doc = load_report(path)
    collected: list[dict] = []
    for site in sites_from(doc):
        site_name = site.get("@name") or site.get("name") or args.target
        for alert in alerts_from(site):
            inst = first_instance(alert)
            url = inst.get("uri") or inst.get("url") or site_name
            collected.append(
                {
                    "name": alert.get("name") or alert.get("alert") or "Untitled",
                    "pluginid": str(alert.get("pluginid") or alert.get("pluginId") or ""),
                    "risk": risk_label(alert),
                    "confidence": (alert.get("confidence") or "").split("(", 1)[0].strip(),
                    "url": url,
                    "method": inst.get("method") or "",
                    "evidence": snippet(inst.get("evidence") or inst.get("otherinfo") or alert.get("otherinfo") or ""),
                    "desc": snippet(re.sub("<[^>]+>", "", alert.get("desc") or ""), 280),
                    "solution": snippet(re.sub("<[^>]+>", "", alert.get("solution") or ""), 240),
                    "cwe": str(alert.get("cweid") or ""),
                    "count": str(alert.get("count") or len(alert.get("instances") or []) or "1"),
                    "owasp": owasp_for(str(alert.get("pluginid") or ""), alert.get("name") or ""),
                    "fp": likely_false_positive(alert, url),
                }
            )

    collected.sort(key=lambda a: (RISK_ORDER.get(a["risk"], 9), a["name"].lower()))
    counts: dict[str, int] = defaultdict(int)
    for a in collected:
        counts[a["risk"]] += 1

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "# Scoping Track B — ZAP Baseline summary",
        "",
        f"**Generated:** `{generated}`  ",
        f"**Engine:** `{args.engine}`  ",
        f"**Target:** `{args.target}`  ",
        f"**Source report:** `{path.name}`  ",
        "**Method:** ZAP Baseline (traditional spider + passive rules). No active scan, no submit-secret probe, no form POST.",
        "",
        "Architect (Dave) gates remediations. Do not treat this file as a license to write exploit PoCs.",
        "",
        "## Counts",
        "",
        "| Severity | Findings |",
        "| --- | ---: |",
        f"| High | {counts.get('High', 0)} |",
        f"| Medium | {counts.get('Medium', 0)} |",
        f"| Low | {counts.get('Low', 0)} |",
        f"| Informational | {counts.get('Informational', 0) + counts.get('Info', 0)} |",
        "",
        "High and Medium are listed first.",
        "",
    ]

    if not collected:
        lines += [
            "## Findings",
            "",
            "No alerts were present in the JSON report. Confirm the HTML report and `RUN.txt` before treating this as a clean bill of health.",
            "",
        ]
    else:
        lines += ["## Findings", ""]
        for i, a in enumerate(collected, 1):
            lines += [
                f"### {i}. {a['name']}",
                "",
                f"| | |",
                f"| --- | --- |",
                f"| **Severity (ZAP risk)** | {a['risk']} |",
                f"| **Confidence** | {a['confidence'] or '—'} |",
                f"| **OWASP Top 10 (2021)** | {a['owasp']} |",
                f"| **CWE** | {a['cwe'] or '—'} |",
                f"| **Plugin** | {a['pluginid'] or '—'} |",
                f"| **URL** | `{a['url']}` |",
                f"| **Method** | {a['method'] or '—'} |",
                f"| **Instances** | {a['count']} |",
                f"| **Evidence snippet** | `{a['evidence'] or '—'}` |",
                f"| **Recommended fix** | {a['solution'] or 'See HTML report.'} |",
                f"| **False positive / residual?** | {a['fp'] or 'Review; not auto-dismissed.'} |",
                "",
                a["desc"],
                "",
            ]

    lines += [
        "## Out of scope / not tested",
        "",
        "- Active scan (injected attack payloads).",
        "- Brute-force or guessing of `PRESCOPE_SUBMIT_SECRET` / `PSC_ASSESSOR_KEY`.",
        "- Authenticated assessor chrome beyond a single unauthenticated soft-touch (`assessor-soft-touch.md`).",
        "- Submit Worker writes — HEADER/TLS/CORS only (`submit-observe.md`).",
        "- Box, eMASS fill container, or any host that is not the operator's `*.example.workers.dev` intake/submit pair.",
        "",
        "Re-run: `bash scripts/zap-baseline.sh`. Details: `README.md` in this folder.",
        "",
    ]
    Path(args.out).write_text("\n".join(lines))
    print(f"wrote {args.out} ({len(collected)} alerts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
