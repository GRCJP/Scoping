import type { FormAnswers } from "./types";

/** True only for the hidden tester query `demo=1`. */
export function intakeDemoQuery(search: string): boolean {
  if (!search) return false;
  const q = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(q).get("demo") === "1";
  } catch {
    return false;
  }
}

/**
 * Complete Harborline-style dummy. Type-only imports so Node tests can load
 * this file. Callers must not show this as chrome.
 * Cloudflare Track B Submit accepts the full JSON body, so ?demo=1 includes
 * two sample service providers for ESP / Service Provider Info showcase.
 * Power Pages / Dataverse demo fill stays Providers = No (child SP rows).
 */
export function harborlineOscAnswers(): FormAnswers {
  return {
    hqname: "Harborline Precision LLC",
    uei: "HBR1LN0SC014",
    oscname: "Harborline Precision",
    dba: "Harborline",
    address1: "18 Thames St",
    address2: "Suite 12",
    city: "Newport",
    state: "RI",
    zip: "02840",
    country: "United States",
    businessphone: "401-555-0188",
    website: "https://harborline.example",
    sector: "Defense Industrial Base",
    sectorother: "",
    employees: "85",
    hlocage: "8H2LP",
    cageinscope: "8H2LP",
    scopemode: "Enclave",
    scopedesc: "GCC High plus on-prem file share. Corporate M365 Commercial is out.",
    ao_last: "Chen",
    ao_first: "Maya",
    ao_title: "Contracts manager / Affirming Official",
    ao_email: "maya.chen@harborline.example",
    ao_phone: "401-555-0188",
    tpoc_last: "Ortiz",
    tpoc_first: "Luis",
    tpoc_title: "IT lead",
    tpoc_email: "luis.ortiz@harborline.example",
    tpoc_phone: "401-555-0189",
    has_sps: "Yes",
    sps: [
      {
        name: "Microsoft",
        email: "avery.kim@microsoft.example",
        poc_last: "Kim",
        poc_first: "Avery",
        poc_phone: "425-555-0140",
        job: "CSP",
        service_desc: "Office 365 GCC High tenant for CUI email, SharePoint, and Teams.",
        cui_or_spd: "Stores, processes, or transmits CUI",
        fedramp: "FedRAMP Authorized",
        offering_name: "Office 365 GCC High",
        own_cmmc: "No",
        admin_access: "No",
        crm_inherited: "Yes",
        vendor_srm: "Yes",
        spcmmcstatus: "N/A",
        spsector: "Cloud Service Provider",
      },
      {
        name: "Northwind SOC",
        email: "sam.patel@northwindsoc.example",
        poc_last: "Patel",
        poc_first: "Sam",
        poc_phone: "401-555-0190",
        job: "MSP",
        service_desc: "Managed SOC and continuous monitoring for the GCC High enclave.",
        cui_or_spd: "Security-protection data only",
        fedramp: "",
        offering_name: "",
        own_cmmc: "No",
        admin_access: "No",
        crm_inherited: "Yes",
        vendor_srm: "Yes",
        spcmmcstatus: "N/A",
        spsector: "Information Technology",
      },
    ],
    employees_total: "85",
    cui_users: "22",
    interview_roles_namable: "Yes",
    interview_role_names: "IT lead, contracts manager, CAD supervisor",
    devices_workstations: "14 CAD workstations",
    devices_laptops: "8 GCC High laptops",
    devices_servers: "2 file servers in the enclave",
    devices_mobile: "None in CUI path",
    devices_home: "",
    device_classes: ["Workstations", "Laptops", "Servers"],
    cui_locations: ["M365 GCC High", "On-prem file shares / servers"],
    cui_locations_note: "Drawings land in GCC High SharePoint and an on-prem file share inside the enclave.",
    cui_host_fedramp: [
      { host: "M365 GCC High", fedramp: "FedRAMP Authorized", offering_name: "Office 365 GCC High" },
      { host: "On-prem file shares / servers", fedramp: "N/A", offering_name: "" },
    ],
    cui_flow:
      "Prime emails a link into GCC High. Engineer opens CAD on an enclave workstation. As-built packet goes back through GCC High to the prime. No CUI on Commercial email.",
    cui_leaves_portable: "No",
    vdi_download_print: "N/A",
    cui_off_hq: "No",
    cui_off_hq_note: "",
    other_sites: "",
    cui_backup_commercial: "No",
    cui_backup_where: "GCC High",
    physical_cui_observe: "No",
    virtual_tour_exposes_cui: "No",
    dlp_blocks_screenshare: "Yes",
    env_mode: "GCC High tenant",
    enclave_what: "",
    enclave_fedramp: "FedRAMP High (or equiv, e.g. GCC High)",
    boundary_defined: "Yes",
    network_diagram: "Yes",
    diagram_vs_matrix: "Yes",
    separation: "Both",
    count_cui_assets: "Some (11–50)",
    count_spa: "A few (1–10)",
    count_crma: "A few (1–10)",
    crma_enforce: "Technically enforced",
    has_crma: "Yes",
    crma_handles_cui: "No",
    specialized_kinds: ["OT", "Other"],
    count_specialized: "OT",
    specialized_notes: "CNC controllers, CMM — 8. CUI not stored on them; USB blocked.",
    count_oos: "Many (51+)",
    oos_can_reach_cui: "No",
    oos_justification: "No CUI accounts, no enclave routing, separate IdP.",
    contmon_tool: "CrowdStrike + Microsoft Sentinel (GCC High)",
    contmon_who: "Luis Ortiz + Northwind SOC",
    contmon_howoften: "Daily SOC; weekly OSC review",
    mfa_solution: "Entra ID MFA (number matching) + hardware keys for admin",
    mfa_coverage: "All remote and privileged",
    mfa_uncovered: "None known",
    esp_kinds: ["MSP", "CSP"],
    esp_who: "Microsoft / Office 365 GCC High; Northwind SOC",
    esp_csp: "Yes",
    esp_fedramp: "FedRAMP High (or equiv, e.g. GCC High)",
    csp_needs_own_cmmc: "No",
    esp_crm: "Yes",
    vendor_srm_on_file: "Yes",
    esp_admin_access: "No",
    esp_crm_names_inherited: "Yes",
    ssp_exists: "Yes",
    ssp_updated: "2026-06-01",
    ssp_matches: "Yes",
    ssp_artifacts_exist: "Yes",
    ssp_artifact_types: "SSP, policies, procedures, diagrams, inventory",
    inventory_exists: "Yes",
    inventory_current: "Yes",
    poam_open: "No",
    poam_conditional: "N/A",
    poam_notes: "",
    evidence_share: "Box",
    evidence_share_other: "",
    fix_during_assessment: "No",
    freeze_during_assessment: "Yes",
    migrate_during_assessment: "No",
    consent_nocui: true,
    consent_notassessment: true,
  };
}

/**
 * Query-only fill. `demo=1` absent → null (caller keeps empty / draft).
 * Never tied to Start.
 */
export function answersIfDemoQuery(search: string): FormAnswers | null {
  return intakeDemoQuery(search) ? harborlineOscAnswers() : null;
}
