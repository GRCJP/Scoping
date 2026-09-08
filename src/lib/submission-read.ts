import { isSubmissionId } from "./ids.ts";
import { PII_CACHE_HEADERS } from "./security-headers.ts";
import { getSubmission } from "./store.ts";
import { toAssessorSubmissionDto } from "./submission-dto.ts";

export function readAssessorSubmissionJson(id: string): {
  status: number;
  headers: Record<string, string>;
  body: unknown;
} {
  if (!isSubmissionId(id)) {
    return { status: 404, headers: { ...PII_CACHE_HEADERS }, body: { error: "Not found" } };
  }
  const s = getSubmission(id);
  if (!s) {
    return { status: 404, headers: { ...PII_CACHE_HEADERS }, body: { error: "Not found" } };
  }
  return { status: 200, headers: { ...PII_CACHE_HEADERS }, body: toAssessorSubmissionDto(s) };
}
