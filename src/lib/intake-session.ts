import { emptyAnswers, normalizeHostFedramp, normalizeProvider, syncHeadcountAliases, type FormAnswers } from "./types.ts";

export const INTAKE_DRAFT_KEY = "prescope-osc-draft";

export type IntakeGapRow = { nav: string; messages: string[] };

export type IntakeDraft = {
  answers: FormAnswers;
  idx: number;
  beat: number;
  /** Persisted only so a Back-to-Welcome click can be written; ignored on load. */
  welcome: boolean;
  gapSummary: IntakeGapRow[];
};

export type IntakeSession = {
  answers: FormAnswers;
  idx: number;
  beat: number;
  welcome: boolean;
  gapSummary: IntakeGapRow[];
};

/**
 * Fresh load / hard refresh of `/intake`.
 *
 * Welcome is a per-session gate: show WelcomeIntro unless this load is the
 * documented tester seed (`?demo=1`). A stored draft still restores answers
 * and step so Start continues mid-form — it must not skip Welcome.
 */
export function intakeSessionFromLoad(input: {
  seeded: FormAnswers | null;
  draft: IntakeDraft | null;
}): IntakeSession {
  if (input.seeded) {
    return {
      answers: syncHeadcountAliases(input.seeded),
      idx: 0,
      beat: 0,
      welcome: false,
      gapSummary: [],
    };
  }
  const draft = input.draft;
  const resume = Boolean(draft && draftHasAnswers(draft.answers));
  return {
    answers: syncHeadcountAliases(draft?.answers ?? emptyAnswers()),
    idx: resume && draft ? draft.idx : 0,
    beat: resume && draft ? draft.beat : 0,
    welcome: true,
    gapSummary: draft?.gapSummary ?? [],
  };
}

export function draftHasAnswers(a: FormAnswers): boolean {
  const blank = emptyAnswers();
  return (Object.keys(blank) as (keyof FormAnswers)[]).some((k) => {
    const v = a[k];
    const b = blank[k];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "boolean") return v === true;
    if (typeof v === "string") return v.trim() !== "" && v !== b;
    return v !== b;
  });
}

export function parseIntakeDraft(raw: string | null): IntakeDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      answers?: Partial<FormAnswers>;
      idx?: unknown;
      beat?: unknown;
      welcome?: unknown;
      gapSummary?: unknown;
    };
    if (!parsed || typeof parsed !== "object" || !parsed.answers || typeof parsed.answers !== "object") return null;
    const answers: FormAnswers = {
      ...emptyAnswers(),
      ...parsed.answers,
      sps: Array.isArray(parsed.answers.sps) ? parsed.answers.sps.map(normalizeProvider) : [],
      device_classes: Array.isArray(parsed.answers.device_classes) ? parsed.answers.device_classes : [],
      cui_locations: Array.isArray(parsed.answers.cui_locations) ? parsed.answers.cui_locations : [],
      cui_host_fedramp: Array.isArray(parsed.answers.cui_host_fedramp)
        ? parsed.answers.cui_host_fedramp.map(normalizeHostFedramp)
        : [],
      specialized_kinds: Array.isArray(parsed.answers.specialized_kinds) ? parsed.answers.specialized_kinds : [],
      esp_kinds: Array.isArray(parsed.answers.esp_kinds)
        ? parsed.answers.esp_kinds.map((x) => (x === "CSP already listed" ? "CSP" : x))
        : [],
      consent_nocui: parsed.answers.consent_nocui === true,
      consent_notassessment: parsed.answers.consent_notassessment === true,
    };
    const idx =
      typeof parsed.idx === "number" && Number.isFinite(parsed.idx)
        ? Math.max(0, Math.min(7, Math.floor(parsed.idx)))
        : 0;
    const welcome = parsed.welcome !== false;
    const beat =
      typeof parsed.beat === "number" && Number.isFinite(parsed.beat) ? Math.max(0, Math.floor(parsed.beat)) : 0;
    const gapSummary = Array.isArray(parsed.gapSummary)
      ? parsed.gapSummary.filter(
          (row): row is IntakeGapRow =>
            !!row &&
            typeof row === "object" &&
            typeof (row as { nav?: unknown }).nav === "string" &&
            Array.isArray((row as { messages?: unknown }).messages),
        )
      : [];
    return { answers, idx, beat, welcome, gapSummary };
  } catch {
    return null;
  }
}
