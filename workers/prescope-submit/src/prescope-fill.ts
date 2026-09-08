/**
 * Cloudflare Containers Durable Object. Forwards POST /fill to the Node sidecar
 * image. exceljs runs in the container, not on the Worker isolate.
 */
import type { WorkerEnv } from "./env.ts";

type ContainerHandle = {
  running?: boolean;
  start?: (opts?: { env?: Record<string, string> }) => Promise<void> | void;
  fetch: (request: Request) => Promise<Response>;
};

type ContainerState = {
  container?: ContainerHandle;
};

/** Same class_name as wrangler.toml [[containers]] / durable_objects.bindings. */
export class PrescopeFill {
  readonly ctx: ContainerState;
  readonly env: WorkerEnv;

  constructor(ctx: ContainerState, env: WorkerEnv) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const container = this.ctx.container;
    if (!container) {
      return new Response(JSON.stringify({ error: "Fill container binding is not available." }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private" },
      });
    }
    if (!container.running && container.start) {
      await container.start({
        env: {
          HOST: "0.0.0.0",
          PORT: "8788",
          FILL_CONCURRENCY: this.env.FILL_CONCURRENCY || "1",
          EMASS_TEMPLATE_ROOT: "/app",
          PRESCOPE_SUBMIT_SECRET: this.env.PRESCOPE_SUBMIT_SECRET,
        },
      });
    }
    return container.fetch(request);
  }
}

export function fillBindingStub(env: WorkerEnv): { fetch: typeof fetch } | null {
  const ns = env.PRESCOPE_FILL;
  if (!ns) return null;
  const stub = ns.get(ns.idFromName("prescope-fill"));
  return {
    fetch: (input, init) => stub.fetch(new Request(input, init)),
  };
}
