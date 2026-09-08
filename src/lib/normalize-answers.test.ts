import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAnswers, emptyProvider, type FormAnswers } from "./types.ts";
import { normalizeAnswers, validateNormalizedAnswers } from "./normalize-answers.ts";
import { parseSubmitBody } from "./submit-body.ts";

/** Complete payload that satisfies firstIncompleteGap (mirrors sampleHealthy). */
function goodAnswers(): FormAnswers {
  return {
    ...emptyAnswers(),
    hqname: "Alder Holdings LLC",
    uei: "XK3MNB7P2Q14",
    oscname: "Alder Precision, Inc.",
    address1: "410 Narragansett Ave",
    city: "Warwick",
    state: "RI",
    country: "United States",
    sector: "Defense Industrial Base",
    employees: "85",
    cui_users: "22",
    hlocage: "1H9QX",
    cageinscope: "1H9QX",
    scopemode: "Enclave",
    scopedesc: "GCC High tenant plus locked-down CAD workstations.",
    ao_last: "Chen",
    ao_first: "Maya",
    ao_title: "Contracts manager",
    ao_email: "maya.chen@alder.example",
    ao_phone: "401-555-0142",
    tpoc_last: "Ortiz",
    tpoc_first: "Luis",
    tpoc_title: "IT lead",
    tpoc_email: "luis.ortiz@alder.example",
    tpoc_phone: "401-555-0148",
    has_sps: "Yes",
    sps: [
      {
        ...emptyProvider(),
        name: "Northwind MSP",
        email: "sam.patel@northwindmsp.example",
        poc_last: "Patel",
        poc_first: "Sam",
        poc_phone: "401-555-0100",
        job: "MSP",
        cui_or_spd: "Security-protection data only",
        own_cmmc: "No",
        admin_access: "No",
        crm_inherited: "Yes",
        vendor_srm: "Yes",
        spcmmcstatus: "L2 C3PAO",
      },
    ],
    interview_roles_namable: "Yes",
    cui_locations: ["M365 GCC High", "On-prem file shares / servers"],
    cui_host_fedramp: [
      { host: "M365 GCC High", fedramp: "FedRAMP Authorized", offering_name: "Office 365 GCC High" },
      { host: "On-prem file shares / servers", fedramp: "N/A", offering_name: "" },
    ],
    cui_leaves_portable: "No",
    vdi_download_print: "N/A",
    cui_off_hq: "No",
    cui_backup_commercial: "No",
    cui_backup_where: "GCC High",
    physical_cui_observe: "No",
    virtual_tour_exposes_cui: "No",
    dlp_blocks_screenshare: "Yes",
    env_mode: "GCC High tenant",
    boundary_defined: "Yes",
    network_diagram: "Yes",
    diagram_vs_matrix: "Yes",
    separation: "Both",
    has_crma: "Yes",
    crma_handles_cui: "No",
    oos_can_reach_cui: "No",
    mfa_solution: "Entra ID MFA",
    mfa_coverage: "All remote and privileged",
    ssp_exists: "Yes",
    ssp_artifacts_exist: "Yes",
    ssp_artifact_types: "SSP, policies, procedures",
    poam_open: "No",
    fix_during_assessment: "No",
    freeze_during_assessment: "Yes",
    migrate_during_assessment: "No",
    consent_nocui: true,
    consent_notassessment: true,
  };
}

describe("submit validation (PSC-03)", () => {
  it("accepts a complete healthy payload and reuses validate.ts", () => {
    const result = normalizeAnswers(goodAnswers());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.answers.consent_nocui, true);
    assert.equal(result.answers.evidence_share, "Box");
    assert.equal(validateNormalizedAnswers(result.answers), null);

    const parsed = parseSubmitBody(JSON.stringify({ answers: goodAnswers() }));
    assert.equal(parsed.ok, true);
  });

  it("rejects an array in place of the answers object", () => {
    const result = normalizeAnswers([{ hqname: "x" }]);
    assert.equal(result.ok, false);
    const parsed = parseSubmitBody(JSON.stringify({ answers: [goodAnswers()] }));
    assert.equal(parsed.ok, false);
  });

  it("rejects extra keys", () => {
    const result = normalizeAnswers({ ...goodAnswers(), injected: "nope" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.field, "injected");
  });

  it("requires consent === true, not a truthy string", () => {
    const result = normalizeAnswers({ ...goodAnswers(), consent_nocui: "true" as unknown as boolean });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /boolean/);
  });

  it("rejects invalid email, UEI, CAGE, and enum values", () => {
    assert.equal(normalizeAnswers({ ...goodAnswers(), ao_email: "not-an-email" }).ok, false);
    assert.equal(normalizeAnswers({ ...goodAnswers(), ao_email: "a@b.com\nCc:evil@x.com" }).ok, false);
    assert.equal(normalizeAnswers({ ...goodAnswers(), uei: "too-short" }).ok, false);
    assert.equal(normalizeAnswers({ ...goodAnswers(), hlocage: "TOOLONG" }).ok, false);
    assert.equal(normalizeAnswers({ ...goodAnswers(), hlocage: "INVALID" }).ok, false);
    assert.equal(normalizeAnswers({ ...goodAnswers(), hlocage: "12" }).ok, false);
    assert.equal(normalizeAnswers({ ...goodAnswers(), cageinscope: "8H2LP,1H9QX" }).ok, false);
    assert.equal(normalizeAnswers({ ...goodAnswers(), hlocage: "8H2LP", cageinscope: "8H2LP; 1H9QX" }).ok, true);
    const lowered = normalizeAnswers({ ...goodAnswers(), hlocage: "8h2lp", cageinscope: "8h2lp; 1h9qx" });
    assert.equal(lowered.ok, true);
    if (lowered.ok) {
      assert.equal(lowered.answers.hlocage, "8H2LP");
      assert.equal(lowered.answers.cageinscope, "8H2LP; 1H9QX");
    }
    assert.equal(normalizeAnswers({ ...goodAnswers(), scopemode: "Galaxy" }).ok, false);
  });

  it("rejects oversized strings, object-shaped arrays, and incomplete forms", () => {
    assert.equal(normalizeAnswers({ ...goodAnswers(), hqname: "A".repeat(201) }).ok, false);
    assert.equal(normalizeAnswers({ ...goodAnswers(), sps: { 0: goodAnswers().sps[0] } }).ok, false);

    const raw = emptyAnswers();
    raw.consent_nocui = true;
    raw.consent_notassessment = true;
    const result = normalizeAnswers(raw);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(validateNormalizedAnswers(result.answers));
  });

  it("copies a CUI-users answer into legacy employee aliases", () => {
    const result = normalizeAnswers({ ...goodAnswers(), cui_users: "22", employees: "", employees_total: "" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.answers.cui_users, "22");
    assert.equal(result.answers.employees, "22");
    assert.equal(result.answers.employees_total, "22");
  });

  it("rejects extra top-level keys and oversized bodies on parseSubmitBody", () => {
    const extra = parseSubmitBody(JSON.stringify({ answers: goodAnswers(), other: 1 }));
    assert.equal(extra.ok, false);
    const huge = parseSubmitBody("{}", "200000");
    assert.equal(huge.ok, false);
    if (huge.ok) return;
    assert.equal(huge.status, 413);
  });
});
