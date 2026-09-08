import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSubmitBody } from "../../../src/lib/submit-body.ts";
import { harborlineOscAnswers } from "../../../src/lib/demo-fill.ts";

describe("submit JSON shape (shared parseSubmitBody)", () => {
  it("rejects invalid JSON and unexpected fields", () => {
    assert.equal(parseSubmitBody("not-json").ok, false);
    assert.equal(parseSubmitBody("[]").ok, false);
    const extra = parseSubmitBody(JSON.stringify({ answers: harborlineOscAnswers(), sneak: true }));
    assert.equal(extra.ok, false);
    if (!extra.ok) assert.match(extra.error, /Unexpected field/);
    const dropOnPublic = parseSubmitBody(
      JSON.stringify({ answers: harborlineOscAnswers(), drop: { folderId: "1" } }),
    );
    assert.equal(dropOnPublic.ok, false);
  });

  it("rejects incomplete answers", () => {
    const empty = parseSubmitBody(JSON.stringify({ answers: {} }));
    assert.equal(empty.ok, false);
    const noConsent = structuredClone(harborlineOscAnswers());
    noConsent.consent_nocui = false;
    const parsed = parseSubmitBody(JSON.stringify({ answers: noConsent }));
    assert.equal(parsed.ok, false);
  });

  it("accepts Harborline OSC Discovery answers", () => {
    const parsed = parseSubmitBody(JSON.stringify({ answers: harborlineOscAnswers() }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.answers.oscname, "Harborline Precision");
      assert.equal(parsed.answers.consent_nocui, true);
      assert.equal(parsed.answers.evidence_share, "Box");
    }
  });

  it("rejects oversized bodies", () => {
    const huge = "x".repeat(65 * 1024);
    const parsed = parseSubmitBody(huge);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.status, 413);
  });
});
