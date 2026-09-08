import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  decideAssessorGate,
  isAssessorGatedPath,
  isAssessorPublicPath,
  providedAssessorSecretFrom,
} from "./lib/assessor-auth.ts";

const middlewareSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "middleware.ts"), "utf8");

describe("middleware rejects query key (PSC-01)", () => {
  const key = "test-assessor-key-psc01";

  it("does not treat ?key= as a credential even when it matches", () => {
    const provided = providedAssessorSecretFrom({
      header: "",
      cookie: "",
      query: key,
    });
    assert.equal(provided.value, "");
    assert.equal(provided.via, "");
    assert.equal(
      decideAssessorGate({ configuredKey: key, provided: provided.value, loopback: false }),
      "deny",
    );
  });

  it("accepts header or cookie and ignores a leftover query key", () => {
    const viaHeader = providedAssessorSecretFrom({ header: key, cookie: "", query: "wrong" });
    assert.equal(viaHeader.via, "header");
    assert.equal(viaHeader.value, key);
    assert.equal(decideAssessorGate({ configuredKey: key, provided: viaHeader.value, loopback: false }), "allow");

    const viaCookie = providedAssessorSecretFrom({ header: "", cookie: key, query: "wrong" });
    assert.equal(viaCookie.via, "cookie");
    assert.equal(decideAssessorGate({ configuredKey: key, provided: viaCookie.value, loopback: false }), "allow");
  });

  it("does not gate the login page or session API", () => {
    assert.equal(isAssessorPublicPath("/assessor/login"), true);
    assert.equal(isAssessorPublicPath("/api/assessor/session"), true);
    assert.equal(isAssessorGatedPath("/api/assessor/session"), false);
    assert.equal(isAssessorPublicPath("/assessor"), false);
    assert.equal(isAssessorPublicPath("/api/submissions"), false);
    assert.equal(isAssessorGatedPath("/api/assessor/emass"), true);
    assert.match(middlewareSrc, /isAssessorGatedPath/);
    assert.match(middlewareSrc, /\/api\/assessor\/session/);
    assert.match(middlewareSrc, /401/);
  });
});
