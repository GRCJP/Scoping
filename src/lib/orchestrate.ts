import { createHash } from "node:crypto";
import { brand } from "./brand";
import { answersMarkdown, dropFolderName, internalMarkdown, sanitizeCustomer } from "./docs";
import { emassPackFilenames, emassXlsxFilenames } from "./emass";
import { newOpaqueId, newSubmissionId } from "./ids";
import { computePath } from "./path";
import { easternDate, runScope } from "./scoring";
import { contactEmail, contactName, orgName, syncHeadcountAliases, type FormAnswers, type OrchBeat, type Submission } from "./types";

export function answersFingerprint(answers: FormAnswers): string {
  return createHash("sha256").update(JSON.stringify(answers)).digest("hex");
}

export function processSubmission(raw: FormAnswers, fingerprint?: string): Submission {
  const answers: FormAnswers = {
    ...syncHeadcountAliases(raw),
    evidence_share: "Box",
  };
  const id = newSubmissionId();
  const submittedon = new Date().toISOString();
  const path = computePath(answers);
  const scope = runScope(answers);
  const customerOrg = orgName(answers);
  const folder = dropFolderName(customerOrg, submittedon);
  const day = easternDate(new Date(submittedon));
  const customer = sanitizeCustomer(customerOrg);
  const t0 = Date.now();
  const to = contactEmail(answers);

  const stamp = (beat: number, name: string, detail: string, offsetMs: number): OrchBeat => ({
    beat,
    name,
    status: "ok",
    at: new Date(t0 + offsetMs).toISOString(),
    detail,
  });

  const beats: OrchBeat[] = [
    stamp(
      1,
      "Collect",
      "Public form complete (OSC Information + L2 environment). No meeting required. No file upload. No CUID. Payload stored in-memory.",
      0
    ),
    stamp(
      2,
      "Write + summarize",
      `Descriptive scope summary written to the record. No verdict computed — readiness is decided on the call.`,
      40
    ),
    stamp(
      3,
      "Create DROP",
      `Empty folder created under dedicated Scoping parent “Scoping / OSC Discovery Drops” (NOT the assessment library, NOT a CUI library). Name: ${folder}. F1 stops here.`,
      90
    ),
    stamp(
      4,
      "Apply TEMPLATE",
      "F2 (folder-created in Drops parent): copied TEMPLATE → 00 Internal / 01 Answers / 02 Uploads / 03 Scoping call. Wrote customer Answers into 01 and internal Scope into 00. Customer shared link = 01 + 02 only.",
      160
    ),
    stamp(
      5,
      "Email CUSTOMER",
      `To ${to}: Box link to 01 Answers + 02 Uploads. No go/no-go, no red flags, no 00 Internal.`,
      220
    ),
    stamp(
      6,
      "Email ASSESSORS",
      `To ${brand.assessorMailbox}: intake complete, 00 Internal link. Call is confirmation, not discovery.`,
      280
    ),
    stamp(
      7,
      "Confirm later",
      "Scoping call is a quick reference confirmation, not learning the environment. Notes would land in 03 Scoping call.",
      320
    ),
  ];

  const boxDropId = newOpaqueId("fld_");
  const customerLink = `/drop/${id}/customer`;
  const internalUrl = `/drop/${id}/internal`;
  const dropUrl = `/drop/${id}/internal`;

  const answersMd = answersMarkdown(answers, submittedon, path);

  const internalMd = internalMarkdown(answers, scope, {
    submittedon,
    orchstatus: "AssessorsEmailed",
    boxInternalUrl: internalUrl,
    dropUrl,
    id,
  });

  const customerEmail = {
    to,
    subject: `OSC Discovery received — ${customerOrg}`,
    body: [
      `Thank you. We received the OSC Discovery questionnaire for ${customerOrg}.`,
      ``,
      `This is a copy of what you submitted, not a CMMC assessment. It is environment information so the C3PAO can identify what is being assessed.`,
      ``,
      `Your Box folder (01 Answers + 02 Uploads) is for evidence and is FedRAMP authorized or equivalent: ${customerLink}`,
      ``,
      `A short confirmation call comes later. No other OSCs can see this folder.`,
    ].join("\n"),
  };

  const assessorEmail = {
    to: brand.assessorMailbox,
    subject: `INTAKE ${customerOrg} — ${scope.infodetermination}`,
    body: [
      `Determination: ${scope.infodetermination}`,
      ``,
      `Line 1: ${scope.assess_line1}`,
      `Line 2: ${scope.assess_line2}`,
      `Line 3: ${scope.assess_line3}`,
      ``,
      `Record: /assessor/${id}`,
      `Box 00 Internal: ${internalUrl}`,
      `DROP: ${dropUrl}`,
      `Assessment Official: ${contactName(answers)} <${to}>`,
      ``,
      `Call is confirmation, not discovery.`,
    ].join("\n"),
  };

  const packNames = emassPackFilenames(customerOrg);
  const xlsxNames = emassXlsxFilenames(customerOrg);

  return {
    id,
    name: `${customerOrg} - ${day}`,
    submittedon,
    orchstatus: "AssessorsEmailed",
    path,
    fingerprint: fingerprint ?? answersFingerprint(answers),
    answers,
    scope,
    answersMarkdown: answersMd,
    internalMarkdown: internalMd,
    beats,
    box: {
      parentName: "Scoping / OSC Discovery Drops",
      parentNote:
        "Dedicated Scoping parent. Not the CMMC assessment library. Not a CUI library. Empty DROP is created here, then TEMPLATE is applied.",
      dropFolderName: folder,
      dropFolderId: boxDropId,
      customerLink,
      internalUrl,
      dropUrl,
      files: [
        ...packNames.map((name) => ({
          folder: "00 Internal" as const,
          name,
          kind: "md" as const,
          customerVisible: false,
        })),
        {
          folder: "00 Internal" as const,
          name: xlsxNames.preAssessment,
          kind: "xlsx" as const,
          customerVisible: false,
        },
        {
          folder: "00 Internal" as const,
          name: xlsxNames.requiredData,
          kind: "xlsx" as const,
          customerVisible: false,
        },
        {
          folder: "00 Internal" as const,
          name: xlsxNames.assessmentResults,
          kind: "xlsx" as const,
          customerVisible: false,
        },
        {
          folder: "01 Answers",
          name: `${customer} - OSC Discovery Answers - ${day}.md`,
          kind: "md",
          customerVisible: true,
        },
        {
          folder: "02 Uploads",
          name: "README-uploads.txt",
          kind: "txt",
          customerVisible: true,
        },
        {
          folder: "03 Scoping call",
          name: "README-call.txt",
          kind: "txt",
          customerVisible: false,
        },
      ],
    },
    customerEmail,
    assessorEmail,
  };
}

export const UPLOADS_README =
  "Upload assessment evidence to this folder. This Box folder is FedRAMP authorized or equivalent.";

export const CALL_README =
  "Scoping call notes land here later. The call is a quick reference confirmation — not a discovery interview. Discovery was collected on the public form.";
