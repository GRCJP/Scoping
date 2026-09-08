import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { harborlineOscAnswers } from "../../../src/lib/demo-fill.ts";
import type { WorkerEnv } from "../src/env.ts";
import { mailProvider } from "../src/env.ts";
import {
  DEFAULT_CUSTOMER_TEMPLATE_ID,
  RESEND_EMAILS_URL,
  assessorMailboxes,
  buildResendEmailBody,
  customerConfirmationEmail,
  customerConfirmationTemplateId,
  customerConfirmationVariables,
  dispatchMail,
  internalBoxLinkEmail,
  type MailHook,
  type ResendTemplateBody,
} from "../src/mail.ts";

function env(over: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    PRESCOPE_SUBMIT_SECRET: "test-secret",
    BOX_MODE: "mock",
    FILL_MODE: "skip",
    BOX_AUTH_MODE: "ccg",
    BOX_SUBJECT_TYPE: "enterprise",
    BOX_DROPS_PARENT_ID: "parent-drops",
    BOX_TEMPLATE_FOLDER_ID: "",
    BOX_PREASSESSMENT_TEMPLATE_FILE_ID: "",
    BOX_REQUIRED_DATA_TEMPLATE_FILE_ID: "",
    BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID: "",
    MAIL_PROVIDER: "stub",
    EMASS_TEMPLATE_ROOT: "",
    FILL_CONTAINER_URL: "",
    ...over,
  };
}

const API_KEY = "re_test_mail_api_key_not_real";
const FROM = "Scoping <intake@example.com>";
const ASSESSOR = "lead@example.com";
const DROP_URL = "https://app.box.com/folder/fld_test_drop";

function hooks(workerEnv: WorkerEnv = env()): MailHook[] {
  const answers = harborlineOscAnswers();
  return [customerConfirmationEmail(answers), internalBoxLinkEmail(answers, DROP_URL, workerEnv)];
}

function recordingFetch(
  handler: (req: Request) => Response | Promise<Response>,
): {
  fetchImpl: typeof fetch;
  calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[];
} {
  const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const text = await req.clone().text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({ url: req.url, method: req.method, headers, body });
    return handler(req);
  };
  return { fetchImpl, calls };
}

describe("mailProvider", () => {
  it("defaults to stub unless MAIL_PROVIDER=resend", () => {
    assert.equal(mailProvider(env()), "stub");
    assert.equal(mailProvider(env({ MAIL_PROVIDER: "STUB" })), "stub");
    assert.equal(mailProvider(env({ MAIL_PROVIDER: "postmark" })), "stub");
    assert.equal(mailProvider(env({ MAIL_PROVIDER: "resend" })), "resend");
    assert.equal(mailProvider(env({ MAIL_PROVIDER: "RESEND" })), "resend");
  });
});

describe("MAIL_PROVIDER=stub", () => {
  it("does not send and leaves hooks stubbed", async () => {
    const { fetchImpl, calls } = recordingFetch(() => {
      throw new Error("stub must not call fetch");
    });
    const input = hooks();
    const out = await dispatchMail(input, env(), fetchImpl);
    assert.equal(calls.length, 0);
    assert.deepEqual(out, input);
    assert.equal(out[0]?.status, "stubbed");
    assert.equal(out[0]?.provider, "stub");
    assert.equal(out[1]?.status, "stubbed");
    assert.equal(out[1]?.provider, "stub");
  });
});

