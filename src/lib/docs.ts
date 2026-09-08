import { brand } from "./brand.ts";
import type { FormAnswers, ScopeResult } from "./types.ts";
import { contactEmail, contactName, orgName } from "./types.ts";
import { easternDate } from "./scoring.ts";

function v(x: unknown): string {
  if (x === true) return "Yes";
  if (x === false) return "No";
  if (x === null || x === undefined || x === "") return "—";
  if (Array.isArray(x)) return x.length ? x.join("; ") : "—";
  return String(x);
}

function qa(label: string, value: unknown): string {
  return `**${label}**  \n${v(value)}`;
}

function easternLong(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

export function answersMarkdown(a: FormAnswers, submittedon: string, _path: string): string {
  const date = easternLong(submittedon);
  const lines: string[] = [
    `# OSC Discovery Answers`,
    ``,
    `This is a copy of what you submitted to ${brand.displayName} ${brand.productName} on ${date}. It is environment information so we can identify **what is being assessed**. It is **not** a CMMC assessment, designation, identifier lookup, or SPRS posting.`,
    ``,
    `The Box folder (01 Answers + 02 Uploads) is for evidence and is FedRAMP authorized or equivalent.`,
    ``,
    `---`,
    ``,
    `## Preliminary — OSC Information`,
    ``,
    qa("HQ organization name", a.hqname),
    ``,
    qa("UEI", a.uei),
    ``,
    qa("OSC name", a.oscname),
    ``,
    qa("DBA", a.dba),
    ``,
    qa("Address", [a.address1, a.address2].filter(Boolean).join(", ")),
    ``,
    qa("City / state / ZIP", `${a.city}, ${a.state} ${a.zip}`),
    ``,
    qa("Country", a.country),
    ``,
    qa("Business phone", a.businessphone),
    ``,
    qa("Website", a.website),
    ``,
    qa("Sector", a.sector === "Other" ? `Other — ${a.sectorother}` : a.sector),
    ``,
    qa("How many users will access CUI?", a.cui_users || a.employees),
    ``,
    qa("Highest Level Owner (HLO) CAGE", a.hlocage),
    ``,
    qa("CAGE code(s) in scope", a.cageinscope),
    ``,
    qa("Scope", a.scopemode),
    ``,
    qa("Scope description", a.scopedesc),
    ``,
    `### Assessment Official`,
    ``,
    qa("Name", `${a.ao_last}, ${a.ao_first}`),
    ``,
    qa("Title", a.ao_title),
    ``,
    qa("Email", a.ao_email),
    ``,
    qa("Phone", a.ao_phone),
    ``,
    `### Technical POC`,
    ``,
    qa("Name", `${a.tpoc_last}, ${a.tpoc_first}`),
    ``,
    qa("Title", a.tpoc_title),
    ``,
    qa("Email", a.tpoc_email),
    ``,
    qa("Phone", a.tpoc_phone),
    ``,
    `### Service providers`,
    ``,
    qa("Any service providers?", a.has_sps),
    ``,
  ];

  const sps = (a.sps || []).filter((s) => s.name.trim());
  if (!sps.length) {
    lines.push(`None listed.`, ``);
  } else {
    sps.forEach((s, i) => {
      lines.push(`**Provider ${i + 1}**  `);
      lines.push(`${s.name} · ${v(s.email)} · ${v([s.poc_last, s.poc_first].filter(Boolean).join(", "))} · ${v(s.poc_phone)} · ${v(s.job)} · ${v(s.service_desc || s.job)} · ${v(s.cui_or_spd)}`);
      lines.push(
        `FedRAMP: ${v(s.fedramp)}${s.offering_name ? ` (${s.offering_name})` : ""} · own CMMC ${v(s.own_cmmc)} · CMMC Status ${v(s.spcmmcstatus)} · sector ${v(s.spsector)} · admin/backup/logs ${v(s.admin_access)} · CRM inherited ${v(s.crm_inherited)} · vendor SRM ${v(s.vendor_srm)}`,
        ``
      );
    });
  }

  lines.push(
    `---`,
    ``,
    `## Environment discovery`,
    ``,
    qa("Users who touch CUI", a.cui_users),
    ``,
    qa("Can you name the roles we should interview?", a.interview_roles_namable),
    ``,
    qa("Interview role names", a.interview_role_names),
    ``,
    qa("Device classes", a.device_classes),
    ``,
    qa("Workstations in scope", a.devices_workstations),
    ``,
    qa("Laptops in scope", a.devices_laptops),
    ``,
    qa("Servers in scope", a.devices_servers),
    ``,
    qa("Mobile in scope", a.devices_mobile),
    ``,
    qa("Home / BYOD", a.devices_home),
    ``,
    qa("Where CUI lives today", a.cui_locations),
    ``,
    qa("CUI location note", a.cui_locations_note),
    ``,
    qa("CUI host authorization", (a.cui_host_fedramp || []).map((t) => `${t.host}: ${t.fedramp || "—"}${t.offering_name ? ` (${t.offering_name})` : ""}`).join("; ")),
    ``,
    qa("How CUI enters and leaves", a.cui_flow),
    ``,
    qa("Does CUI leave as paper, printer, or USB, including at home?", a.cui_leaves_portable),
    ``,
    qa("If people use VDI or a remote desktop, can they download or print?", a.vdi_download_print),
    ``,
    qa("CUI handled at sites other than HQ?", a.cui_off_hq),
    ``,
    qa("Sites besides HQ", a.other_sites),
    ``,
    qa("Off-HQ note", a.cui_off_hq_note),
    ``,
    qa("CUI backups in a commercial (non-gov) location?", a.cui_backup_commercial),
    ``,
    qa("Where CUI backups live (product class)", a.cui_backup_where),
    ``,
    qa("Physical CUI we would need to observe?", a.physical_cui_observe),
    ``,
    qa("Would a site walkthrough put CUI on screen or in the room?", a.virtual_tour_exposes_cui),
    ``,
    qa("Can we screenshare live system configs without CUI appearing on the call?", a.dlp_blocks_screenshare),
    ``,
    qa("CUI environment", a.env_mode),
    ``,
    qa("What is the enclave?", a.enclave_what),
    ``,
    qa("CUI boundary defined?", a.boundary_defined),
    ``,
    qa("Network diagram exists?", a.network_diagram),
    ``,
    qa("Have the network diagram and the applicability matrix been walked against each other?", a.diagram_vs_matrix),
    ``,
    qa("Separation", a.separation),
    ``,
    qa("CUI Assets (rough)", a.count_cui_assets),
    ``,
    qa("SPA (rough)", a.count_spa),
    ``,
    qa("CRMA (rough)", a.count_crma),
    ``,
    qa("CRMA enforcement", a.crma_enforce),
    ``,
    qa("CRMA systems kept off CUI by policy or control?", a.has_crma),
    ``,
    qa("Can those CRMA still handle CUI even by accident?", a.crma_handles_cui),
    ``,
    qa("Specialized kinds", a.specialized_kinds),
    ``,
    qa("Specialized (GFE/OT/IoT/test)", a.count_specialized),
    ``,
    qa("Specialized notes", a.specialized_notes),
    ``,
    qa("Out-of-scope (rough)", a.count_oos),
    ``,
    qa("Can an out-of-scope asset still reach a CUI system?", a.oos_can_reach_cui),
    ``,
    qa("Out-of-scope justification", a.oos_justification),
    ``,
    qa("Continuous monitoring tool", a.contmon_tool),
    ``,
    qa("Who reviews / how often", `${a.contmon_who} · ${a.contmon_howoften}`),
    ``,
    qa("MFA solution", a.mfa_solution),
    ``,
    qa("MFA coverage", a.mfa_coverage),
    ``,
    qa("Accounts not covered", a.mfa_uncovered),
    ``,
    qa("SSP exists?", a.ssp_exists),
    ``,
    qa("SSP last updated", a.ssp_updated),
    ``,
    qa("SSP matches reality?", a.ssp_matches),
    ``,
    qa("Supporting SSP artifacts exist?", a.ssp_artifacts_exist),
    ``,
    qa("SSP artifact types", a.ssp_artifact_types),
    ``,
    qa("Asset inventory exists and categorized?", a.inventory_exists),
    ``,
    qa("Inventory current?", a.inventory_current),
    ``,
    qa("POA&M / temporary deficiencies?", a.poam_open),
    ``,
    qa("Any POA&Ms conditional (time-boxed / allowed)?", a.poam_conditional),
    ``,
    qa("POA&M notes", a.poam_notes),
    ``,
    qa("Evidence share method", "Box (required)"),
    ``,
    qa("Expect to fix gaps during the assessment?", a.fix_during_assessment),
    ``,
    qa("Freeze planned during the assessment window?", a.freeze_during_assessment),
    ``,
    qa("Migration planned during the assessment window?", a.migrate_during_assessment),
    ``,
    qa("Submitted on", date),
    ``,
    qa("Submitted by (Assessment Official)", `${contactName(a)} <${contactEmail(a)}>`)
  );

  return lines.join("\n");
}

export function internalMarkdown(
  a: FormAnswers,
  s: ScopeResult,
  meta: { submittedon: string; orchstatus: string; boxInternalUrl: string; dropUrl: string; id: string }
): string {
  const date = easternLong(meta.submittedon);
  const name = orgName(a);
  return [
    `# OSC Discovery — Internal scope brief`,
    ``,
    `_Assessor only. Not on the customer link. Not a certification._`,
    ``,
    `## 1. Header`,
    ``,
    `| | |`,
    `| --- | --- |`,
    `| OSC | ${name} |`,
    `| HQ | ${v(a.hqname)} |`,
    `| UEI | ${v(a.uei)} |`,
    `| HLO CAGE | ${v(a.hlocage)} |`,
    `| CAGE in scope | ${v(a.cageinscope)} |`,
    `| Sector | ${v(a.sector)} |`,
    `| Scope | ${v(a.scopemode)} |`,
    `| Submitted | ${date} |`,
    `| Assessment Official | ${contactName(a)} · ${contactEmail(a)} |`,
    `| Technical POC | ${a.tpoc_first} ${a.tpoc_last} · ${a.tpoc_email} |`,
    `| Orch status | ${meta.orchstatus} |`,
    `| Box 00 Internal | ${meta.boxInternalUrl} |`,
    `| DROP | ${meta.dropUrl} |`,
    `| Record | ${meta.id} |`,
    ``,
    `## 2. Environment determination`,
    ``,
    s.infodetermination,
    ``,
    s.scopenotes,
    ``,
    `## 3. Assessment type (three lines)`,
    ``,
    `**(1) What is being assessed**  `,
    s.assess_line1,
    ``,
    `**(2) Boundary / FedRAMP / MFA**  `,
    s.assess_line2,
    ``,
    `**(3) Call focus**  `,
    s.assess_line3,
    ``,
    `## 4. Scope`,
    ``,
    `**Enterprise vs enclave:** ${v(s.scope_mode)}`,
    ``,
    `**People:** ${s.scope_people}`,
    ``,
    `**Locations:** ${s.scope_locations}`,
    ``,
    `**Devices:** ${s.scope_systemclasses}`,
    ``,
    `**L2 five-category first pass (32 CFR 170.19) — not an official scope**`,
    ``,
    s.l2fivecat,
    ``,
    `**ESP table**`,
    ``,
    s.esptable,
    ``,
    `**CUI flow**`,
    ``,
    s.flowdownsketch,
    ``,
    `## 5. Confirmation-call checklist`,
    ``,
    `- Call is confirmation, not discovery. Discovery was on the public form.`,
    `- Walk the CUI flow, asset counts, and evidence-share path against the answers above.`,
    `- Confirm CUI locations and that no CUI content was pasted into this form.`,
    `- Readiness is your judgment on this call. This brief states what the OSC reported, nothing more.`,
    ``,
    `---`,
    ``,
    `_Not legal advice. Not a CMMC assessment. ${brand.displayName} ${brand.productName}. Do not collect CUI, UIDs, or SPRS scores._`,
  ].join("\n");
}

export function sanitizeCustomer(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Customer";
}

export function dropFolderName(legalname: string, submittedon: string): string {
  const day = easternDate(new Date(submittedon));
  return `${sanitizeCustomer(legalname)} - OSC Discovery - ${day}`;
}

/** Four eMASS artifacts (00 Internal only). Certificate is preview-only — not a fifth file. */
export function emassOrgFilePart(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().replace(/\.+$/, "").slice(0, 80) || "OSC";
}

export function emassArtifactFilenames(orgName: string): {
  scoping: string;
  preAssessment: string;
  dataTemplate: string;
  resultsStub: string;
} {
  const org = emassOrgFilePart(orgName);
  return {
    scoping: `Scoping-Guide-${org}.md`,
    preAssessment: `Pre-Assessment-${org}.md`,
    dataTemplate: `Data-Template-${org}.md`,
    resultsStub: `Assessment-Results-stub-${org}.md`,
  };
}
