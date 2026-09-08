import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCuiLocationChange, applyHasSpsChange, applyHqNameChange, patchAnswers, patchAnswersMany, syncCuiHostFedramp } from "./answers.ts";
import { emptyAnswers, emptyProvider } from "./types.ts";

describe("CUI location toggle", () => {
  it("keeps checked hosts when FedRAMP tags are synced from the same previous state", () => {
    const start = emptyAnswers();
    const locs = ["M365 GCC High", "On-prem file shares / servers"];
    const next = applyCuiLocationChange(start, locs);
    assert.deepEqual(next.cui_locations, locs);
    assert.equal(next.cui_host_fedramp.length, 2);
    assert.deepEqual(
      next.cui_host_fedramp.map((t) => t.host),
      locs,
    );
    assert.equal(next.cui_host_fedramp[0].fedramp, "");
    assert.equal(next.cui_host_fedramp[1].fedramp, "");
  });

  it("unchecking a host drops it and its FedRAMP row; leftover hosts stay", () => {
    const selected = applyCuiLocationChange(emptyAnswers(), [
      "M365 GCC High",
      "On-prem file shares / servers",
    ]);
    const withAuth = patchAnswers(selected, "cui_host_fedramp", [
      { host: "M365 GCC High", fedramp: "FedRAMP Authorized", offering_name: "Office 365 GCC High" },
      { host: "On-prem file shares / servers", fedramp: "N/A", offering_name: "" },
    ]);
    const afterUncheck = applyCuiLocationChange(withAuth, ["M365 GCC High"]);
    assert.deepEqual(afterUncheck.cui_locations, ["M365 GCC High"]);
    assert.equal(afterUncheck.cui_host_fedramp.length, 1);
    assert.equal(afterUncheck.cui_host_fedramp[0].host, "M365 GCC High");
    assert.equal(afterUncheck.cui_host_fedramp[0].fedramp, "FedRAMP Authorized");
    assert.equal(afterUncheck.cui_host_fedramp[0].offering_name, "Office 365 GCC High");
  });

  it("N/A / not sure is not a host, so FedRAMP tags stay empty", () => {
    const next = applyCuiLocationChange(emptyAnswers(), ["N/A / not sure"]);
    assert.deepEqual(next.cui_locations, ["N/A / not sure"]);
    assert.deepEqual(next.cui_host_fedramp, []);
  });

  it("a later single-key patch from the previous snapshot drops locations (the stale-setState bug)", () => {
    const start = emptyAnswers();
    const locs = ["M365 GCC High"];
    const first = patchAnswers(start, "cui_locations", locs);
    const secondFromStale = patchAnswers(start, "cui_host_fedramp", syncCuiHostFedramp(locs, start.cui_host_fedramp));
    assert.deepEqual(first.cui_locations, locs);
    assert.deepEqual(secondFromStale.cui_locations, []);
    const composed = patchAnswers(first, "cui_host_fedramp", syncCuiHostFedramp(locs, first.cui_host_fedramp));
    assert.deepEqual(composed.cui_locations, locs);
    assert.equal(composed.cui_host_fedramp.length, 1);
  });

  it("Providers No→Yes keeps an already-entered provider row", () => {
    const named = {
      ...emptyProvider(),
      name: "Northwind MSP",
      email: "sam.patel@northwindmsp.example",
      job: "MSP" as const,
    };
    const yes = patchAnswers(emptyAnswers(), "sps", [named]);
    const withYes = applyHasSpsChange(yes, "Yes");
    assert.equal(withYes.has_sps, "Yes");
    assert.equal(withYes.sps[0]?.name, "Northwind MSP");
    const no = applyHasSpsChange(withYes, "No");
    assert.equal(no.has_sps, "No");
    assert.equal(no.sps[0]?.name, "Northwind MSP");
    const back = applyHasSpsChange(no, "Yes");
    assert.equal(back.has_sps, "Yes");
    assert.equal(back.sps.length, 1);
    assert.equal(back.sps[0]?.name, "Northwind MSP");
    assert.equal(back.sps[0]?.email, "sam.patel@northwindmsp.example");
  });

  it("patchAnswersMany writes both keys in one object so neither is dropped", () => {
    const locs = ["M365 GCC High", "On-prem file shares / servers"];
    const next = patchAnswersMany(emptyAnswers(), {
      cui_locations: locs,
      cui_host_fedramp: syncCuiHostFedramp(locs, []),
    });
    assert.deepEqual(next.cui_locations, locs);
    assert.equal(next.cui_host_fedramp.length, 2);
  });
});

