/**
 * Mail hooks. Never attach or link filled xlsx.
 *
 * customer_confirmation — AO + TPOC. No Box URL (intake may sit outside the enclave).
 *   MAIL_PROVIDER=resend uses a published Resend template (alias or id), not subject/text.
 * internal_box_link — assessors only. Box folder URL. No xlsx bytes. Plain text.
 *
 * MAIL_PROVIDER=stub (default) records the payload and does not send.
 * MAIL_PROVIDER=resend POSTs to the Resend API with MAIL_FROM + MAIL_API_KEY.
 */
import { mailProvider, trim, type MailProvider, type WorkerEnv } from "./env.ts";
import { contactEmail, contactName, orgName, type FormAnswers } from "../../../src/lib/types.ts";

export type MailHookKind = "customer_confirmation" | "internal_box_link";
export type MailHookStatus = "stubbed" | "sent" | "failed";

export type MailHook = {
  kind: MailHookKind;
  to: string[];
  subject: string;
  body: string;
  status: MailHookStatus;
  provider: MailProvider;
  note: string;
  /** Resend template substitutions. customer_confirmation only. No Box URLs / xlsx. */
  variables?: Record<string, string>;
};

/** Resend emails endpoint. Tests mock fetch against this URL — never hit the network. */
export const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/** Default published alias. Override with MAIL_CUSTOMER_TEMPLATE_ID (not a secret). */
export const DEFAULT_CUSTOMER_TEMPLATE_ID = "intake-submission-confirmation";

const RESEND_VAR_MAX = 2000;

export type ResendPlainTextBody = {
  from: string;
  to: string[];
  subject: string;
  text: string;
};

export type ResendTemplateBody = {
  from: string;
  to: string[];
  template: {
    id: string;
    variables: Record<string, string>;
  };
};

export type ResendEmailBody = ResendPlainTextBody | ResendTemplateBody;

function uniqueEmails(...parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const e = raw.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(raw.trim());
  }
  return out;
}

const DEFAULT_ASSESSOR_MAILBOX = "assessors@example.com";

/**
 * Light shape check only — skip tokens that are clearly not emails (no @, spaces, no dot).
 * Not RFC 5322; display names like `Name <a@b.com>` are dropped.
 */
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `ASSESSOR_MAILBOX` may be comma- or semicolon-separated.
 * Splits, trims, drops empties / clearly invalid tokens, and dedupes case-insensitively.
 * Falls back to the historical default when nothing valid remains.
 */
export function assessorMailboxes(env: WorkerEnv): string[] {
  const parts = trim(env.ASSESSOR_MAILBOX)
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && SIMPLE_EMAIL.test(part));
  const unique = uniqueEmails(...parts);
  return unique.length > 0 ? unique : [DEFAULT_ASSESSOR_MAILBOX];
}

function templateVar(raw: string): string {
  const v = raw.trim();
  return v.length > RESEND_VAR_MAX ? v.slice(0, RESEND_VAR_MAX) : v;
}

/**
 * Resend template variables for customer_confirmation.
 * Names are conventional SCREAMING_SNAKE (Resend reserved: FIRST_NAME, LAST_NAME, EMAIL, UNSUBSCRIBE_URL).
 * Admin 2 should confirm keys against the published `intake-submission-confirmation` template.
 */
export function customerConfirmationVariables(answers: FormAnswers): Record<string, string> {
  const aoName = [answers.ao_first, answers.ao_last].filter(Boolean).join(" ").trim();
  const tpocName = [answers.tpoc_first, answers.tpoc_last].filter(Boolean).join(" ").trim();
  return {
    ORG_NAME: templateVar(orgName(answers)),
    HQ_NAME: templateVar(answers.hqname),
    OSC_NAME: templateVar(answers.oscname),
    CONTACT_NAME: templateVar(contactName(answers)),
    CONTACT_EMAIL: templateVar(contactEmail(answers)),
    AO_NAME: templateVar(aoName),
    AO_FIRST: templateVar(answers.ao_first),
    AO_LAST: templateVar(answers.ao_last),
    AO_TITLE: templateVar(answers.ao_title),
    AO_EMAIL: templateVar(answers.ao_email),
    AO_PHONE: templateVar(answers.ao_phone),
    TPOC_NAME: templateVar(tpocName),
    TPOC_FIRST: templateVar(answers.tpoc_first),
    TPOC_LAST: templateVar(answers.tpoc_last),
    TPOC_TITLE: templateVar(answers.tpoc_title),
    TPOC_EMAIL: templateVar(answers.tpoc_email),
    TPOC_PHONE: templateVar(answers.tpoc_phone),
  };
}