describe("MAIL_PROVIDER=resend", () => {
  it("builds Resend POSTs (mocked fetch) for AO/TPOC and ASSESSOR_MAILBOX", async () => {
    const workerEnv = env({
      MAIL_PROVIDER: "resend",
      MAIL_API_KEY: API_KEY,
      MAIL_FROM: FROM,
      ASSESSOR_MAILBOX: ASSESSOR,
    });
    const { fetchImpl, calls } = recordingFetch(
      () => new Response(JSON.stringify({ id: "msg_test" }), { status: 200 }),
    );

    const out = await dispatchMail(hooks(workerEnv), workerEnv, fetchImpl);
    assert.equal(calls.length, 2);

    const customer = calls[0];
    const internal = calls[1];
    assert.equal(customer?.url, RESEND_EMAILS_URL);
    assert.equal(customer?.method, "POST");
    assert.equal(customer?.headers.authorization, `Bearer ${API_KEY}`);
    assert.equal(customer?.headers["content-type"], "application/json");

    const customerBody = customer?.body as ResendTemplateBody;
    const expectedCustomer = buildResendEmailBody(hooks(workerEnv)[0]!, FROM, workerEnv);
    assert.deepEqual(customerBody, expectedCustomer);
    assert.deepEqual(customerBody.to, ["maya.chen@harborline.example", "luis.ortiz@harborline.example"]);
    assert.equal(customerBody.from, FROM);
    assert.deepEqual(customerBody.template, {
      id: DEFAULT_CUSTOMER_TEMPLATE_ID,
      variables: customerConfirmationVariables(harborlineOscAnswers()),
    });
    assert.equal(customerBody.template.id, "intake-submission-confirmation");
    assert.equal(Object.hasOwn(customerBody, "attachments"), false);
    assert.equal(Object.hasOwn(customerBody, "html"), false);
    assert.equal(Object.hasOwn(customerBody, "text"), false);
    assert.equal(Object.hasOwn(customerBody, "subject"), false);
    assert.equal(JSON.stringify(customerBody).includes(".xlsx"), false);
    assert.equal(JSON.stringify(customerBody).toLowerCase().includes("box.com"), false);

    const internalBody = internal?.body as Record<string, unknown>;
    assert.deepEqual(internalBody.to, [ASSESSOR]);
    assert.equal(internalBody.from, FROM);
    assert.equal(internalBody.subject, "Harborline Precision scoping info dropped in Box");
    assert.match(String(internalBody.text), /^Scoping intake for Harborline Precision is in Box\./);
    assert.match(String(internalBody.text), /https:\/\/app\.box\.com\/folder\/fld_test_drop/);
    assert.match(String(internalBody.text), /Assessment Official: Maya Chen <maya\.chen@harborline\.example>/);
    assert.match(String(internalBody.text), /Filled eMASS xlsx is in the Box drop\. Do not email those files\./);
    assert.match(String(internalBody.text), /Call is confirmation, not discovery\./);
    assert.equal(String(internalBody.text).includes("OSC Discovery landed in Box."), false);
    assert.equal(String(internalBody.subject).includes("INTAKE"), false);
    assert.equal(Object.hasOwn(internalBody, "template"), false);
    assert.equal(Object.hasOwn(internalBody, "attachments"), false);
    assert.equal(JSON.stringify(internalBody).includes("UEsDB"), false);

    assert.equal(out[0]?.kind, "customer_confirmation");
    assert.equal(out[0]?.status, "sent");
    assert.equal(out[0]?.provider, "resend");
    assert.equal(out[1]?.kind, "internal_box_link");
    assert.equal(out[1]?.status, "sent");
    assert.equal(out[1]?.provider, "resend");
    assert.equal(JSON.stringify(out).includes(API_KEY), false);
  });

  it("returns failed without leaking the API key when Resend rejects", async () => {
    const workerEnv = env({
      MAIL_PROVIDER: "resend",
      MAIL_API_KEY: API_KEY,
      MAIL_FROM: FROM,
      ASSESSOR_MAILBOX: ASSESSOR,
    });
    const { fetchImpl } = recordingFetch(
      () =>
        new Response(JSON.stringify({ message: `API key ${API_KEY} is invalid` }), { status: 401 }),
    );

    const out = await dispatchMail(hooks(workerEnv), workerEnv, fetchImpl);
    assert.equal(out[0]?.status, "failed");
    assert.equal(out[0]?.provider, "resend");
    assert.equal(out[1]?.status, "failed");
    assert.match(out[0]?.note ?? "", /invalid|redacted/i);
    assert.equal(JSON.stringify(out).includes(API_KEY), false);
    assert.equal(JSON.stringify(out).includes("re_test"), false);
  });

  it("fails closed when MAIL_FROM or MAIL_API_KEY is missing", async () => {
    const { fetchImpl, calls } = recordingFetch(() => {
      throw new Error("must not call fetch without secrets");
    });
    const missing = env({ MAIL_PROVIDER: "resend", MAIL_FROM: FROM });
    const out = await dispatchMail(hooks(missing), missing, fetchImpl);
    assert.equal(calls.length, 0);
    assert.equal(out[0]?.status, "failed");
    assert.equal(out[0]?.note, "MAIL_FROM or MAIL_API_KEY is not set.");
    assert.equal(out[1]?.status, "failed");
  });

  it("uses MAIL_CUSTOMER_TEMPLATE_ID when set, else the published alias", async () => {
    assert.equal(customerConfirmationTemplateId(env()), DEFAULT_CUSTOMER_TEMPLATE_ID);
    assert.equal(
      customerConfirmationTemplateId(env({ MAIL_CUSTOMER_TEMPLATE_ID: "  custom-alias  " })),
      "custom-alias",
    );

    const workerEnv = env({
      MAIL_PROVIDER: "resend",
      MAIL_API_KEY: API_KEY,
      MAIL_FROM: FROM,
      ASSESSOR_MAILBOX: ASSESSOR,
      MAIL_CUSTOMER_TEMPLATE_ID: "custom-alias",
    });
    const { fetchImpl, calls } = recordingFetch(
      () => new Response(JSON.stringify({ id: "msg_test" }), { status: 200 }),
    );
    await dispatchMail(hooks(workerEnv), workerEnv, fetchImpl);
    const customerBody = calls[0]?.body as ResendTemplateBody;
    const internalBody = calls[1]?.body as Record<string, unknown>;
    assert.equal(customerBody.template.id, "custom-alias");
    assert.equal(Object.hasOwn(internalBody, "template"), false);
    assert.match(String(internalBody.text), /https:\/\/app\.box\.com\/folder\/fld_test_drop/);
  });
});

