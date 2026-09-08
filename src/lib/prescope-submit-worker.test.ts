import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { harborlineOscAnswers } from "./demo-fill.ts";
import {
  applyWorkerHandoff,
  forwardAnswersToSubmitWorker,
  getSubmitWorkerConfig,
  parseSubmitWorkerOrigin,
} from "./prescope-submit-worker.ts";
import type { Submission } from "./types.ts";

function env(over: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { ...over };
}

describe("prescope-submit Worker wire", () => {
  it("parses https origins and strips a /submit path", () => {
    assert.equal(
      parseSubmitWorkerOrigin("https://prescope-submit.example.workers.dev/"),
      "https://prescope-submit.example.workers.dev",
    );
    assert.equal(
      parseSubmitWorkerOrigin("https://prescope-submit.example.workers.dev/submit"),
      "https://prescope-submit.example.workers.dev",
    );
    assert.equal(parseSubmitWorkerOrigin("http://127.0.0.1:8787"), "http://127.0.0.1:8787");
    assert.equal(parseSubmitWorkerOrigin("http://localhost:8787/"), "http://localhost:8787");
    assert.equal(parseSubmitWorkerOrigin("http://example.com"), null);
    assert.equal(parseSubmitWorkerOrigin("ftp://127.0.0.1"), null);
    assert.equal(parseSubmitWorkerOrigin("not a url"), null);
  });

  it("is a no-op when the Worker URL is unset (local/demo)", async () => {
    assert.equal(getSubmitWorkerConfig(env()), null);
    const result = await forwardAnswersToSubmitWorker(harborlineOscAnswers(), {
      env: env(),
      fetchImpl: async () => {
        throw new Error("fetch must not run");
      },
    });
    assert.deepEqual(result, { status: "skipped", reason: "PRESCOPE_SUBMIT_WORKER_URL is not set." });
  });

  it("does not call the Worker when the secret is missing", async () => {
    const result = await forwardAnswersToSubmitWorker(harborlineOscAnswers(), {
      env: env({ PRESCOPE_SUBMIT_WORKER_URL: "https://prescope-submit.example.workers.dev" }),
      fetchImpl: async () => {
        throw new Error("fetch must not run");
      },
    });
    assert.equal(result.status, "skipped");
    if (result.status !== "skipped") return;
    assert.match(result.reason, /PRESCOPE_SUBMIT_SECRET/);
  });

  it("POSTs { answers } with Bearer and never returns Box ids or the secret", async () => {
    const secret = "unit-test-secret";
    let seen: { url: string; init: RequestInit } | undefined;
    const result = await forwardAnswersToSubmitWorker(harborlineOscAnswers(), {
      env: env({
        PRESCOPE_SUBMIT_WORKER_URL: "https://prescope-submit.example.workers.dev/submit",
        PRESCOPE_SUBMIT_SECRET: secret,
      }),
      fetchImpl: async (url, init) => {
        seen = { url: String(url), init: init ?? {} };
        return new Response(
          JSON.stringify({
            id: "worker-uuid",
            orchstatus: "AssessorsEmailed",
            drop: { folderId: "fld_secret", children: { "00 Internal": "fld_00" } },
            mail: [{ kind: "internal_box_link", body: "https://app.box.com/folder/1" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.orchstatus, "AssessorsEmailed");
    assert.equal("drop" in result, false);
    assert.equal(JSON.stringify(result).includes("fld_"), false);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(JSON.stringify(result).includes("box.com"), false);

    assert.equal(seen?.url, "https://prescope-submit.example.workers.dev/submit");
    const headers = new Headers(seen?.init.headers);
    assert.equal(headers.get("Authorization"), `Bearer ${secret}`);
    assert.equal(headers.get("X-Prescope-Fill-Key"), null);
    const body = JSON.parse(String(seen?.init.body)) as { answers?: { oscname?: string } };
    assert.equal(body.answers?.oscname, "Harborline Precision");
    assert.equal(Object.keys(body).join(","), "answers");
  });

  it("maps Worker 401 to a public-safe failure without echoing the secret", async () => {
    const secret = "unit-test-secret";
    const result = await forwardAnswersToSubmitWorker(harborlineOscAnswers(), {
      env: env({
        PRESCOPE_SUBMIT_WORKER_URL: "https://prescope-submit.example.workers.dev",
        PRESCOPE_SUBMIT_SECRET: secret,
      }),
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "Unauthorized.", detail: secret }), { status: 401 }),
    });
    assert.deepEqual(result, { status: "failed", reason: "Worker rejected the request." });
    assert.equal(JSON.stringify(result).includes(secret), false);
  });

  it("stamps an operator beat without Box ids when the Worker is called", () => {
    const submission = {
      beats: [{ beat: 3, name: "Create DROP", status: "ok", at: "t", detail: "Empty folder." }],
    } as Submission;
    const ok = applyWorkerHandoff(submission, { status: "ok", orchstatus: "AssessorsEmailed" });
    assert.match(ok.beats[0]?.detail ?? "", /Cloudflare Worker POST \/submit: AssessorsEmailed/);
    assert.equal(ok.beats[0]?.detail.includes("fld_"), false);

    const failed = applyWorkerHandoff(submission, { status: "failed", reason: "Worker returned 502 (FailedBox)." });
    assert.match(failed.beats[0]?.detail ?? "", /did not complete \(logged server-side\)/);
    assert.equal(failed.beats[0]?.detail.includes("FailedBox"), false);

    const local = applyWorkerHandoff(submission, {
      status: "skipped",
      reason: "PRESCOPE_SUBMIT_WORKER_URL is not set.",
    });
    assert.equal(local.beats[0]?.detail, "Empty folder.");
  });
});
