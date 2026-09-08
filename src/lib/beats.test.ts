import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { beatsForStep, clampBeatIndex, progressPercent, RECAP_JUMPS, remainingCopy, reviewRailBeatIdx } from "./beats.ts";
import { stepsForPath } from "./path.ts";
import { emptyAnswers, type FormAnswers } from "./types.ts";
import { consentsAccepted, firstIncompleteBeatIdx, firstIncompleteGap, validateBeat, validateStep } from "./validate.ts";
import { emptyProvider } from "./types.ts";

function allBeatIds(a = emptyAnswers()) {
  return stepsForPath("standard").flatMap((s) => beatsForStep(s.id, a).map((b) => `${s.id}:${b.id}`));
}

describe("beatsForStep", () => {
  it("keeps the eight categories and a thinner LCCA beat list", () => {
    const a = emptyAnswers();
    assert.equal(beatsForStep("P1", a).length, 1);
    assert.deepEqual(
      beatsForStep("P1", a).map((b) => b.id),
      ["company"],
    );
    assert.deepEqual(
      beatsForStep("P2", a).map((b) => b.id),
      ["officials"],
    );
    assert.deepEqual(
      beatsForStep("P3", a).map((b) => b.id),
      ["providers"],
    );
    assert.deepEqual(
      beatsForStep("E1", a).map((b) => b.id),
      ["people"],
    );
    assert.deepEqual(
      beatsForStep("E2", a).map((b) => b.id),
      ["lives", "copies", "observer", "enclave", "evidence"],
    );
    assert.deepEqual(
      beatsForStep("E3", a).map((b) => b.id),
      ["crma"],
    );
    assert.deepEqual(
      beatsForStep("E4", a).map((b) => b.id),
      ["monitoring", "readiness"],
    );
    assert.deepEqual(
      beatsForStep("G", a).map((b) => b.id),
      ["recap", "consents"],
    );
    assert.equal(allBeatIds(a).length, 14);
    assert.ok(!allBeatIds(a).some((id) => id.endsWith(":specialized")));
    assert.ok(beatsForStep("P1", a)[0].fields.includes("address1"));
    assert.ok(beatsForStep("P1", a)[0].fields.includes("sector"));
    assert.ok(beatsForStep("P1", a)[0].fields.includes("cui_users"));
    assert.ok(!beatsForStep("P1", a)[0].fields.includes("employees"));
    assert.ok(beatsForStep("P1", a)[0].fields.includes("hlocage"));
    assert.ok(beatsForStep("P1", a)[0].fields.includes("cageinscope"));
    assert.ok(!beatsForStep("E1", a)[0].fields.includes("device_classes"));
    assert.ok(!beatsForStep("E1", a)[0].fields.includes("cui_users"));
    assert.ok(!beatsForStep("E2", a)[0].fields.includes("cui_flow"));
    assert.ok(!beatsForStep("E4", a)[0].fields.includes("contmon_who"));
    assert.ok(beatsForStep("E4", a)[1].fields.includes("ssp_exists"));
    assert.ok(beatsForStep("E4", a)[1].fields.includes("poam_open"));
    assert.ok(beatsForStep("E4", a)[1].fields.includes("fix_during_assessment"));
    assert.ok(!beatsForStep("G", a).some((b) => b.fields.includes("ssp_exists")));
    assert.ok(!beatsForStep("G", a).some((b) => b.fields.includes("poam_open")));
    assert.ok(!beatsForStep("G", a)[1].fields.includes("inventory_exists"));
  });

  it("does not add extra CUI-auth or provider-list beats", () => {
    const withHost = { ...emptyAnswers(), cui_locations: ["GCC High"] };
    assert.deepEqual(
      beatsForStep("E2", withHost).map((b) => b.id),
      ["lives", "copies", "observer", "enclave", "evidence"],
    );
    assert.ok(!beatsForStep("E2", withHost).some((b) => b.id === "auth"));
    const withSp = { ...emptyAnswers(), has_sps: "Yes" };
    assert.deepEqual(
      beatsForStep("P3", withSp).map((b) => b.id),
      ["providers"],
    );
    assert.ok(beatsForStep("E2", withHost)[0].fields.includes("cui_host_fedramp"));
    assert.ok(beatsForStep("P3", withSp)[0].fields.includes("sps"));
  });
});

