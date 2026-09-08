import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizeRequest,
  FILL_KEY_HEADER,
  providedSubmitSecret,
  submitSecretMatches,
} from "../src/auth.ts";

const SECRET = "test-prescope-submit-secret";

describe("submit auth", () => {
  it("rejects an empty configured secret (fail closed)", () => {
    assert.equal(submitSecretMatches(SECRET, ""), false);
    assert.equal(submitSecretMatches("", SECRET), false);
    assert.equal(authorizeRequest(new Headers({ Authorization: `Bearer ${SECRET}` }), ""), false);
  });

  it("accepts Authorization Bearer", () => {
    const headers = new Headers({ Authorization: `Bearer ${SECRET}` });
    assert.equal(providedSubmitSecret(headers), SECRET);
    assert.equal(authorizeRequest(headers, SECRET), true);
  });

  it("accepts X-Prescope-Fill-Key", () => {
    const headers = new Headers({ [FILL_KEY_HEADER]: SECRET });
    assert.equal(providedSubmitSecret(headers), SECRET);
    assert.equal(authorizeRequest(headers, SECRET), true);
  });

  it("prefers Bearer over the fill-key header", () => {
    const headers = new Headers({
      Authorization: `Bearer ${SECRET}`,
      [FILL_KEY_HEADER]: "other",
    });
    assert.equal(providedSubmitSecret(headers), SECRET);
    assert.equal(authorizeRequest(headers, SECRET), true);
  });

  it("rejects a wrong secret and ignores ?key=", () => {
    const headers = new Headers({ Authorization: "Bearer no" });
    assert.equal(authorizeRequest(headers, SECRET), false);
    const empty = new Headers();
    assert.equal(providedSubmitSecret(empty), "");
    assert.equal(authorizeRequest(empty, SECRET), false);
  });
});
