/**
 * POST /fill handler. Same mapper as the Next app and FILL_MODE=node.
 * Do not add a second spreadsheet map.
 */
import { authorizeRequest } from "../src/auth.ts";
import { acceptOfficialAssessmentResultsOutput } from "../../../src/lib/assessment-results-sheets.ts";
import { fillEmassXlsxPack, type EmassTemplateBytes } from "../../../src/lib/emass-xlsx.ts";
import { parseSubmitBody } from "../../../src/lib/submit-body.ts";

export const FILL_BODY_MAX_BYTES = 8 * 1024 * 1024;

function templateRoot(): string {
  return (process.env.EMASS_TEMPLATE_ROOT || "").trim() || process.cwd();
}

export type FillHandlerResult = { status: number; data: unknown };

function workbookConcurrency(): 1 | 2 | 3 {
  const n = Number((process.env.FILL_CONCURRENCY || "1").trim());
  if (n === 2 || n === 3) return n;
  return 1;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decodeTemplatePart(raw: unknown): Uint8Array | undefined {
  const rec = asRecord(raw);
  const b64 = typeof rec?.base64 === "string" ? rec.base64 : typeof raw === "string" ? raw : "";
  if (!b64) return undefined;
  const buf = Buffer.from(b64, "base64");
  return buf.byteLength > 0 ? buf : undefined;
}

function templatesFromBody(raw: unknown): EmassTemplateBytes | undefined {
  const rec = asRecord(raw);
  if (!rec) return undefined;
  const templates: EmassTemplateBytes = {
    preAssessment: decodeTemplatePart(rec.preAssessment),
    requiredData: decodeTemplatePart(rec.requiredData),
    assessmentResults: decodeTemplatePart(rec.assessmentResults),
  };
  if (!templates.preAssessment && !templates.requiredData && !templates.assessmentResults) return undefined;
  return templates;
}

export function authorizedFillRequest(headers: Headers, secret: string): boolean {
  return authorizeRequest(headers, secret);
}

export async function handleFillHttp(
  method: string,
  pathname: string,
  headers: Headers,
  bodyText: string,
  secret: string,
): Promise<FillHandlerResult> {
  if (method === "GET" && (pathname === "/health" || pathname === "/")) {
    return { status: 200, data: { ok: true, service: "prescope-fill" } };
  }
  if (method !== "POST" || pathname !== "/fill") {
    return { status: 404, data: { error: "Not found." } };
  }
  if (!authorizedFillRequest(headers, secret)) {
    return { status: 401, data: { error: "Unauthorized." } };
  }
  if (new TextEncoder().encode(bodyText).length > FILL_BODY_MAX_BYTES) {
    return { status: 413, data: { error: "Payload too large." } };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyText) as unknown;
  } catch {
    return { status: 400, data: { error: "Invalid JSON." } };
  }
  const rec = asRecord(parsedJson);
  if (!rec) return { status: 400, data: { error: "Invalid JSON." } };

  const parsed = parseSubmitBody(JSON.stringify({ answers: rec.answers }));
  if (!parsed.ok) {
    return { status: parsed.status, data: { error: parsed.error, field: parsed.field } };
  }

  try {
    const pack = await fillEmassXlsxPack(parsed.answers, templateRoot(), templatesFromBody(rec.templates), {
      // Sidecar never invents Cover + thin tabs. Official Box bytes in POST, or skip.
      allowAssessmentResultsStub: false,
      assessmentResultsFromBytesOnly: true,
      concurrency: workbookConcurrency(),
    });
    let assessmentResults = pack.assessmentResults;
    let assessmentResultsSkipped = pack.assessmentResultsSkipped;
    if (assessmentResults) {
      const accepted = acceptOfficialAssessmentResultsOutput(assessmentResults.buffer);
      if (!accepted.bytes) {
        assessmentResults = undefined;
        assessmentResultsSkipped = accepted.skipped;
      }
    }
    return {
      status: 200,
      data: {
        preAssessment: {
          filename: pack.preAssessment.filename,
          contentType: pack.preAssessment.contentType,
          base64: pack.preAssessment.buffer.toString("base64"),
        },
        requiredData: {
          filename: pack.requiredData.filename,
          contentType: pack.requiredData.contentType,
          base64: pack.requiredData.buffer.toString("base64"),
        },
        ...(assessmentResults
          ? {
              assessmentResults: {
                filename: assessmentResults.filename,
                contentType: assessmentResults.contentType,
                base64: assessmentResults.buffer.toString("base64"),
              },
            }
          : { assessmentResultsSkipped }),
      },
    };
  } catch (err) {
    return { status: 500, data: { error: err instanceof Error ? err.message : "Fill failed." } };
  }
}
