import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessorSecretMatches,
  decideAssessorGate,
  decideAssessorSessionLogin,
  isAssessorGatedPath,
  isAssessorPublicPath,
  isLoopbackHostname,
  providedAssessorSecretFrom,
  timingSafeEqualString,
} from "./assessor-auth.ts";

describe("assessor auth helpers (PSC-01, PSC-11)", () => {
  it("compares secrets in constant time and rejects mismatches", () => {
    assert.equal(timingSafeEqualString("alpha", "alpha"), true);
    assert.equal(timingSafeEqualString("alpha", "beta"), false);
    assert.equal(timingSafeEqualString("short", "longer-key"), false);
    assert.equal(assessorSecretMatches("secret", "secret"), true);
    assert.equal(assessorSecretMatches("secret", "other"), false);
    assert.equal(assessorSecretMatches("", "secret"), false);
    assert.equal(assessorSecretMatches("secret", ""), false);
  });

  it("fails closed when the key is empty unless the host is loopback", () => {
    assert.equal(decideAssessorGate({ configuredKey: "", provided: "", loopback: false }), "deny");
    assert.equal(decideAssessorGate({ configuredKey: "", provided: "x", loopback: false }), "deny");
    assert.equal(decideAssessorGate({ configuredKey: "", provided: "", loopback: true }), "open-loopback");
    assert.equal(decideAssessorGate({ configuredKey: "k", provided: "k", loopback: false }), "allow");
    assert.equal(decideAssessorGate({ configuredKey: "k", provided: "nope", loopback: true }), "deny");
  });

  it("treats only 127.0.0.1 / localhost / ::1 as loopback", () => {
    assert.equal(isLoopbackHostname("127.0.0.1:43127"), true);
    assert.equal(isLoopbackHostname("localhost"), true);
    assert.equal(isLoopbackHostname("[::1]:43127"), true);
    assert.equal(isLoopbackHostname("::1"), true);
    assert.equal(isLoopbackHostname("0.0.0.0:43127"), false);
    assert.equal(isLoopbackHostname("example.com"), false);
    assert.equal(isLoopbackHostname("10.0.0.5"), false);
  });

  it("never authenticates from a query key", () => {
    const provided = providedAssessorSecretFrom({ header: "", cookie: "", query: "secret" });
    assert.equal(provided.value, "");
    assert.equal(provided.via, "");
  });

  it("keeps the login page and session API public; gates other assessor APIs", () => {
    assert.equal(isAssessorPublicPath("/assessor/login"), true);
    assert.equal(isAssessorPublicPath("/api/assessor/session"), true);
    assert.equal(isAssessorPublicPath("/api/assessor/session/"), true);
    assert.equal(isAssessorPublicPath("/assessor"), false);
    assert.equal(isAssessorPublicPath("/api/submissions"), false);
    assert.equal(isAssessorPublicPath("/api/assessor/emass"), false);
    assert.equal(isAssessorGatedPath("/api/assessor/session"), false);
    assert.equal(isAssessorGatedPath("/assessor/login"), false);
    assert.equal(isAssessorGatedPath("/api/assessor/emass"), true);
    assert.equal(isAssessorGatedPath("/assessor"), true);
    assert.equal(isAssessorGatedPath("/api/submissions"), true);
    assert.equal(isAssessorGatedPath("/intake"), false);
  });

  it("session login returns 401 on a bad key (not middleware 404)", () => {
    const bad = decideAssessorSessionLogin({
      configuredKey: "unit-test-assessor-key",
      providedKey: "nope",
      loopback: false,
    });
    assert.deepEqual(bad, { ok: false, status: 401, error: "Invalid key." });

    const good = decideAssessorSessionLogin({
      configuredKey: "unit-test-assessor-key",
      providedKey: "unit-test-assessor-key",
      loopback: false,
    });
    assert.deepEqual(good, { ok: true });

    const emptyOffLoopback = decideAssessorSessionLogin({
      configuredKey: "",
      providedKey: "anything",
      loopback: false,
    });
    assert.deepEqual(emptyOffLoopback, { ok: false, status: 404, error: "Not found" });
  });
});