describe("internalBoxLinkEmail", () => {
  it("uses scoping/confirmation copy, not discovery-landed language", () => {
    const hook = internalBoxLinkEmail(harborlineOscAnswers(), DROP_URL, env({ ASSESSOR_MAILBOX: ASSESSOR }));
    assert.equal(hook.kind, "internal_box_link");
    assert.equal(hook.subject, "Harborline Precision scoping info dropped in Box");
    assert.equal(
      hook.body,
      [
        "Scoping intake for Harborline Precision is in Box.",
        "",
        `DROP: ${DROP_URL}`,
        "Assessment Official: Maya Chen <maya.chen@harborline.example>",
        "",
        "Filled eMASS xlsx is in the Box drop. Do not email those files.",
        "Call is confirmation, not discovery.",
      ].join("\n"),
    );
    assert.equal(hook.body.includes("OSC Discovery landed in Box."), false);
    assert.equal(hook.subject.includes("INTAKE"), false);
  });
});

describe("assessorMailboxes", () => {
  const answers = harborlineOscAnswers();

  it("keeps a single address unchanged", () => {
    assert.deepEqual(assessorMailboxes(env({ ASSESSOR_MAILBOX: ASSESSOR })), [ASSESSOR]);
    assert.deepEqual(internalBoxLinkEmail(answers, DROP_URL, env({ ASSESSOR_MAILBOX: ASSESSOR })).to, [
      ASSESSOR,
    ]);
  });

  it("splits comma-separated addresses into two tos", () => {
    const workerEnv = env({ ASSESSOR_MAILBOX: "a@x.com, b@y.com" });
    assert.deepEqual(assessorMailboxes(workerEnv), ["a@x.com", "b@y.com"]);
    assert.deepEqual(internalBoxLinkEmail(answers, DROP_URL, workerEnv).to, ["a@x.com", "b@y.com"]);
  });

  it("trims whitespace and splits on semicolons", () => {
    assert.deepEqual(
      assessorMailboxes(env({ ASSESSOR_MAILBOX: "  a@x.com ;  b@y.com,c@z.com  " })),
      ["a@x.com", "b@y.com", "c@z.com"],
    );
  });

  it("falls back to the default when empty or missing", () => {
    assert.deepEqual(assessorMailboxes(env()), ["assessors@example.com"]);
    assert.deepEqual(assessorMailboxes(env({ ASSESSOR_MAILBOX: "" })), ["assessors@example.com"]);
    assert.deepEqual(assessorMailboxes(env({ ASSESSOR_MAILBOX: "  , ;  " })), ["assessors@example.com"]);
    assert.deepEqual(internalBoxLinkEmail(answers, DROP_URL, env()).to, ["assessors@example.com"]);
  });

  it("skips clearly invalid tokens and dedupes case-insensitively", () => {
    assert.deepEqual(
      assessorMailboxes(env({ ASSESSOR_MAILBOX: "not-an-email, A@X.com; a@x.com, Name <a@b.com>" })),
      ["A@X.com"],
    );
    assert.deepEqual(assessorMailboxes(env({ ASSESSOR_MAILBOX: "nope" })), ["assessors@example.com"]);
  });
});

describe("customerConfirmationVariables", () => {
  it("maps org / AO / TPOC fields and never includes Box or xlsx", () => {
    const vars = customerConfirmationVariables(harborlineOscAnswers());
    assert.equal(vars.ORG_NAME, "Harborline Precision");
    assert.equal(vars.HQ_NAME, "Harborline Precision LLC");
    assert.equal(vars.OSC_NAME, "Harborline Precision");
    assert.equal(vars.CONTACT_NAME, "Maya Chen");
    assert.equal(vars.CONTACT_EMAIL, "maya.chen@harborline.example");
    assert.equal(vars.AO_NAME, "Maya Chen");
    assert.equal(vars.AO_FIRST, "Maya");
    assert.equal(vars.AO_LAST, "Chen");
    assert.equal(vars.AO_EMAIL, "maya.chen@harborline.example");
    assert.equal(vars.TPOC_NAME, "Luis Ortiz");
    assert.equal(vars.TPOC_FIRST, "Luis");
    assert.equal(vars.TPOC_LAST, "Ortiz");
    assert.equal(vars.TPOC_EMAIL, "luis.ortiz@harborline.example");
    assert.equal(JSON.stringify(vars).toLowerCase().includes("box.com"), false);
    assert.equal(JSON.stringify(vars).includes(".xlsx"), false);
    assert.equal(Object.hasOwn(vars, "FIRST_NAME"), false);
    assert.equal(Object.hasOwn(vars, "LAST_NAME"), false);
    assert.equal(Object.hasOwn(vars, "EMAIL"), false);
  });
});
