
import type { FormAnswers, ScopeResult } from "./types";

function dash(v: string | undefined | null): string {
  const t = (v ?? "").trim();
  return t.length ? t : "—";
}

function easternDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export { easternDate };

const GOV_PATH = ["M365 GCC High", "PreVeil", "Azure Government", "AWS GovCloud"];

function dedicatedEnv(mode: string): boolean {
  return (
    mode === "GCC High tenant" ||
    mode === "PreVeil" ||
    mode === "Other named enclave" ||
    mode === "Dedicated CUI enclave"
  );
}

function broaderEnv(mode: string): boolean {
  return mode === "Broader environment";
}

function hasGovPath(a: FormAnswers): boolean {
  return (
    a.cui_locations.some((x) => GOV_PATH.includes(x)) ||
    a.env_mode === "GCC High tenant" ||
    a.env_mode === "PreVeil"
  );
}

function commercialCuiHost(a: FormAnswers): boolean {
  return a.cui_locations.some((x) => x === "M365 Commercial" || x === "Email (non-PreVeil)" || x === "Email");
}

function isCloudSaasHost(host: string): boolean {
  return host !== "On-prem file shares / servers" && host !== "N/A / not sure";
}

function hostFedrampSummary(a: FormAnswers): string {
  const tags = a.cui_host_fedramp || [];
  if (!tags.length) return "";
  return tags
    .map((t) => {
      const offer = t.fedramp === "FedRAMP Authorized" && t.offering_name.trim() ? ` (${t.offering_name})` : "";
      return `${t.host}: ${t.fedramp || "—"}${offer}`;
    })
    .join("; ");
}

function listedEsp(a: FormAnswers): boolean {
  if (a.has_sps === "Yes") return (a.sps || []).some((s) => s.name.trim());
  return false;
}

/** Aggregate a per-provider Yes/No/N/A/Don't know fact for the scope write-up. */
function providerFact(a: FormAnswers, key: "admin_access" | "crm_inherited" | "own_cmmc" | "vendor_srm"): string {
  const rows = (a.sps || []).filter((s) => s.name.trim());
  if (!rows.length) return a.has_sps === "No" || a.has_sps === "N/A" ? "None" : "—";
  if (rows.some((s) => s[key] === "Yes")) return "Yes";
  if (rows.some((s) => s[key] === "Don't know")) return "Don't know";
  if (rows.some((s) => s[key] === "No")) return "No";
  if (rows.every((s) => s[key] === "N/A")) return "N/A";
  return rows.map((s) => `${s.name}: ${s[key] || "—"}`).join("; ");
}

function fiveCat(a: FormAnswers): string {
  return [
    `CUI Assets: ${dash(a.count_cui_assets)}`,
    `SPA: ${dash(a.count_spa)}`,
    `CRMA: ${dash(a.has_crma)} · ${dash(a.count_crma)} (${dash(a.crma_enforce)}) — can handle CUI even by accident: ${dash(a.crma_handles_cui)}`,
    `Specialized (GFE/OT/IoT/test): ${dash((a.specialized_kinds || []).join(", ") || a.count_specialized)} ${dash(a.specialized_notes)}`.trim(),
    `Out of scope: ${dash(a.count_oos)} — can still reach CUI: ${dash(a.oos_can_reach_cui)} — ${dash(a.oos_justification)}`,
  ].join("\n");
}

function espTable(a: FormAnswers): string {
  const rows = (a.sps || []).filter((s) => s.name.trim());
  const lines = rows.map((s) => {
    const offer = s.offering_name.trim() ? ` · offering ${s.offering_name}` : "";
    return `- ${s.name} · ${dash(s.job)} · ${dash(s.cui_or_spd)} · FedRAMP ${dash(s.fedramp)}${offer} · own CMMC ${dash(s.own_cmmc)} · admin/backup/logs ${dash(s.admin_access)} · CRM inherited ${dash(s.crm_inherited)} · vendor SRM ${dash(s.vendor_srm)} · ${dash(s.email)}`;
  });
  lines.push(`ESP admin/backup/log access (from providers): ${providerFact(a, "admin_access")}`);
  lines.push(`CRM names inherited vs owned (from providers): ${providerFact(a, "crm_inherited")}`);
  if (!listedEsp(a) && !rows.length) return ["None listed.", ...lines.slice(-2)].join("\n");
  return lines.length ? lines.join("\n") : "None listed.";
}

/**
 * Derives a descriptive summary of what the OSC reported.
 *
 * Intentionally computes NO verdict. There is no go/no-go, no risk flag list,
 * no confidence or effort rating. Triage is a human judgment made on the
 * scoping call with the answers in front of you — not something this file
 * decides from form input.
 */
export function runScope(a: FormAnswers): ScopeResult {
  const determination =
    dedicatedEnv(a.env_mode) || hasGovPath(a)
      ? "Dedicated CUI enclave (L2 environment)"
      : broaderEnv(a.env_mode) || a.scopemode === "Enterprise"
        ? "Enterprise CUI environment (L2)"
        : "L2 environment (confirm on call)";

  const line1 = `What is being assessed: ${a.scopemode || "scope unset"} · ${a.env_mode || "environment unset"}. CUI lives in ${a.cui_locations.join(", ") || "—"}. People who access CUI: ${dash(a.cui_users || a.employees_total || a.employees)}.`;
  const line2 = `Boundary defined: ${dash(a.boundary_defined)}. Network diagram: ${dash(a.network_diagram)}. Separation: ${dash(a.separation)}. FedRAMP: ${dash(hostFedrampSummary(a))}. MFA: ${dash(a.mfa_solution)} (${dash(a.mfa_coverage)}). Paper/USB/home: ${dash(a.cui_leaves_portable)}. Physical CUI to observe: ${dash(a.physical_cui_observe)}. VDI download/print: ${dash(a.vdi_download_print)}. Backups: ${dash(a.cui_backup_commercial)} · ${dash(a.cui_backup_where)}. Freeze: ${dash(a.freeze_during_assessment)}. Migration: ${dash(a.migrate_during_assessment)}.`;
  const line3 =
    "Call is confirmation: walk the CUI flow, asset counts, and evidence-share path against these answers.";

  return {
    infodetermination: determination,
    assess_line1: line1,
    assess_line2: line2,
    assess_line3: line3,
    scope_mode: a.scopemode,
    scope_people: `${dash(a.cui_users || a.employees_total || a.employees)} users who access CUI`,
    scope_locations: [a.city, a.state, a.country].filter(Boolean).join(", ") || "—",
    scope_systemclasses: (a.device_classes || []).length
      ? a.device_classes.join("; ")
      : `WS ${dash(a.devices_workstations)}; laptops ${dash(a.devices_laptops)}; servers ${dash(a.devices_servers)}; mobile ${dash(a.devices_mobile)}`,
    l2fivecat: fiveCat(a),
    esptable: espTable(a),
    flowdownsketch: dash(a.cui_flow),
    scopenotes: `${a.scopedesc || a.enclave_what || ""}`.trim(),
  };
}

