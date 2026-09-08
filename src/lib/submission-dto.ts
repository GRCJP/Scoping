import type { Submission } from "./types";

/**
 * Assessor JSON for GET /api/submissions/[id].
 * Never include fingerprint (dedupe material) or other bookkeeping.
 * Internal markdown / emails stay — this route is assessor-gated.
 */
export function toAssessorSubmissionDto(s: Submission) {
  return {
    id: s.id,
    name: s.name,
    submittedon: s.submittedon,
    orchstatus: s.orchstatus,
    path: s.path,
    answers: s.answers,
    scope: s.scope,
    answersMarkdown: s.answersMarkdown,
    internalMarkdown: s.internalMarkdown,
    beats: s.beats,
    box: s.box,
    customerEmail: s.customerEmail,
    assessorEmail: s.assessorEmail,
    preferredDates: s.preferredDates,
  };
}

export type AssessorSubmissionDto = ReturnType<typeof toAssessorSubmissionDto>;
