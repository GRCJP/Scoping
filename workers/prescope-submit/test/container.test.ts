import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleFillHttp } from "../container/handler.ts";

const SECRET = "container-test-secret";

function headers(over: Record<string, string> = {}): Headers {
  return new Headers(over);
}

describe("prescope-fill sidecar HTTP (no exceljs)", () => {
  it("GET /health does not require a secret", async () => {
    const out = await handleFillHttp("GET", "/health", headers(), "", "");
    assert.equal(out.status, 200);
    assert.deepEqual(out.data, { ok: true, service: "prescope-fill" });
  });

  it("rejects POST /fill without a secret", async () => {
    const out = await handleFillHttp("POST", "/fill", headers(), JSON.stringify({ answers: {} }), SECRET);
    assert.equal(out.status, 401);
  });

  it("rejects POST /fill with the wrong Bearer token", async () => {
    const out = await handleFillHttp(
      "POST",
      "/fill",
      headers({ Authorization: "Bearer nope" }),
      JSON.stringify({ answers: {} }),
      SECRET,
    );
    assert.equal(out.status, 401);
  });

  it("accepts X-Prescope-Fill-Key and still validates the answers DTO", async () => {
    const out = await handleFillHttp(
      "POST",
      "/fill",
      headers({ "X-Prescope-Fill-Key": SECRET }),
      JSON.stringify({ answers: { legalName: "Nope" } }),
      SECRET,
    );
    assert.equal(out.status, 400);
    const data = out.data as { error?: string };
    assert.match(data.error ?? "", /required|Invalid|Unexpected|missing/i);
  });

  it("returns 404 for unknown paths", async () => {
    const out = await handleFillHttp("POST", "/submit", headers({ Authorization: `Bearer ${SECRET}` }), "{}", SECRET);
    assert.equal(out.status, 404);
  });
});

describe("PrescopeFill Durable Object proxy", () => {
  it("starts the container with the shared secret and forwards fetch", async () => {
    const { PrescopeFill } = await import("../src/prescope-fill.ts");
    let started: Record<string, string> | undefined;
    const forwarded: string[] = [];
    const stub = new PrescopeFill(
      {
        container: {
          running: false,
          start: (opts) => {
            started = opts?.env;
          },
          fetch: async (request) => {
            forwarded.push(new URL(request.url).pathname);
            return new Response("ok");
          },
        },
      },
      {
        PRESCOPE_SUBMIT_SECRET: "do-secret",
        FILL_CONCURRENCY: "1",
      } as import("../src/env.ts").WorkerEnv,
    );
    const res = await stub.fetch(new Request("https://prescope-fill.internal/fill", { method: "POST" }));
    assert.equal(res.status, 200);
    assert.equal(started?.PRESCOPE_SUBMIT_SECRET, "do-secret");
    assert.equal(started?.FILL_CONCURRENCY, "1");
    assert.deepEqual(forwarded, ["/fill"]);
  });
});
