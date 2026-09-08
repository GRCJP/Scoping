import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSubmissionId, newOpaqueId, newSubmissionId, SUBMISSION_ID_RE, successPathForId } from "./ids.ts";

describe("submission ids (PSC-02)", () => {
  it("newSubmissionId is a CSPRNG UUID and matches the path allowlist", () => {
    const id = newSubmissionId();
    assert.equal(id.includes("osc_"), false);
    assert.ok(SUBMISSION_ID_RE.test(id));
    assert.ok(isSubmissionId(id));
    assert.notEqual(newSubmissionId(), newSubmissionId());
  });

  it("rejects guessable and malformed path ids", () => {
    assert.equal(isSubmissionId("osc_abc123def456"), false);
    assert.equal(isSubmissionId("osc_xxxxxxxxxxxx"), false);
    assert.equal(isSubmissionId("../secret"), false);
    assert.equal(isSubmissionId("not-a-uuid"), false);
    assert.equal(isSubmissionId(""), false);
    assert.equal(isSubmissionId(null), false);
    assert.equal(isSubmissionId("00000000-0000-0000-0000-000000000000"), false);
  });

  it("successPathForId is /success/[id] only for real submission ids", () => {
    const id = newSubmissionId();
    assert.equal(successPathForId(id), `/success/${id}`);
    assert.equal(successPathForId("osc_abc123def456"), null);
    assert.equal(successPathForId("/success"), null);
  });

  it("newOpaqueId is 128 bits of hex (plus optional prefix)", () => {
    const id = newOpaqueId("fld_");
    assert.match(id, /^fld_[0-9a-f]{32}$/);
    assert.notEqual(newOpaqueId(), newOpaqueId());
  });
});