describe("progressPercent", () => {
  it("is 0 on the intro and increases through beats", () => {
    assert.equal(progressPercent(true, 0, 0, 3, 8), 0);
    const first = progressPercent(false, 0, 0, 3, 8);
    const second = progressPercent(false, 0, 1, 3, 8);
    assert.ok(first >= 8 && first < second);
    assert.equal(progressPercent(false, 7, 0, 1, 8), 100);
  });
});

describe("remainingCopy", () => {
  it("keeps 8-rail copy and moves across intra-step beats", () => {
    const a = remainingCopy(4, 8, 0, 5);
    const b = remainingCopy(4, 8, 4, 5);
    assert.ok(a.includes("1 of 5"));
    assert.ok(b.includes("5 of 5"));
    assert.ok(a.includes("About"));
    assert.ok(b.includes("About"));
    assert.notEqual(a, b);
    assert.match(remainingCopy(0, 8, 0, 2), /1 of 2 · About 16 minutes left/);
  });
});

describe("review rail and recap jumps", () => {
  it("first Review visit lands on recap; gap-jump may land on consents", () => {
    const a = emptyAnswers();
    assert.equal(reviewRailBeatIdx(false, a), 0);
    assert.equal(beatsForStep("G", a)[reviewRailBeatIdx(false, a)].id, "recap");
    assert.equal(beatsForStep("G", a)[reviewRailBeatIdx(true, a)].id, "consents");
  });

  it("recap rows map to the beat that owns the fact", () => {
    assert.deepEqual(RECAP_JUMPS.Organization, { stepId: "P1", beatId: "company" });
    assert.deepEqual(RECAP_JUMPS.Scope, { stepId: "P1", beatId: "company" });
    assert.deepEqual(RECAP_JUMPS.Official, { stepId: "P2", beatId: "officials" });
    assert.deepEqual(RECAP_JUMPS.Providers, { stepId: "P3", beatId: "providers" });
    assert.deepEqual(RECAP_JUMPS["CUI locations"], { stepId: "E2", beatId: "lives" });
    assert.deepEqual(RECAP_JUMPS.Backups, { stepId: "E2", beatId: "copies" });
    assert.deepEqual(RECAP_JUMPS.MFA, { stepId: "E4", beatId: "monitoring" });
    assert.deepEqual(RECAP_JUMPS.SSP, { stepId: "E4", beatId: "readiness" });
    assert.deepEqual(RECAP_JUMPS.Freeze, { stepId: "E4", beatId: "readiness" });
  });
});

describe("clampBeatIndex", () => {
  it("stays inside the current step's beats", () => {
    assert.equal(clampBeatIndex("P1", emptyAnswers(), 99), 0);
    assert.equal(clampBeatIndex("P1", emptyAnswers(), -1), 0);
    assert.equal(clampBeatIndex("E2", emptyAnswers(), 99), 4);
    assert.equal(clampBeatIndex("E3", emptyAnswers(), 99), 0);
    assert.equal(clampBeatIndex("E4", emptyAnswers(), 99), 1);
    assert.equal(clampBeatIndex("G", emptyAnswers(), 99), 1);
  });
});

