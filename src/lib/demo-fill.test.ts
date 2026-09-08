import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { applyCuiLocationChange, applyHqNameChange } from "./answers.ts";
import { beatsForStep } from "./beats.ts";
import { answersIfDemoQuery, harborlineOscAnswers, intakeDemoQuery } from "./demo-fill.ts";
import { normalizeAnswers, validateNormalizedAnswers } from "./normalize-answers.ts";
import { stepsForPath } from "./path.ts";
import { emptyAnswers } from "./types.ts";
import { firstIncompleteGap } from "./validate.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..");

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const DEMO_BUTTON = />\s*Demo\s*</;
const SLOGAN = /slogan/i;

describe("hidden tester fill legality", () => {
  it("public intake has no demo chrome, Demo button, or slogan", () => {
    const welcome = src("components/form/WelcomeIntro.tsx");
    const form = src("components/form/IntakeForm.tsx");
    const intake = src("app/intake/page.tsx");
    const pages = readFileSync(join(repo, "docs", "powerpages", "osc-discovery.html"), "utf8");
    for (const text of [welcome, form, intake, pages]) {
      assert.equal(DEMO_BUTTON.test(text), false);
      assert.equal(SLOGAN.test(text), false);
      assert.equal(text.includes("Try a demo"), false);
      assert.equal(text.includes("Demo fill"), false);
      assert.equal(text.includes("demo chrome"), false);
    }
    assert.match(welcome, />\s*Start\s*</);
    assert.equal(welcome.includes("onDemo"), false);
    assert.equal(form.includes("onDemo"), false);
    assert.equal(pages.includes("id=\"pscDemo\""), false);
    assert.equal(pages.includes("id=\"pscStart\""), true);
  });

  it("Start does not fill answers", () => {
    const welcome = src("components/form/WelcomeIntro.tsx");
    const form = src("components/form/IntakeForm.tsx");
    const pages = readFileSync(join(repo, "docs", "powerpages", "osc-discovery.html"), "utf8");
    assert.equal(welcome.includes("answersIfDemoQuery"), false);
    assert.equal(welcome.includes("harborlineOscAnswers"), false);
    assert.equal(welcome.includes("sampleHarborline"), false);
    assert.equal(welcome.includes("sampleHealthy"), false);
    const begin = form.match(/const begin = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? "";
    assert.ok(begin.includes("setWelcome(false)"));
    assert.equal(begin.includes("answersIfDemoQuery"), false);
    assert.equal(begin.includes("harborlineOscAnswers"), false);
    assert.equal(begin.includes("sampleHarborline"), false);
    const pagesBegin = pages.match(/function begin\(\)\{[^}]+\}/)?.[0] ?? "";
    assert.ok(pagesBegin.includes("started = true"));
    assert.equal(pagesBegin.includes("applyHarborlineFill"), false);
    assert.equal(pagesBegin.includes("Harborline"), false);
  });

  it("absent demo=1 leaves answers empty", () => {
    assert.equal(intakeDemoQuery(""), false);
    assert.equal(intakeDemoQuery("?"), false);
    assert.equal(intakeDemoQuery("foo=1"), false);
    assert.equal(intakeDemoQuery("?demo="), false);
    assert.equal(intakeDemoQuery("?demo=true"), false);
    assert.equal(intakeDemoQuery("?demo=0"), false);
    assert.equal(answersIfDemoQuery(""), null);
    assert.equal(answersIfDemoQuery("/intake"), null);
    assert.equal(answersIfDemoQuery("?other=1"), null);
    assert.deepEqual(emptyAnswers().consent_nocui, false);
    assert.equal(emptyAnswers().hqname, "");
  });

  it("demo=1 seeds a complete Harborline OSC that has no submit gap", () => {
    assert.equal(intakeDemoQuery("?demo=1"), true);
    assert.equal(intakeDemoQuery("demo=1"), true);
    assert.equal(intakeDemoQuery("?x=2&demo=1"), true);
    const filled = answersIfDemoQuery("?demo=1");
    assert.ok(filled);
    const a = filled ?? harborlineOscAnswers();
    assert.equal(a.hqname, "Harborline Precision LLC");
    assert.equal(a.oscname, "Harborline Precision");
    assert.match(a.uei, /^[A-Z0-9]{12}$/);
    assert.match(a.hlocage, /^[A-Z0-9]{5}$/);
    assert.match(a.ao_email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    assert.match(a.tpoc_email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    assert.equal(a.consent_nocui, true);
    assert.equal(a.consent_notassessment, true);
    assert.ok((a.cui_locations || []).some((h) => h !== "N/A / not sure"));
    assert.ok((a.cui_host_fedramp || []).some((t) => t.fedramp));
    assert.equal(a.cui_backup_where, "GCC High");
    assert.equal(a.address1, "18 Thames St");
    assert.equal(a.country, "United States");
    assert.equal(a.sector, "Defense Industrial Base");
    assert.equal(a.cui_users, "22");
    assert.equal(a.employees, "85");
    assert.equal(a.has_sps, "Yes");
    assert.equal(a.sps.length, 2);
    assert.equal(a.sps[0]?.name, "Microsoft");
    assert.equal(a.sps[0]?.job, "CSP");
    assert.equal(a.sps[0]?.fedramp, "FedRAMP Authorized");
    assert.equal(a.sps[0]?.offering_name, "Office 365 GCC High");
    assert.equal(a.sps[0]?.spsector, "Cloud Service Provider");
    assert.equal(a.sps[1]?.name, "Northwind SOC");
    assert.equal(a.sps[1]?.job, "MSP");
    assert.ok(a.sps[1]?.service_desc.trim());
    assert.equal(a.sps[1]?.admin_access, a.esp_admin_access);
    assert.match(a.esp_who, /Microsoft/);
    assert.match(a.esp_who, /Northwind SOC/);
    assert.ok(a.mfa_solution.trim());
    assert.equal(a.ssp_exists, "Yes");
    const gap = firstIncompleteGap(a, "standard", stepsForPath("standard"), beatsForStep);
    assert.equal(gap, null);
    const normalized = normalizeAnswers(a);
    assert.equal(normalized.ok, true);
    if (normalized.ok) {
      assert.equal(validateNormalizedAnswers(normalized.answers), null);
    }
  });
});

describe("hidden tester fill after seed", () => {
  it("editing HQ after Harborline fill does not overwrite the distinct OSC name", () => {
    const filled = harborlineOscAnswers();
    assert.equal(filled.hqname, "Harborline Precision LLC");
    assert.equal(filled.oscname, "Harborline Precision");
    const after = applyHqNameChange(filled, "Harborline Precision LLC — HQ");
    assert.equal(after.hqname, "Harborline Precision LLC — HQ");
    assert.equal(after.oscname, "Harborline Precision");
    assert.equal(after.dba, filled.dba);
    assert.equal(after.uei, filled.uei);
  });

  it("unchecking a CUI host after fill still drops the host", () => {
    const filled = harborlineOscAnswers();
    assert.ok(filled.cui_locations.includes("On-prem file shares / servers"));
    const after = applyCuiLocationChange(filled, ["M365 GCC High"]);
    assert.deepEqual(after.cui_locations, ["M365 GCC High"]);
    assert.equal(after.cui_host_fedramp.length, 1);
    assert.equal(after.cui_host_fedramp[0].host, "M365 GCC High");
    assert.equal(after.cui_host_fedramp[0].fedramp, "FedRAMP Authorized");
    assert.equal(after.hqname, filled.hqname);
    assert.equal(after.consent_notassessment, true);
  });

  it("filled answers are not rebuilt from the current rail step", () => {
    const a = harborlineOscAnswers();
    const steps = stepsForPath("standard");
    for (const step of steps) {
      const beats = beatsForStep(step.id, a);
      assert.ok(beats.length >= 1);
      assert.equal(a.oscname, "Harborline Precision");
      assert.equal(a.cui_locations.includes("M365 GCC High"), true);
    }
    const form = src("components/form/IntakeForm.tsx");
    assert.ok(form.includes("answersIfDemoQuery"));
    assert.equal(form.includes("answersIfDemoQuery(window.location.search)"), true);
    const pages = readFileSync(join(repo, "docs", "powerpages", "osc-discovery.html"), "utf8");
    assert.ok(pages.includes("function applyHarborlineFill"));
    assert.ok(pages.includes('get("demo") === "1"') || pages.includes("demo=1"));
    assert.ok(pages.includes("function withToken(cb)"));
    const fillStart = pages.indexOf("function applyHarborlineFill()");
    const fillEnd = pages.indexOf("if (intakeDemoQuery())");
    const fill = fillStart >= 0 && fillEnd > fillStart ? pages.slice(fillStart, fillEnd) : "";
    assert.ok(fill.includes('A.psc_address1 = "18 Thames St"'));
    assert.ok(fill.includes('A.psc_country = "United States"'));
    assert.ok(fill.includes('A.psc_sector = "Defense Industrial Base"'));
    assert.ok(fill.includes('A.psc_cui_users = "22"'));
    assert.equal(fill.includes('A.psc_employees = "85"'), false);
    assert.ok(fill.includes('A.psc_has_sps = "No"'));
    assert.equal(fill.includes('A.psc_has_sps = "Yes"'), false);
    assert.ok(fill.includes("SPS = []") || fill.includes("SPS=[]"));
    assert.ok(fill.includes("Tenant child columns"));
    assert.ok(pages.includes("function encodeProvider"));
    assert.ok(pages.includes("Yes encoding"));
  });
});
