import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { harborlineOscAnswers } from "./demo-fill.ts";
import {
  EMASS_CMMC_STATUS_FROM_FORM,
  buildEmassPrefill,
  emassCountry,
  translateCmmcStatus,
  translateSector,
} from "./emass.ts";
import { emptyAnswers, emptyProvider } from "./types.ts";

describe("eMASS CMMC status translation", () => {
  it("maps every form label to None or Level 2 and never Level 3", () => {
    assert.equal(translateCmmcStatus("Not assessed"), "None");
    assert.equal(translateCmmcStatus("Seeking L2"), "None");
    assert.equal(translateCmmcStatus("L2 Self"), "Level 2");
    assert.equal(translateCmmcStatus("L2 C3PAO"), "Level 2");
    assert.equal(translateCmmcStatus("Unknown"), "None");
    assert.equal(translateCmmcStatus("N/A"), "None");
    assert.equal(translateCmmcStatus(""), "");
    assert.equal(translateCmmcStatus("  L2 Self  "), "Level 2");
    for (const [form, emass] of Object.entries(EMASS_CMMC_STATUS_FROM_FORM)) {
      assert.equal(translateCmmcStatus(form), emass);
      assert.notEqual(emass, "Level 3");
    }
  });
});

describe("eMASS sector translation", () => {
  it("passes 1:1 lookup labels through and leaves Energy / Financial Services blank", () => {
    assert.equal(translateSector("Defense Industrial Base").value, "Defense Industrial Base");
    assert.equal(translateSector("Cloud Service Provider").value, "Cloud Service Provider");
    assert.equal(translateSector("Other").value, "Other");
    const energy = translateSector("Energy");
    assert.equal(energy.value, "");
    assert.match(energy.note ?? "", /Energy/);
    const finance = translateSector("Financial Services");
    assert.equal(finance.value, "");
    assert.match(finance.note ?? "", /Financial Services/);
    assert.equal(translateSector("").value, "");
  });
});

describe("eMASS country default", () => {
  it("defaults empty country to United States", () => {
    assert.equal(emassCountry(""), "United States");
    assert.equal(emassCountry("  "), "United States");
    assert.equal(emassCountry("Canada"), "Canada");
  });
});

describe("PrefillCell mapping", () => {
  it("Harborline demo-fill maps company, officials, and TPOC; C3PAO and free-text stay blank", () => {
    const p = buildEmassPrefill(harborlineOscAnswers());
    const byField = Object.fromEntries(p.preAssessment.fields.map((c) => [c.field, c]));
    assert.equal(byField["HQ Organization Name"]?.value, "Harborline Precision LLC");
    assert.equal(byField.UEI?.value, "HBR1LN0SC014");
    assert.equal(byField["OSC Name"]?.value, "Harborline Precision");
    assert.equal(byField["Address Line 1"]?.value, "18 Thames St");
    assert.equal(byField["Address Line 2"]?.value, "Suite 12");
    assert.equal(byField.City?.value, "Newport");
    assert.equal(byField.State?.value, "RI");
    assert.equal(byField["Zip Code"]?.value, "02840");
    assert.equal(byField.Country?.value, "United States");
    assert.equal(byField["Business Phone"]?.value, "401-555-0188");
    assert.equal(byField["Web URL"]?.value, "https://harborline.example");
    assert.equal(byField.Sector?.value, "Defense Industrial Base");
    assert.equal(byField["Number of Employees"]?.value, "22");
    assert.equal(byField["HLO CAGE"]?.value, "8H2LP");
    assert.equal(byField["CAGE code(s) in scope"]?.value, "8H2LP");
    assert.equal(byField["Scope (Enterprise|Enclave)"]?.value, "Enclave");
    assert.ok(byField["Scope Description"]?.value.includes("GCC High"));
    assert.equal(byField["Assessment Official Last Name"]?.value, "Chen");
    assert.equal(byField["Assessment Official First Name"]?.value, "Maya");
    assert.equal(byField["Technical POC Last Name"]?.value, "Ortiz");
    assert.equal(byField["Technical POC First Name"]?.value, "Luis");
    assert.ok(byField["HQ Organization Name"]?.xlsx?.cell);

    const leave = Object.fromEntries(p.preAssessment.leaveBlank.map((c) => [c.field, c]));
    assert.equal(leave["Address Line 3"]?.value, "");
    assert.equal(leave["Address Line 3"]?.origin, "c3pao");
    assert.equal(leave["Sector Other"]?.value, "");
    assert.equal(leave["C3PAO Contract Date"]?.origin, "c3pao");
    assert.equal(leave["C3PAO Unique Identifier"]?.value, "");
    assert.equal(leave["C3PAO Organization Name"]?.value, "");
    assert.equal(leave["Lead Assessor"]?.value, "");
    assert.equal(p.preAssessment.espRows.length, 2);
    assert.equal(p.preAssessment.espRows[0]?.name, "Microsoft");
    assert.equal(p.preAssessment.espRows[0]?.spsector, "Cloud Service Provider");
    assert.equal(p.preAssessment.espRows[1]?.name, "Northwind SOC");
    assert.ok(p.results.inherited.some((h) => h.espName === "Northwind SOC"));
    assert.equal(p.certificate.leaveBlank.some((c) => c.field === "CMMC UID"), true);
  });

  it("does not write Sector (Other) free-text even when sector is Other", () => {
    const a = emptyAnswers();
    a.sector = "Other";
    a.sectorother = "Custom subsector that must not land on the form";
    const p = buildEmassPrefill(a);
    const sector = p.preAssessment.fields.find((c) => c.field === "Sector");
    assert.equal(sector?.value, "Other");
    const other = p.preAssessment.leaveBlank.find((c) => c.field === "Sector Other");
    assert.equal(other?.value, "");
    assert.equal(
      p.preAssessment.fields.some((c) => c.field === "Sector Other" && c.value),
      false
    );
  });

  it("fills ESP rows only when providers is Yes, with translated status and sector", () => {
    const a = harborlineOscAnswers();
    a.has_sps = "Yes";
    a.sps = [
      {
        ...emptyProvider(),
        name: "Northwind MSP",
        email: "sam.patel@northwindmsp.example",
        poc_last: "Patel",
        poc_first: "Sam",
        poc_phone: "401-555-0100",
        job: "MSP",
        service_desc: "SOC and patching",
        spcmmcstatus: "L2 C3PAO",
        spsector: "Information Technology",
      },
    ];
    const yes = buildEmassPrefill(a);
    assert.equal(yes.preAssessment.espRows.length, 1);
    assert.equal(yes.preAssessment.espRows[0]?.spcmmcstatus, "Level 2");
    assert.equal(yes.preAssessment.espRows[0]?.spsector, "Information Technology");
    assert.equal(yes.preAssessment.espRows[0]?.poc_last, "Patel");

    a.has_sps = "No";
    const no = buildEmassPrefill(a);
    assert.equal(no.preAssessment.espRows.length, 0);
  });

  it("Harborline demo answers produce non-empty ESP rows for eMASS fill", () => {
    const p = buildEmassPrefill(harborlineOscAnswers());
    assert.ok(p.preAssessment.espRows.length >= 2);
    assert.deepEqual(
      p.preAssessment.espRows.map((r) => r.name),
      ["Microsoft", "Northwind SOC"],
    );
    assert.ok(p.results.inherited.some((h) => /Northwind SOC|GCC High CSP|Microsoft/i.test(h.espName)));
  });
});