describe("validateStep LCCA punch list", () => {
  it("requires per-provider facts and Marketplace offering when FedRAMP Authorized", () => {
    const named = {
      ...emptyAnswers(),
      has_sps: "Yes" as const,
      sps: [
        {
          ...emptyProvider(),
          name: "Contoso Cloud",
          email: "poc@contoso.example",
          job: "CSP" as const,
          cui_or_spd: "Stores, processes, or transmits CUI" as const,
          fedramp: "FedRAMP Authorized" as const,
          offering_name: "",
          poc_last: "Patel",
          poc_first: "Sam",
          poc_phone: "555-0100",
          own_cmmc: "No" as const,
          admin_access: "No" as const,
          crm_inherited: "Yes" as const,
          vendor_srm: "Yes" as const,
          spcmmcstatus: "L2 C3PAO" as const,
        },
      ],
    };
    const missing = validateStep("P3", named, "standard");
    assert.ok(missing["sps:0:offering_name"]);
    named.sps[0].offering_name = "Office 365 GCC High";
    assert.equal(validateStep("P3", named, "standard")["sps:0:offering_name"], undefined);
  });

  it("does not require interview titles, device classes, or host offering until Authorized", () => {
    const people = { ...emptyAnswers(), interview_roles_namable: "Yes" as const };
    const e1 = validateStep("E1", people, "standard");
    assert.equal(e1.interview_role_names, undefined);
    assert.equal(e1.device_classes, undefined);
    assert.equal(e1.cui_users, undefined);

    const host = {
      ...emptyAnswers(),
      cui_locations: ["M365 GCC High"],
      cui_host_fedramp: [{ host: "M365 GCC High", fedramp: "FedRAMP Authorized" as const, offering_name: "" }],
    };
    const e2 = validateStep("E2", host, "standard");
    assert.ok(e2["cui_host_fedramp:M365 GCC High:offering"]);
  });

  it("does not require dropped OSC busywork; POA&M conditional only when open", () => {
    const company = {
      ...emptyAnswers(),
      hqname: "Acme",
      uei: "UEI123",
      oscname: "Acme OSC",
      city: "Austin",
      state: "TX",
      hlocage: "1ABC2",
      cageinscope: "1ABC2",
      scopemode: "Enterprise" as const,
    };
    const p1 = validateStep("P1", company, "standard");
    assert.ok(p1.address1);
    assert.ok(p1.sector);
    assert.ok(p1.cui_users);
    assert.equal(p1.employees, undefined);
    assert.equal(p1.zip, undefined);
    assert.equal(p1.businessphone, undefined);
    company.address1 = "1 Main";
    company.sector = "Defense Industrial Base";
    company.cui_users = "10";
    assert.equal(Object.keys(validateStep("P1", company, "standard")).length, 0);

    const mon = {
      ...emptyAnswers(),
      mfa_solution: "Entra",
      mfa_coverage: "All remote and privileged" as const,
    };
    const e4 = validateStep("E4", mon, "standard");
    assert.equal(e4.mfa_solution, undefined);
    assert.match(validateStep("E4", emptyAnswers(), "standard").mfa_solution ?? "", /MFA solution/);
    assert.match(validateStep("E4", emptyAnswers(), "standard").mfa_solution ?? "", /required/);
    assert.equal(validateStep("E4", emptyAnswers(), "standard").mfa_solution, "MFA solution is required. Name the MFA product or service in use.");
    assert.equal(e4.contmon_tool, undefined);
    assert.equal(e4.contmon_who, undefined);
    assert.equal(e4.esp_kinds, undefined);
    assert.ok(e4.ssp_exists);
    assert.ok(e4.poam_open);

    const assets = {
      ...emptyAnswers(),
      has_crma: "No" as const,
      oos_can_reach_cui: "No" as const,
    };
    const e3 = validateStep("E3", assets, "standard");
    assert.equal(e3.specialized_kinds, undefined);
    assert.equal(Object.keys(e3).length, 0);

    const readiness = {
      ...emptyAnswers(),
      mfa_solution: "Entra",
      mfa_coverage: "All remote and privileged" as const,
      ssp_exists: "No" as const,
      poam_open: "No" as const,
      fix_during_assessment: "No" as const,
      freeze_during_assessment: "No" as const,
      migrate_during_assessment: "No" as const,
    };
    const e4Ready = validateStep("E4", readiness, "standard");
    assert.equal(e4Ready.poam_conditional, undefined);
    assert.equal(e4Ready.inventory_exists, undefined);
    readiness.poam_open = "Yes";
    assert.ok(validateStep("E4", readiness, "standard").poam_conditional);
    const g = validateStep("G", emptyAnswers(), "standard");
    assert.equal(g.poam_open, undefined);
    assert.equal(g.ssp_exists, undefined);
    assert.ok(g.consent_nocui);
    assert.ok(g.consent_notassessment);
    assert.equal(consentsAccepted(emptyAnswers()), false);
    assert.equal(consentsAccepted({ ...emptyAnswers(), consent_nocui: true }), false);
    assert.equal(
      consentsAccepted({ ...emptyAnswers(), consent_nocui: true, consent_notassessment: true }),
      true,
    );
  });
});