describe("HQ name → OSC name sync", () => {
  it("copies HQ into empty OSC (type or paste)", () => {
    const next = applyHqNameChange(emptyAnswers(), "Harborline Precision LLC");
    assert.equal(next.hqname, "Harborline Precision LLC");
    assert.equal(next.oscname, "Harborline Precision LLC");
    assert.equal(next.uei, "");
  });

  it("keeps copying while OSC still matches the previous HQ value", () => {
    const synced = applyHqNameChange(emptyAnswers(), "Acme");
    const next = applyHqNameChange(synced, "Acme Holdings");
    assert.equal(next.hqname, "Acme Holdings");
    assert.equal(next.oscname, "Acme Holdings");
  });

  it("stops overwriting after an independent OSC edit", () => {
    const synced = applyHqNameChange(emptyAnswers(), "Acme");
    const owned = patchAnswers(synced, "oscname", "Acme OSC");
    const next = applyHqNameChange(owned, "Acme Holdings");
    assert.equal(next.hqname, "Acme Holdings");
    assert.equal(next.oscname, "Acme OSC");
  });

  it("resumes syncing after OSC is cleared", () => {
    const synced = applyHqNameChange(emptyAnswers(), "Acme");
    const owned = patchAnswers(synced, "oscname", "Acme OSC");
    const cleared = patchAnswers(owned, "oscname", "");
    const next = applyHqNameChange(cleared, "Acme Holdings");
    assert.equal(next.hqname, "Acme Holdings");
    assert.equal(next.oscname, "Acme Holdings");
  });

  it("treats whitespace-only OSC as empty so sync resumes", () => {
    const synced = applyHqNameChange(emptyAnswers(), "Acme");
    const spaces = patchAnswers(synced, "oscname", "   ");
    const next = applyHqNameChange(spaces, "Acme Holdings");
    assert.equal(next.oscname, "Acme Holdings");
  });

  it("clears OSC when a synced HQ is cleared", () => {
    const synced = applyHqNameChange(emptyAnswers(), "Acme");
    const next = applyHqNameChange(synced, "");
    assert.equal(next.hqname, "");
    assert.equal(next.oscname, "");
  });

  it("does not clear a user-owned OSC when HQ is cleared", () => {
    const synced = applyHqNameChange(emptyAnswers(), "Acme");
    const owned = patchAnswers(synced, "oscname", "Acme OSC");
    const next = applyHqNameChange(owned, "");
    assert.equal(next.hqname, "");
    assert.equal(next.oscname, "Acme OSC");
  });

  it("does not overwrite a pre-filled OSC that already differs (demo / restore)", () => {
    const demo = {
      ...emptyAnswers(),
      hqname: "Harborline Precision LLC",
      oscname: "Harborline Precision",
    };
    const next = applyHqNameChange(demo, "Harborline Precision LLC — HQ");
    assert.equal(next.hqname, "Harborline Precision LLC — HQ");
    assert.equal(next.oscname, "Harborline Precision");
  });

  it("keeps syncing after session restore when both still match", () => {
    const restored = { ...emptyAnswers(), hqname: "Acme", oscname: "Acme" };
    const next = applyHqNameChange(restored, "Acme Inc");
    assert.equal(next.hqname, "Acme Inc");
    assert.equal(next.oscname, "Acme Inc");
  });

  it("does not overwrite OSC when the user typed OSC first", () => {
    const oscFirst = { ...emptyAnswers(), oscname: "Acme OSC" };
    const next = applyHqNameChange(oscFirst, "Acme Holdings");
    assert.equal(next.hqname, "Acme Holdings");
    assert.equal(next.oscname, "Acme OSC");
  });
});