export function customerConfirmationTemplateId(env: WorkerEnv): string {
  return trim(env.MAIL_CUSTOMER_TEMPLATE_ID) || DEFAULT_CUSTOMER_TEMPLATE_ID;
}

export function customerConfirmationEmail(answers: FormAnswers): MailHook {
  const org = orgName(answers);
  const to = uniqueEmails(answers.ao_email, answers.tpoc_email, contactEmail(answers));
  return {
    kind: "customer_confirmation",
    to,
    subject: `OSC Discovery received — ${org}`,
    body: [
      `Thank you. We received the OSC Discovery questionnaire for ${org}.`,
      ``,
      `This is a copy of what you submitted, not a CMMC assessment. It is environment information so the C3PAO can identify what is being assessed.`,
      ``,
      `A short confirmation call comes later. Do not send CUI, CMMC UIDs, or SPRS scores by email.`,
    ].join("\n"),
    status: "stubbed",
    provider: "stub",
    note: "No Box link. Filled eMASS xlsx is never emailed.",
    variables: customerConfirmationVariables(answers),
  };
}

export function internalBoxLinkEmail(
  answers: FormAnswers,
  dropUrl: string,
  env: WorkerEnv,
): MailHook {
  const org = orgName(answers);
  return {
    kind: "internal_box_link",
    to: assessorMailboxes(env),
    subject: `${org} scoping info dropped in Box`,
    body: [
      `Scoping intake for ${org} is in Box.`,
      ``,
      `DROP: ${dropUrl}`,
      `Assessment Official: ${contactName(answers)} <${contactEmail(answers)}>`,
      ``,
      `Filled eMASS xlsx is in the Box drop. Do not email those files.`,
      `Call is confirmation, not discovery.`,
    ].join("\n"),
    status: "stubbed",
    provider: "stub",
    note: "Box folder link only. No xlsx attachment.",
  };
}

/**
 * Resend POST body. customer_confirmation uses template.id (alias or UUID) + variables —
 * no subject/text/html (Resend rejects those alongside template).
 * internal_box_link stays plain text. No attachments, no xlsx links added here.
 */
export function buildResendEmailBody(hook: MailHook, from: string, env: WorkerEnv): ResendEmailBody {
  if (hook.kind === "customer_confirmation") {
    return {
      from,
      to: [...hook.to],
      template: {
        id: customerConfirmationTemplateId(env),
        variables: { ...(hook.variables ?? {}) },
      },
    };
  }
  return {
    from,
    to: [...hook.to],
    subject: hook.subject,
    text: hook.body,
  };
}

function redactMailSecrets(text: string, apiKey: string): string {
  let out = text.replace(/\s+/g, " ").trim();
  const key = apiKey.trim();
  if (key.length >= 8) out = out.split(key).join("[redacted]");
  out = out.replace(/re_[A-Za-z0-9]+/g, "[redacted]");
  if (out.length > 240) out = `${out.slice(0, 240)}…`;
  return out || "Send failed.";
}

function failHook(hook: MailHook, note: string): MailHook {
  return { ...hook, status: "failed", provider: "resend", note };
}

async function sendResend(
  hook: MailHook,
  from: string,
  apiKey: string,
  env: WorkerEnv,
  fetchImpl: typeof fetch,
): Promise<MailHook> {
  if (hook.to.length === 0) return failHook(hook, "No recipients.");

  const payload = buildResendEmailBody(hook, from, env);
  try {
    const res = await fetchImpl(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      let message = `Resend ${res.status}`;
      try {
        const json = JSON.parse(text) as { message?: unknown };
        if (typeof json.message === "string" && json.message.trim()) message = json.message;
      } catch {
        /* keep status line */
      }
      return failHook(hook, redactMailSecrets(message, apiKey));
    }
    return { ...hook, status: "sent", provider: "resend" };
  } catch {
    return failHook(hook, "Resend request failed.");
  }
}

/** Stub is a no-op. Resend POSTs each hook; status is sent/failed. Never attach xlsx. */
export async function dispatchMail(
  hooks: MailHook[],
  env: WorkerEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<MailHook[]> {
  if (mailProvider(env) !== "resend") return hooks;

  const from = trim(env.MAIL_FROM);
  const apiKey = trim(env.MAIL_API_KEY);
  if (!from || !apiKey) {
    return hooks.map((hook) => failHook(hook, "MAIL_FROM or MAIL_API_KEY is not set."));
  }

  const out: MailHook[] = [];
  for (const hook of hooks) {
    out.push(await sendResend(hook, from, apiKey, env, fetchImpl));
  }
  return out;
}
