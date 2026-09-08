import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { beatsForStep } from "./beats.ts";
import { harborlineOscAnswers } from "./demo-fill.ts";
import { stepsForPath } from "./path.ts";
import { emptyAnswers } from "./types.ts";
import {
  cageFieldError,
  companyCageErrors,
  firstIncompleteGap,
  isValidCage,
  isValidCageList,
  normalizeCage,
  normalizeCageList,
  normalizeCageTyping,
  validateBeat,
  validateStep,
} from "./validate.ts";

function companyFilled(overrides: Record<string, string> = {}) {
  return {
    ...emptyAnswers(),
    hqname: "Harborline Precision LLC",
    uei: "HBR1LN0SC014",
    oscname: "Harborline Precision",
    address1: "18 Thames St",
    city: "Newport",
    state: "RI",
    country: "United States",
    sector: "Defense Industrial Base" as const,
    cui_users: "22",
    hlocage: "8H2LP",
    cageinscope: "8H2LP",
    scopemode: "Enterprise" as const,
    ...overrides,
  };
}

describe("CAGE format (HLO + in-scope)", () => {
  it("rejects clearly invalid CAGE values", () => {
    for (const bad of ["INVALID", "12", "ABC-1", "!!!!!", "CAGE", "8H2LPX", "8H2L"]) {
      assert.equal(isValidCage(bad), false, bad);
      const e = validateStep("P1", companyFilled({ hlocage: bad }), "standard");
      assert.equal(e.hlocage, "CAGE must be 5 letters or digits.", bad);
      assert.equal(cageFieldError("hlocage", bad), "CAGE must be 5 letters or digits.", bad);
    }
  });

  it("normalizes case-insensitively and treats lowercase as valid", () => {
    assert.equal(normalizeCageTyping("8h2lp"), "8H2LP");
    assert.equal(normalizeCage(" 8h2lp "), "8H2LP");
    assert.equal(normalizeCageList(" 8h2lp ;  1h9qx "), "8H2LP; 1H9QX");
    assert.equal(isValidCage("8h2lp"), true);
    assert.equal(cageFieldError("hlocage", "8h2lp"), undefined);
    assert.equal(cageFieldError("cageinscope", "8h2lp; 1h9qx"), undefined);
  });

  it("Company Next gate rejects short CAGE like 12 and empty, without other P1 fields", () => {
    const short = companyCageErrors(companyFilled({ hlocage: "12", cageinscope: "8H2LP" }));
    assert.equal(short.hlocage, "CAGE must be 5 letters or digits.");
    assert.equal(short.cageinscope, undefined);
    assert.equal(short.hqname, undefined);

    const empty = companyCageErrors(companyFilled({ hlocage: "", cageinscope: "" }));
    assert.equal(empty.hlocage, "Highest Level Owner CAGE is required.");
    assert.equal(empty.cageinscope, "In-scope CAGE code(s) required (semicolons if several).");

    const ok = companyCageErrors(companyFilled({ hlocage: "8h2lp", cageinscope: "8H2LP" }));
    assert.deepEqual(ok, {});

    const onlyCage = companyCageErrors({
      ...emptyAnswers(),
      hlocage: "12",
      cageinscope: "12",
    });
    assert.equal(onlyCage.hlocage, "CAGE must be 5 letters or digits.");
    assert.equal(onlyCage.cageinscope, "In-scope CAGE must be 5-character codes, separated by semicolons.");
    assert.equal(Object.keys(onlyCage).sort().join(","), "cageinscope,hlocage");
  });

  it("rejects invalid in-scope CAGE lists", () => {
    for (const bad of ["INVALID", "8H2LP,1H9QX", "8H2LP 1H9QX", "8H2LP;BAD", "8H2LP;"]) {
      assert.equal(isValidCageList(bad), false, bad);
      const e = validateStep("P1", companyFilled({ cageinscope: bad }), "standard");
      assert.equal(
        e.cageinscope,
        "In-scope CAGE must be 5-character codes, separated by semicolons.",
        bad,
      );
    }
  });

  it("accepts Harborline demo CAGEs and a semicolon list", () => {
    for (const good of ["8H2LP", "1H9QX", "4P0TT"]) {
      assert.equal(isValidCage(good), true, good);
      assert.equal(isValidCageList(good), true, good);
      const e = validateStep("P1", companyFilled({ hlocage: good, cageinscope: good }), "standard");
      assert.equal(e.hlocage, undefined, good);
      assert.equal(e.cageinscope, undefined, good);
    }
    const list = validateStep("P1", companyFilled({ cageinscope: "8H2LP; 1H9QX" }), "standard");
    assert.equal(list.cageinscope, undefined);
    assert.equal(Object.keys(validateStep("P1", companyFilled(), "standard")).length, 0);
  });

  it("shows the format error on the field beat and on Submit jump", () => {
    const bad = companyFilled({ hlocage: "INVALID" });
    const beat = validateBeat(
      "P1",
      beatsForStep("P1", bad)[0].fields,
      bad,
      "standard",
    );
    assert.equal(beat.hlocage, "CAGE must be 5 letters or digits.");

    const gap = firstIncompleteGap(bad, "standard", stepsForPath("standard"), beatsForStep);
    assert.equal(gap?.stepId, "P1");
    assert.equal(gap?.beatIdx, 0);
    assert.equal(gap?.errors.hlocage, "CAGE must be 5 letters or digits.");
  });

  it("keeps Harborline demo answers valid for Submit", () => {
    const a = harborlineOscAnswers();
    assert.equal(isValidCage(a.hlocage), true);
    assert.equal(isValidCageList(a.cageinscope), true);
    assert.equal(firstIncompleteGap(a, "standard", stepsForPath("standard"), beatsForStep), null);
  });
});
