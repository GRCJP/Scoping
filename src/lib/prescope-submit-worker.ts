import { isLoopbackHostname } from "./assessor-auth.ts";
import type { FormAnswers, OrchBeat, Submission } from "./types.ts";

const WORKER_URL_ENV = "PRESCOPE_SUBMIT_WORKER_URL";
const WORKER_SECRET_ENV = "PRESCOPE_SUBMIT_SECRET";
const DEFAULT_TIMEOUT_MS = 25_000;
const SKIP_UNSET = `${WORKER_URL_ENV} is not set.`;

export type SubmitWorkerConfig = {
  origin: string;
  secret: string;
};

export type WorkerSubmitResult =
  | { status: "skipped"; reason: string }
  | { status: "ok"; orchstatus: string }
  | { status: "failed"; reason: string };

function trimEnv(name: string, env: NodeJS.ProcessEnv): string {
  return (env[name] ?? "").trim();
}

/** Accept https anywhere, or http only on loopback (local wrangler). Env-only — not request input. */
export function parseSubmitWorkerOrigin(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol === "https:") return parsed.origin;
  if (parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname)) return parsed.origin;
  return null;
}

/**
 * Server-only. Blank URL means local/demo without a Worker (no call).
 * URL without a secret is also a no-call — do not send an empty Bearer.
 */
export function getSubmitWorkerConfig(env: NodeJS.ProcessEnv = process.env): SubmitWorkerConfig | null {
  const origin = parseSubmitWorkerOrigin(trimEnv(WORKER_URL_ENV, env));
  if (!origin) return null;
  const secret = trimEnv(WORKER_SECRET_ENV, env);
  if (!secret) return null;
  return { origin, secret };
}

function publicSafeReason(status: number, errorField: string): string {
  if (status === 401 || status === 403) return "Worker rejected the request.";
  if (status === 413) return "Worker rejected the payload as too large.";
  if (status === 429) return "Worker rate-limited the request.";
  const code = errorField.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  return code ? `Worker returned ${status} (${code}).` : `Worker returned ${status}.`;
}

function readWorkerOrchstatus(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const orchstatus = (body as { orchstatus?: unknown }).orchstatus;
  return typeof orchstatus === "string" ? orchstatus.replace(/[^\w-]/g, "").slice(0, 64) : "";
}

function readWorkerError(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const error = (body as { error?: unknown }).error;
  return typeof error === "string" ? error : "";
}

export function logWorkerSubmit(result: WorkerSubmitResult): void {
  if (result.status === "skipped") {
    if (result.reason !== SKIP_UNSET) {
      console.info("[prescope-submit-worker] skipped", result.reason);
    }
    return;
  }
  if (result.status === "ok") {
    console.info("[prescope-submit-worker] ok", result.orchstatus);
    return;
  }
  console.info("[prescope-submit-worker] failed", result.reason);
}

/**
 * POST { answers } to Worker /submit. Never throws secrets or Box ids to the caller.
 * OSC thank-you must use the Next public payload, not this result.
 */
export async function forwardAnswersToSubmitWorker(
  answers: FormAnswers,
  opts?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<WorkerSubmitResult> {
  const env = opts?.env ?? process.env;
  const rawUrl = trimEnv(WORKER_URL_ENV, env);
  if (!rawUrl) return { status: "skipped", reason: SKIP_UNSET };
  if (!parseSubmitWorkerOrigin(rawUrl)) {
    return { status: "skipped", reason: `${WORKER_URL_ENV} is not an allowed http(s) origin.` };
  }
  if (!trimEnv(WORKER_SECRET_ENV, env)) {
    return { status: "skipped", reason: `${WORKER_SECRET_ENV} is not set.` };
  }

  const config = getSubmitWorkerConfig(env);
  if (!config) return { status: "skipped", reason: SKIP_UNSET };

  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = `${config.origin}/submit`;

  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ answers }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return { status: "failed", reason: "Worker request timed out." };
    }
    return { status: "failed", reason: "Worker request failed." };
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (res.ok) {
    return { status: "ok", orchstatus: readWorkerOrchstatus(parsed) || "ok" };
  }
  return { status: "failed", reason: publicSafeReason(res.status, readWorkerError(parsed)) };
}

function stampBeat(beats: OrchBeat[], result: WorkerSubmitResult): OrchBeat[] {
  return beats.map((beat) => {
    if (beat.beat !== 3) return beat;
    if (result.status === "ok") {
      return {
        ...beat,
        detail: `${beat.detail} Cloudflare Worker POST /submit: ${result.orchstatus}.`,
      };
    }
    if (result.status === "failed") {
      return {
        ...beat,
        status: "info",
        detail: `${beat.detail} Cloudflare Worker POST /submit did not complete (logged server-side).`,
      };
    }
    if (result.reason === SKIP_UNSET) return beat;
    return {
      ...beat,
      status: "info",
      detail: `${beat.detail} Cloudflare Worker not called (${result.reason}).`,
    };
  });
}

/** Operator-only beat note. Does not copy Box ids, mail stubs, or Worker error bodies. */
export function applyWorkerHandoff(submission: Submission, result: WorkerSubmitResult): Submission {
  if (result.status === "skipped" && result.reason === SKIP_UNSET) return submission;
  return { ...submission, beats: stampBeat(submission.beats, result) };
}
