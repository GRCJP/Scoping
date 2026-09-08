import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { answersIfDemoQuery } from "./demo-fill.ts";
import {
  draftHasAnswers,
  intakeSessionFromLoad,
  parseIntakeDraft,
} from "./intake-session.ts";
import { emptyAnswers } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..");

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("intake welcome gate on load / refresh", () => {
  it("fresh load with no draft shows Welcome at Company step 0", () => {
    const session = intakeSessionFromLoad({ seeded: null, draft: null });
    assert.equal(session.welcome, true);
    assert.equal(session.idx, 0);
    assert.equal(session.beat, 0);
    assert.equal(session.answers.hqname, "");
    assert.deepEqual(session.gapSummary, []);
  });

  it("refresh with a mid-form draft still shows Welcome (no mid-form skip)", () => {
    const answers = { ...emptyAnswers(), hqname: "Harborline Precision LLC", oscname: "Harborline Precision" };
    const draft = {
      answers,
      idx: 2,
      beat: 0,
      welcome: false,
      gapSummary: [{ nav: "Company", messages: ["UEI is required."] }],
    };
    assert.equal(draftHasAnswers(draft.answers), true);
    const session = intakeSessionFromLoad({ seeded: null, draft });
    assert.equal(session.welcome, true);
    assert.equal(session.idx, 2);
    assert.equal(session.beat, 0);
    assert.equal(session.answers.hqname, "Harborline Precision LLC");
    assert.equal(session.gapSummary.length, 1);
  });

  it("refresh after Start with no answers still shows Welcome", () => {
    const draft = {
      answers: emptyAnswers(),
      idx: 0,
      beat: 0,
      welcome: false,
      gapSummary: [],
    };
    assert.equal(draftHasAnswers(draft.answers), false);
    const session = intakeSessionFromLoad({ seeded: null, draft });
    assert.equal(session.welcome, true);
    assert.equal(session.idx, 0);
  });

  it("stored welcome:false is ignored on a new session", () => {
    const raw = JSON.stringify({
      answers: { hqname: "Acme" },
      idx: 1,
      beat: 0,
      welcome: false,
    });
    const draft = parseIntakeDraft(raw);
    assert.ok(draft);
    assert.equal(draft?.welcome, false);
    const session = intakeSessionFromLoad({ seeded: null, draft });
    assert.equal(session.welcome, true);
  });

  it("?demo=1 is the documented path that skips Welcome", () => {
    const seeded = answersIfDemoQuery("?demo=1");
    assert.ok(seeded);
    const session = intakeSessionFromLoad({ seeded, draft: null });
    assert.equal(session.welcome, false);
    assert.equal(session.idx, 0);
    assert.equal(session.answers.hqname, "Harborline Precision LLC");
  });

  it("demo seed wins over a leftover draft", () => {
    const seeded = answersIfDemoQuery("?demo=1");
    const draft = {
      answers: { ...emptyAnswers(), hqname: "Stale Co" },
      idx: 4,
      beat: 2,
      welcome: false,
      gapSummary: [],
    };
    const session = intakeSessionFromLoad({ seeded, draft });
    assert.equal(session.welcome, false);
    assert.equal(session.idx, 0);
    assert.equal(session.answers.hqname, "Harborline Precision LLC");
  });

  it("empty country default does not count as a draft answer", () => {
    assert.equal(draftHasAnswers(emptyAnswers()), false);
    assert.equal(draftHasAnswers({ ...emptyAnswers(), country: "United States" }), false);
    assert.equal(draftHasAnswers({ ...emptyAnswers(), hqname: " " }), false);
    assert.equal(draftHasAnswers({ ...emptyAnswers(), hqname: "Acme" }), true);
  });

  it("IntakeForm uses the per-session gate and does not skip Welcome on restore", () => {
    const form = src("components/form/IntakeForm.tsx");
    assert.ok(form.includes("intakeSessionFromLoad"));
    assert.ok(form.includes("parseIntakeDraft"));
    assert.equal(form.includes("restored ? false"), false);
    assert.equal(form.includes("draft?.welcome ?? true"), false);
    const init = form.match(/const session = intakeSessionFromLoad\([\s\S]*?\);/)?.[0] ?? "";
    assert.ok(init.includes("seeded"));
    assert.ok(init.includes("draft"));
    const welcomeInit = form.match(/const \[welcome, setWelcome\] = useState\([^;]+;/)?.[0] ?? "";
    assert.match(welcomeInit, /session\.welcome/);
  });

  it("Power Pages restores answers but not started (Welcome is per-session)", () => {
    const pages = readFileSync(join(repo, "docs", "powerpages", "osc-discovery.html"), "utf8");
    const restore = pages.match(/function restoreDraft\(\)\{[\s\S]*?\n  \}/)?.[0] ?? "";
    assert.ok(restore.includes("DRAFT_KEY"));
    assert.equal(restore.includes("started = true"), false);
    assert.equal(restore.includes("d.started"), false);
    assert.ok(restore.includes("typeof d.i === \"number\"") || restore.includes("typeof d.i==="));
    const begin = pages.match(/function begin\(\)\{[^}]+\}/)?.[0] ?? "";
    assert.ok(begin.includes("started = true"));
    assert.equal(begin.includes("i = 0"), false);
    assert.equal(begin.includes("b = 0"), false);
  });
});
