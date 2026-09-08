/** Cloudflare Worker bindings. Secrets are never logged or returned. */

export type BoxMode = "mock" | "live";
export type FillMode = "node" | "skip" | "container";
export type BoxAuthMode = "ccg" | "jwt";
export type MailProvider = "stub" | "resend";

export type WorkerEnv = {
  PRESCOPE_SUBMIT_SECRET: string;

  BOX_MODE: string;
  FILL_MODE: string;
  BOX_AUTH_MODE: string;
  BOX_SUBJECT_TYPE: string;
  BOX_DROPS_PARENT_ID: string;
  BOX_TEMPLATE_FOLDER_ID: string;
  BOX_PREASSESSMENT_TEMPLATE_FILE_ID: string;
  BOX_REQUIRED_DATA_TEMPLATE_FILE_ID: string;
  BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: string;
  MAIL_PROVIDER: string;
  EMASS_TEMPLATE_ROOT: string;
  FILL_CONTAINER_URL: string;
  /** 1 (default) · 2 · 3 — workbooks filled at once. Keep 1 to avoid Worker 503s. */
  FILL_CONCURRENCY?: string;
  /** Cloudflare Containers Durable Object (uncomment [[containers]] in wrangler.toml). */
  PRESCOPE_FILL?: DurableObjectNamespace;

  BOX_CLIENT_ID?: string;
  BOX_CLIENT_SECRET?: string;
  BOX_ENTERPRISE_ID?: string;
  BOX_SUBJECT_ID?: string;
  BOX_JWT_PRIVATE_KEY?: string;
  BOX_JWT_PASSPHRASE?: string;
  BOX_JWT_PUBLIC_KEY_ID?: string;
  MAIL_FROM?: string;
  MAIL_API_KEY?: string;
  /** Published Resend template id or alias for customer_confirmation. */
  MAIL_CUSTOMER_TEMPLATE_ID?: string;
  /** internal_box_link To:. One address, or comma-/semicolon-separated. */
  ASSESSOR_MAILBOX?: string;
};

export function trim(value: string | undefined | null): string {
  return (value ?? "").trim();
}

export function boxMode(env: WorkerEnv): BoxMode {
  return trim(env.BOX_MODE).toLowerCase() === "live" ? "live" : "mock";
}

export function fillMode(env: WorkerEnv): FillMode {
  const raw = trim(env.FILL_MODE).toLowerCase();
  if (raw === "skip" || raw === "container") return raw;
  return "node";
}

export function boxAuthMode(env: WorkerEnv): BoxAuthMode {
  return trim(env.BOX_AUTH_MODE).toLowerCase() === "jwt" ? "jwt" : "ccg";
}

export function mailProvider(env: WorkerEnv): MailProvider {
  return trim(env.MAIL_PROVIDER).toLowerCase() === "resend" ? "resend" : "stub";
}

/** Workbooks filled at once. Default 1 (serial). 5 parallel *submits* still 503 — run Admin smoke serially. */
export function fillConcurrency(env: WorkerEnv): 1 | 2 | 3 {
  const n = Number(trim(env.FILL_CONCURRENCY));
  if (n === 2 || n === 3) return n;
  return 1;
}
