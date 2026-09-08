import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { newSubmissionId } from "./ids.ts";
import { putSubmission, resetStoreForTests } from "./store.ts";
import { readAssessorSubmissionJson } from "./submission-read.ts";
import { emptyAnswers, type Submission } from "./types.ts";

function stubSubmission(): Submission {
  const id = newSubmissionId();
  return {
    id,
    name: "Test OSC",
    submittedon: new Date().toISOString(),
    orchstatus: "AssessorsEmailed",
    path: "standard",
    fingerprint: "should-not-leak",
    answers: emptyAnswers(),
    scope: {
      infodetermination: "x",
      assess_line1: "",
      assess_line2: "",
      assess_line3: "",
      scope_mode: "",
      scope_people: "",
      scope_locations: "",
      scope_systemclasses: "",
      l2fivecat: "",
      esptable: "",
      flowdownsketch: "",
      scopenotes: "",
    },
    answersMarkdown: "# answers",
    internalMarkdown: "# internal",
    beats: [],
    box: {
      parentName: "p",
      parentNote: "",
      dropFolderName: "d",
      dropFolderId: "fld",
      customerLink: `/drop/${id}/customer`,
      internalUrl: `/drop/${id}/internal`,
      dropUrl: `/drop/${id}/internal`,
      files: [],
    },
    customerEmail: { to: "a@b.example", subject: "s", body: "b" },
    assessorEmail: { to: "c@d.example", subject: "s", body: "b" },
  };
}

describe("GET submissions JSON (PSC-01, PSC-02, PSC-06)", () => {
  afterEach(() => {
    resetStoreForTests();
  });

  it("returns a DTO without fingerprint and sets Cache-Control: no-store", () => {
    const s = stubSubmission();
    putSubmission(s);
    const result = readAssessorSubmissionJson(s.id);
    assert.equal(result.status, 200);
    assert.match(result.headers["Cache-Control"] ?? "", /no-store/);
    const body = result.body as Record<string, unknown>;
    assert.equal(body.id, s.id);
    assert.equal("fingerprint" in body, false);
    assert.ok(body.answers);
    assert.ok(body.internalMarkdown);
  });

  it("404s on a malformed id", () => {
    const result = readAssessorSubmissionJson("osc_abc123def456");
    assert.equal(result.status, 404);
    assert.match(result.headers["Cache-Control"] ?? "", /no-store/);
  });
});