describe("validateBeat", () => {
  it("only reports errors for the current beat", () => {
    const a = emptyAnswers();
    const who = validateBeat("P1", ["hqname", "uei", "oscname", "city", "state", "address1", "sector", "cui_users", "hlocage"], a, "standard");
    assert.ok(who.hqname);
    assert.ok(who.city);
    assert.ok(who.address1);
    assert.ok(who.sector);
    assert.ok(who.cui_users);
    assert.ok(who.hlocage);
    const none = validateBeat("E3", [], a, "standard");
    assert.deepEqual(none, {});
  });
});

describe("firstIncompleteGap", () => {
  it("points at Company who on an empty form, including consents in the summary", () => {
    const steps = stepsForPath("standard");
    const gap = firstIncompleteGap(emptyAnswers(), "standard", steps, beatsForStep);
    assert.ok(gap);
    assert.equal(gap?.stepId, "P1");
    assert.equal(gap?.stepIdx, 0);
    assert.equal(gap?.beatIdx, 0);
    assert.ok(gap?.errors.hqname);
    assert.ok(gap?.errors.sector);
    assert.ok(gap?.summary.some((s) => s.nav === "Company"));
    const company = gap?.summary.find((s) => s.nav === "Company");
    assert.deepEqual(company?.messages, []);
    const review = gap?.summary.find((s) => s.nav === "Review");
    assert.ok(review?.messages.some((m) => /CUI/.test(m)));
    assert.ok(review?.messages.some((m) => /not a CMMC assessment/.test(m)));
    assert.equal(review?.messages.length, 2);
    const extra = gap?.summary.flatMap((s) => s.messages).filter((m) => !/confirm/i.test(m));
    assert.deepEqual(extra, []);
  });

  it("stays on the one Company beat until address, sector, CUI users, and CAGE are filled", () => {
    const filledWho = {
      ...emptyAnswers(),
      hqname: "Acme",
      uei: "UEI123",
      oscname: "Acme OSC",
      city: "Austin",
      state: "TX",
    };
    const steps = stepsForPath("standard");
    const gap = firstIncompleteGap(filledWho, "standard", steps, beatsForStep);
    assert.equal(gap?.stepId, "P1");
    assert.equal(gap?.beatIdx, 0);
    assert.ok(gap?.errors.address1 || gap?.errors.sector || gap?.errors.cui_users || gap?.errors.hlocage);
    assert.equal(gap?.errors.hqname, undefined);
  });

  it("uses the same firstIncomplete path for CAGE, Officials email, CUI host, MFA, and consent", () => {
    const steps = stepsForPath("standard");
    const companyDone = {
      ...emptyAnswers(),
      hqname: "Acme",
      uei: "UEI123",
      oscname: "Acme OSC",
      address1: "1 Main",
      city: "Austin",
      state: "TX",
      country: "United States",
      sector: "Defense Industrial Base" as const,
      cui_users: "10",
      hlocage: "1ABC2",
      cageinscope: "1ABC2",
      scopemode: "Enterprise" as const,
    };
    const officialsEmail = firstIncompleteGap(companyDone, "standard", steps, beatsForStep);
    assert.equal(officialsEmail?.stepId, "P2");
    assert.equal(officialsEmail?.beatIdx, 0);
    assert.ok(officialsEmail?.errors.ao_email || officialsEmail?.errors.ao_last);

    const throughPeople = {
      ...companyDone,
      ao_last: "Chen",
      ao_first: "Maya",
      ao_title: "CISO",
      ao_email: "maya+tag@alder.example",
      ao_phone: "555",
      tpoc_last: "Ortiz",
      tpoc_first: "Luis",
      tpoc_title: "IT",
      tpoc_email: "luis@alder.example",
      tpoc_phone: "555",
      has_sps: "No" as const,
      interview_roles_namable: "No" as const,
    };
    const cuiHost = firstIncompleteGap(throughPeople, "standard", steps, beatsForStep);
    assert.equal(cuiHost?.stepId, "E2");
    assert.equal(cuiHost?.beatIdx, 0);
    assert.ok(cuiHost?.errors.cui_locations);

    const throughCui = {
      ...throughPeople,
      cui_locations: ["N/A / not sure"] as FormAnswers["cui_locations"],
      cui_leaves_portable: "No" as const,
      vdi_download_print: "N/A" as const,
      cui_off_hq: "No" as const,
      cui_backup_commercial: "N/A" as const,
      cui_backup_where: "N/A" as const,
      physical_cui_observe: "No" as const,
      virtual_tour_exposes_cui: "No" as const,
      dlp_blocks_screenshare: "N/A" as const,
      env_mode: "N/A" as const,
      boundary_defined: "No" as const,
      separation: "N/A" as const,
      network_diagram: "No" as const,
      diagram_vs_matrix: "No" as const,
      has_crma: "No" as const,
      oos_can_reach_cui: "N/A" as const,
    };
    const mfa = firstIncompleteGap(throughCui, "standard", steps, beatsForStep);
    assert.equal(mfa?.stepId, "E4");
    assert.ok(mfa?.errors.mfa_solution || mfa?.errors.mfa_coverage);

    const mfaOnly = {
      ...throughCui,
      mfa_solution: "Entra ID",
      mfa_coverage: "All remote and privileged" as const,
    };
    const readinessGap = firstIncompleteGap(mfaOnly, "standard", steps, beatsForStep);
    assert.equal(readinessGap?.stepId, "E4");
    assert.equal(readinessGap?.beatIdx, 1);
    assert.ok(readinessGap?.errors.ssp_exists || readinessGap?.errors.poam_open);

    const throughMfa = {
      ...mfaOnly,
      ssp_exists: "No" as const,
      poam_open: "N/A" as const,
      fix_during_assessment: "No" as const,
      freeze_during_assessment: "No" as const,
      migrate_during_assessment: "No" as const,
    };
    const consent = firstIncompleteGap(throughMfa, "standard", steps, beatsForStep);
    assert.equal(consent?.stepId, "G");
    assert.equal(consent?.beatIdx, 1);
    assert.ok(consent?.errors.consent_nocui);
    assert.ok(consent?.errors.consent_notassessment);

    const consent2Only = { ...throughMfa, consent_nocui: true };
    const onlySecond = firstIncompleteGap(consent2Only, "standard", steps, beatsForStep);
    assert.equal(onlySecond?.stepId, "G");
    assert.equal(onlySecond?.beatIdx, 1);
    assert.equal(onlySecond?.errors.consent_nocui, undefined);
    assert.ok(onlySecond?.errors.consent_notassessment);
    assert.deepEqual(Object.keys(onlySecond?.errors ?? {}), ["consent_notassessment"]);
    const reviewMsgs = onlySecond?.summary.find((s) => s.nav === "Review")?.messages ?? [];
    assert.equal(reviewMsgs.length, 1);
    assert.equal(reviewMsgs[0], onlySecond?.errors.consent_notassessment);

    const bothConsents = { ...consent2Only, consent_notassessment: true };
    assert.equal(firstIncompleteGap(bothConsents, "standard", steps, beatsForStep), null);
  });

  it("Harborline-style CUI hosts are not a false gap when only consent 2 is missing", () => {
    const steps = stepsForPath("standard");
    const harbor = {
      ...emptyAnswers(),
      hqname: "Harborline Precision",
      uei: "UEI123",
      oscname: "Harborline Precision",
      address1: "18 Thames St",
      city: "Newport",
      state: "RI",
      country: "United States",
      sector: "Defense Industrial Base" as const,
      cui_users: "22",
      hlocage: "1ABC2",
      cageinscope: "1ABC2",
      scopemode: "Enclave" as const,
      scopedesc: "GCC High plus on-prem file share.",
      ao_last: "Chen",
      ao_first: "Maya",
      ao_title: "CISO",
      ao_email: "maya@harborline.example",
      ao_phone: "555",
      tpoc_last: "Ortiz",
      tpoc_first: "Luis",
      tpoc_title: "IT",
      tpoc_email: "luis@harborline.example",
      tpoc_phone: "555",
      has_sps: "No" as const,
      interview_roles_namable: "No" as const,
      cui_locations: ["M365 GCC High", "On-prem file shares / servers"],
      cui_host_fedramp: [
        { host: "M365 GCC High", fedramp: "FedRAMP Authorized" as const, offering_name: "Office 365 GCC High" },
        { host: "On-prem file shares / servers", fedramp: "N/A" as const, offering_name: "" },
      ],
      cui_leaves_portable: "No" as const,
      vdi_download_print: "N/A" as const,
      cui_off_hq: "No" as const,
      cui_backup_commercial: "N/A" as const,
      cui_backup_where: "N/A" as const,
      physical_cui_observe: "No" as const,
      virtual_tour_exposes_cui: "No" as const,
      dlp_blocks_screenshare: "N/A" as const,
      env_mode: "GCC High tenant" as const,
      boundary_defined: "Yes" as const,
      separation: "Both" as const,
      network_diagram: "Yes" as const,
      diagram_vs_matrix: "Yes" as const,
      has_crma: "No" as const,
      oos_can_reach_cui: "No" as const,
      mfa_solution: "Entra ID",
      mfa_coverage: "All remote and privileged" as const,
      ssp_exists: "No" as const,
      poam_open: "N/A" as const,
      fix_during_assessment: "No" as const,
      freeze_during_assessment: "No" as const,
      migrate_during_assessment: "No" as const,
      consent_nocui: true,
      consent_notassessment: false,
    };
    const gap = firstIncompleteGap(harbor, "standard", steps, beatsForStep);
    assert.equal(gap?.stepId, "G");
    assert.equal(gap?.beatIdx, 1);
    assert.deepEqual(Object.keys(gap?.errors ?? {}), ["consent_notassessment"]);
    assert.equal(gap?.errors.cui_locations, undefined);
    assert.equal(gap?.errors.cui_host_fedramp, undefined);
    const reviewMsgs = gap?.summary.find((s) => s.nav === "Review")?.messages ?? [];
    assert.equal(reviewMsgs.length, 1);
    assert.equal(reviewMsgs[0], gap?.errors.consent_notassessment);
  });
});

