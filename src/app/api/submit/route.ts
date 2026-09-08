import { answersFingerprint, processSubmission } from "@/lib/orchestrate";
import { jsonPii } from "@/lib/http";
import { clientKey, rateLimitAllow } from "@/lib/rate-limit";
import { parseSubmitBody } from "@/lib/submit-body";
import {
  DEDUPE_WINDOW_MS,
  findByFingerprint,
  getSubmission,
  putSubmission,
  storeIsFull,
} from "@/lib/store";
import { applyBoxHandoff } from "@/lib/box";
import { successPathForId } from "@/lib/ids";
import {
  applyWorkerHandoff,
  forwardAnswersToSubmitWorker,
  logWorkerSubmit,
} from "@/lib/prescope-submit-worker";
import { contactName, type Submission } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const SUBMIT_LIMIT = 20;
const SUBMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * In-process intake submit. When PRESCOPE_SUBMIT_WORKER_URL is set, the server
 * also POSTs { answers } to the Cloudflare Worker (`workers/prescope-submit/`).
 * Power Automate F1–F2b stays the Power Pages path. Do not send Worker Box ids
 * or mail stubs to the OSC browser.
 *
 * Response body goes to the OSC's browser. It must NEVER contain the go/no-go,
 * red flags, or anything from 00 Internal. Only what the thank-you page renders.
 *
 * firstName + customerLink travel here so /success/[id] needs no server-side
 * lookup, which is what makes this work on serverless / edge.
 */
function payload(submission: Submission) {
  const redirect = successPathForId(submission.id);
  return {
    id: submission.id,
    path: submission.path,
    orchstatus: submission.orchstatus,
    firstName: contactName(submission.answers).split(" ")[0] || "there",
    customerLink: submission.box.customerLink,
    redirect: redirect ?? `/success/${submission.id}`,
  };
}

function bad(error: string, status = 400, field?: string) {
  return jsonPii(field ? { error, field } : { error }, { status });
}

export async function POST(req: Request) {
  if (!rateLimitAllow(`submit:${clientKey(req.headers)}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS)) {
    return bad("Too many submissions. Try again later.", 429);
  }

  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return bad("Payload too large.", 413);
  }

  let text: string;
  try {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) return bad("Payload too large.", 413);
    text = new TextDecoder().decode(buf);
  } catch {
    return bad("Invalid body.");
  }

  const parsed = parseSubmitBody(text, req.headers.get("content-length"));
  if (!parsed.ok) return bad(parsed.error, parsed.status, parsed.field);

  const answers = parsed.answers;
  const fingerprint = answersFingerprint(answers);
  const prior = findByFingerprint(fingerprint);
  if (prior && Date.now() - prior.timestamp < DEDUPE_WINDOW_MS) {
    const existing = getSubmission(prior.id);
    if (existing) {
      return jsonPii(payload(existing));
    }
    return jsonPii({
      id: prior.id,
      redirect: successPathForId(prior.id) ?? `/success/${prior.id}`,
    });
  }

  if (storeIsFull()) {
    return bad("Intake store is full. Try again later.", 503);
  }

  const submission = await applyBoxHandoff(processSubmission(answers, fingerprint));
  if (!putSubmission(submission, fingerprint)) {
    return bad("Intake store is full. Try again later.", 503);
  }

  // Optional Cloudflare track. Power Automate F1–F2b is unchanged (Power Pages).
  // Never put Worker Box ids, mail stubs, or secret-bearing errors on the OSC payload.
  const workerResult = await forwardAnswersToSubmitWorker(answers);
  logWorkerSubmit(workerResult);
  const recorded = applyWorkerHandoff(submission, workerResult);
  putSubmission(recorded, fingerprint);

  return jsonPii(payload(recorded));
}
