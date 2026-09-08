import { NextResponse } from "next/server";
import { harborlineOscAnswers } from "@/lib/demo-fill";
import { fillAssessmentResultsXlsx, fillPreAssessmentXlsx, fillRequiredDataXlsx } from "@/lib/emass-xlsx";
import { PII_CACHE_HEADERS } from "@/lib/security-headers";
import { getSubmission } from "@/lib/store";
import { isSubmissionId } from "@/lib/ids";
import { clientKey, rateLimitAllow } from "@/lib/rate-limit";
import type { FormAnswers } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Assessor-only demo / local export of the filled Pre-Assessment xlsx.
 *
 * After Submit, the same fill (fillPreAssessmentXlsx / fillEmassXlsxPack) is
 * what goes to Box 00 Internal — not the blank template. Production F2 will
 * call that fill and upload. This route does not email and does not talk to Box.
 *
 *   GET ?demo=1                  Harborline ?demo=1 answers
 *   GET ?demo=1&file=required-data
 *   GET ?demo=1&file=assessment-results
 *   GET ?id=<submission>         stored intake (assessor console)
 */
export async function GET(req: Request) {
  if (!rateLimitAllow(`emass-xlsx:${clientKey(req.headers)}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: PII_CACHE_HEADERS });
  }

  const url = new URL(req.url);
  const demo = url.searchParams.get("demo") === "1";
  const id = url.searchParams.get("id") ?? "";
  const file = (url.searchParams.get("file") ?? "pre-assessment").toLowerCase();

  let answers: FormAnswers | null = null;
  if (demo) {
    answers = harborlineOscAnswers();
  } else if (isSubmissionId(id)) {
    answers = getSubmission(id)?.answers ?? null;
  }

  if (!answers) {
    return NextResponse.json(
      { error: "Use ?demo=1 (Harborline) or ?id=<submission>. Assessor only. Never email the filled xlsx." },
      { status: 400, headers: PII_CACHE_HEADERS }
    );
  }

  const filled =
    file === "required-data"
      ? await fillRequiredDataXlsx(answers)
      : file === "assessment-results"
        ? await fillAssessmentResultsXlsx(answers, undefined, undefined, {
            allowAssessmentResultsStub: true,
          })
        : await fillPreAssessmentXlsx(answers);

  return new NextResponse(new Uint8Array(filled.buffer), {
    status: 200,
    headers: {
      ...PII_CACHE_HEADERS,
      "Content-Type": filled.contentType,
      "Content-Disposition": `attachment; filename="${filled.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Prescope-Handling": "CUI-When-Filled-In; Box-00-Internal-only; do-not-email",
    },
  });
}