describe("firstIncompleteBeatIdx", () => {
  it("Review last beat is consents; firstIncomplete on G lands there when only consents are missing", () => {
    const almost = {
      ...emptyAnswers(),
      ssp_exists: "No" as const,
      poam_open: "N/A" as const,
      fix_during_assessment: "No" as const,
      freeze_during_assessment: "No" as const,
      migrate_during_assessment: "No" as const,
    };
    assert.equal(firstIncompleteBeatIdx("G", almost, "standard", beatsForStep), 1);
    assert.equal(firstIncompleteBeatIdx("G", emptyAnswers(), "standard", beatsForStep), 1);
    const gBeats = beatsForStep("G", emptyAnswers());
    assert.equal(gBeats[gBeats.length - 1].id, "consents");
    assert.equal(gBeats[0].id, "recap");
  });

  it("lands on the later CUI-path beat when earlier ones are complete", () => {
    const a = {
      ...emptyAnswers(),
      cui_locations: ["N/A / not sure"],
      cui_leaves_portable: "No" as const,
      vdi_download_print: "N/A" as const,
      cui_off_hq: "No" as const,
      cui_backup_commercial: "N/A" as const,
      cui_backup_where: "N/A" as const,
    };
    assert.equal(firstIncompleteBeatIdx("E2", a, "standard", beatsForStep), 2);
    assert.equal(firstIncompleteBeatIdx("P1", emptyAnswers(), "standard", beatsForStep), 0);
    const mfaDone = {
      ...emptyAnswers(),
      mfa_solution: "Entra ID",
      mfa_coverage: "All remote and privileged" as const,
    };
    assert.equal(firstIncompleteBeatIdx("E4", mfaDone, "standard", beatsForStep), 1);
  });
});
