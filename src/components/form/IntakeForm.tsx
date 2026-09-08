"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressIntake, type AddressFlush } from "@/components/form/AddressIntake";
import { AreaField, ChoicePills, MultiSelectField, RevealSlot, TextField } from "@/components/form/Field";
import { InfoTip } from "@/components/form/InfoTip";
import { WelcomeIntro } from "@/components/form/WelcomeIntro";
import { ScopeWarningBanner } from "@/components/form/ScopeWarningBanner";
import { remainingCopy, StepRail } from "@/components/form/StepRail";
import { beatsForStep, clampBeatIndex, progressPercent, RECAP_JUMPS, reviewRailBeatIdx } from "@/lib/beats";
import {
  CISA_SECTORS,
  CUI_LOCATIONS,
  ENV_MODES,
  CUI_VS_SPD,
  HOST_FEDRAMP,
  MFA_COVERAGE,
  PROVIDER_FEDRAMP,
  PROVIDER_JOBS,
  SP_CMMC_STATUS,
  BACKUP_CLASSES,
  YES_NO_NA_ONLY,
  SCOPE_MODES,
  SEPARATION,
  YES_NO_DK,
  YES_NO_NA,
  YES_NO_PARTIAL,
} from "@/lib/choices";
import { stepsForPath } from "@/lib/path";
import { emptyProvider, syncHeadcountAliases, type FormAnswers, type ServiceProvider } from "@/lib/types";
import { applyCuiLocationChange, applyHasSpsChange, applyHqNameChange, patchAnswers, patchAnswersMany } from "@/lib/answers";
import { answersIfDemoQuery } from "@/lib/demo-fill";
import { INTAKE_DRAFT_KEY, intakeSessionFromLoad, parseIntakeDraft } from "@/lib/intake-session";
import { successPathForId } from "@/lib/ids";
import {
  CAGE_LEN,
  CAGE_LIST_LEN,
  cageFieldError,
  companyCageErrors,
  consentsAccepted,
  firstIncompleteBeatIdx,
  firstIncompleteGap,
  normalizeCage,
  normalizeCageList,
  normalizeCageTyping,
  validateStep,
  type CageFieldKey,
} from "@/lib/validate";
import { BrandMark } from "@/components/layout/BrandMark";

const TIPS = {
  ao: "The person with signature authority for this OSC. We email them a copy of these answers. Not the same as the Technical POC.",
  scope:
    "Enterprise = the whole organization is in scope. Enclave = a bounded slice (people, systems, CUI path) carved out from the rest.",
  esp: "External Service Provider — MSP, SOC, MDR, or similar. Anyone outside your staff who runs or sees this environment.",
  csp: "Cloud Service Provider — a vendor that hosts or processes CUI in their cloud (for example Microsoft).",
  crma: "Contractor Risk Managed Assets — systems that could touch CUI but are kept from doing so by policy or technical controls.",
  oos: "Out of scope means it cannot store, process, or transmit CUI and cannot reach a CUI system. Same login, print queue, file share, backup, or thumb drive means it is not out of scope.",
  vdi: "Virtual Desktop Infrastructure, or any remote desktop into the CUI environment. If they can download or print from that session, CUI can leave.",
  crm: "Customer Responsibility Matrix — a written list of which practices the provider covers (inherited) versus which you still own.",
  fedramp:
    "GCC High is equivalent only if you tag it that way; still name the offering. The Service Offering column, not the company. No CUI. CAP checks Marketplace Provider + Service Offering.",
  offering: "The Marketplace Service Offering column. Not the company name. “Microsoft” is not an offering name. No CUI.",
  providerJob: "Pick the job they actually do in this environment.",
  cuiVsSpd: "CUI vs SPD. Don’t know is allowed.",
  ownCmmc: "Non-CSP ESPs that handle CUI are assessed in your scope or they bring a certificate.",
  vendorSrm: "PreVeil, CATO, Blueshift, M365 CRM/SRM. Do not upload.",
  physical: "This decides hybrid vs virtual. You do not pick virtual.",
  crmaHas: "Contractor Risk Managed Assets — systems that could touch CUI but you keep off CUI by policy or technical control.",
  crmaAccident: "If yes, that asset is a CUI Asset, not CRMA.",
  interviewTitles: "Assessment Official, sysadmin, CUI users, ESP POC. Titles only. Not people names.",
  sspTypes: "Types only. Do not upload. No CUI, no filenames of CUI files.",
  boundary:
    "The line between systems that handle CUI and everything else. “Defined” means you can point to it (diagram, policy, or enclave).",
  ssp: "System Security Plan — how you protect CUI. Partial or in progress is a valid answer. This is not a SPRS score.",
  poam: "Plan of Action and Milestones — known gaps you are working. Notes should not include CUI or scores.",
  hlocage:
    "The CAGE of the highest-level owner of this OSC — the parent at the top of the corporate tree. Not a CMMC UID.",
  separation:
    "Logical = network, identity, or tenant isolation. Physical = separate rooms, racks, or sites. Both if you have both. Neither / unclear if you cannot point to a line.",
};

function hostFedrampLabel(host: string): string {
  return host === "On-prem file shares / servers" ? "On-prem — N/A if no CSP" : `${host} — authorization`;
}

/** Same path as empty CAGE: find #field-* then the aria-invalid control. */
function focusGapControl(root: HTMLElement | null, keys: string[]) {
  if (!root || !keys.length) return;
  document.getElementById("pscSubmit")?.blur();
  for (const key of keys) {
    const wrap = root.querySelector(`#field-${CSS.escape(key)}`);
    if (!(wrap instanceof HTMLElement)) continue;
    wrap.scrollIntoView({ block: "center" });
    const invalid = wrap.querySelector<HTMLElement>("[aria-invalid='true']");
    const box =
      wrap.querySelector<HTMLElement>("input[type='checkbox']") ??
      wrap.querySelector<HTMLElement>("[role='checkbox']");
    const focusable =
      invalid ??
      box ??
      wrap.querySelector<HTMLElement>("textarea, select, input:not([type=hidden])") ??
      wrap;
    if (focusable === wrap && !wrap.hasAttribute("tabindex")) wrap.tabIndex = -1;
    focusable.focus();
    return;
  }
}

function IntakeHeaderMark() {
  return (
    <div className="flex items-center justify-center px-6 pt-6 pb-4">
      <BrandMark href="/" />
    </div>
  );
}

function writeDraft(
  answers: FormAnswers,
  idx: number,
  beat: number,
  welcome: boolean,
  gapSummary: { nav: string; messages: string[] }[],
) {
  try {
    sessionStorage.setItem(INTAKE_DRAFT_KEY, JSON.stringify({ answers, idx, beat, welcome, gapSummary }));
  } catch {
    /* quota / private mode */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(INTAKE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function FieldGroup({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) {
  return (
    <section className="space-y-6">
      <p className="font-semibold text-white inline-flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600 }}>
        {label}
        {tip ? <InfoTip label={label}>{tip}</InfoTip> : null}
      </p>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function RecapRow({
  label,
  value,
  onJump,
}: {
  label: string;
  value: string;
  onJump?: () => void;
}) {
  if (!value.trim()) return null;
  const short = value.length < 48 && !value.includes("\n");
  const valueNode = short ? (
    <span className="inline-flex min-h-11 items-center rounded-full bg-gold px-3.5 text-[15px] font-medium text-navy">
      {value}
    </span>
  ) : (
    <p className="text-white leading-relaxed">{value}</p>
  );
  if (!onJump) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-white font-semibold sm:w-52 shrink-0" style={{ fontSize: 18, fontWeight: 600 }}>{label}</p>
        {valueNode}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onJump}
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      aria-label={`Go to ${label}`}
    >
      <span className="text-white font-semibold sm:w-52 shrink-0 underline underline-offset-2" style={{ fontSize: 18, fontWeight: 600 }}>
        {label}
      </span>
      {valueNode}
    </button>
  );
}

function reviewRecapRows(a: FormAnswers): { label: string; value: string }[] {
  const official = [a.ao_first, a.ao_last].filter(Boolean).join(" ");
  const ssp =
    a.ssp_exists === "Yes" || a.ssp_exists === "Partial / in progress"
      ? [a.ssp_exists, a.ssp_artifacts_exist, a.ssp_artifact_types].filter(Boolean).join(" · ")
      : a.ssp_exists;
  return [
    { label: "Organization", value: a.oscname || a.hqname },
    { label: "Scope", value: a.scopemode },
    { label: "Official", value: official },
    { label: "Providers", value: a.has_sps },
    { label: "CUI locations", value: (a.cui_locations || []).join("; ") },
    { label: "Backups", value: [a.cui_backup_commercial, a.cui_backup_where].filter(Boolean).join(" · ") },
    { label: "MFA", value: [a.mfa_solution, a.mfa_coverage].filter(Boolean).join(" · ") },
    { label: "SSP", value: ssp },
    { label: "POA&M", value: a.poam_open === "Yes" ? [a.poam_open, a.poam_conditional].filter(Boolean).join(" · ") : a.poam_open },
    { label: "Fix during assessment", value: a.fix_during_assessment },
    { label: "Freeze", value: a.freeze_during_assessment },
    { label: "Migration", value: a.migrate_during_assessment },
  ].filter((row) => row.value.trim());
}

export function IntakeForm() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return (
      <div className="h-screen overflow-hidden intake-dark flex flex-col">
        <header className="shrink-0">
          <IntakeHeaderMark />
        </header>
      </div>
    );
  }
  return <IntakeFormSession />;
}

function IntakeFormSession() {
  const router = useRouter();
  const seeded = answersIfDemoQuery(window.location.search);
  const draft = seeded ? null : parseIntakeDraft(sessionStorage.getItem(INTAKE_DRAFT_KEY));
  /* Welcome is per-session. Refresh shows WelcomeIntro; Start continues a draft. */
  const session = intakeSessionFromLoad({ seeded, draft });
  const [answers, setAnswers] = useState<FormAnswers>(() => session.answers);
  const [idx, setIdx] = useState(() => session.idx);
  const [beatIdx, setBeatIdx] = useState(() => session.beat);
  const [welcome, setWelcome] = useState(() => session.welcome);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [gapSummary, setGapSummary] = useState<{ nav: string; messages: string[] }[]>(
    () => session.gapSummary,
  );
  const submittingRef = useRef(false);
  const flushAddressRef = useRef<AddressFlush | null>(null);

  const flushAddress = () => {
    flushAddressRef.current?.();
  };
  const steps = useMemo(() => stepsForPath("standard"), []);
  const current = steps[Math.min(idx, steps.length - 1)];
  const beats = beatsForStep(current.id, answers);
  const safeBeatIdx = clampBeatIndex(current.id, answers, beatIdx);
  const currentBeat = beats[safeBeatIdx] ?? beats[0];
  const fill = progressPercent(welcome, idx, safeBeatIdx, beats.length, steps.length);

  const wellRef = useRef<HTMLDivElement>(null);
  const focusErrorsRef = useRef(false);

  useEffect(() => {
    wellRef.current?.scrollTo({ top: 0 });
  }, [idx, safeBeatIdx, welcome]);

  useEffect(() => {
    writeDraft(answers, idx, safeBeatIdx, welcome, gapSummary);
  }, [answers, idx, safeBeatIdx, welcome, gapSummary]);

  useEffect(() => {
    if (welcome) return;
    if (!focusErrorsRef.current) return;
    focusErrorsRef.current = false;
    const keys = Object.keys(errors);
    if (!keys.length) return;
    const root = wellRef.current;
    if (!root) return;
    const frame = requestAnimationFrame(() => {
      focusGapControl(root, keys);
    });
    return () => cancelAnimationFrame(frame);
  }, [errors, idx, safeBeatIdx, welcome]);

  const commitAnswers = (recipe: (prev: FormAnswers) => FormAnswers, keys: string[]) => {
    setAnswers((prev) => {
      const next = recipe(prev);
      if (gapSummary.length) {
        const gap = firstIncompleteGap(next, "standard", steps, beatsForStep);
        setGapSummary(gap ? gap.summary : []);
      }
      return next;
    });
    setErrors((e) => {
      let changed = false;
      const cleared = { ...e };
      for (const key of keys) {
        if (!cleared[key]) continue;
        delete cleared[key];
        changed = true;
      }
      return changed ? cleared : e;
    });
  };

  const patch = <K extends keyof FormAnswers>(key: K, value: FormAnswers[K]) => {
    commitAnswers((prev) => patchAnswers(prev, key, value), [key as string]);
  };

  const patchMany = (updates: Partial<FormAnswers>) => {
    commitAnswers((prev) => patchAnswersMany(prev, updates), Object.keys(updates));
  };

  const begin = () => {
    setWelcome(false);
    setErrors({});
    setSubmitError("");
    setGapSummary([]);
  };

  const incompleteFlags = useMemo(
    () => steps.map((s) => Object.keys(validateStep(s.id, answers, "standard")).length > 0),
    [answers, steps],
  );

  const applyErrors = (errs: Record<string, string>) => {
    setErrors(errs);
    // Gap errors stay inline + in the footer list. Do not repeat the first
    // message as a third sticky line.
    setSubmitError("");
    return Object.keys(errs).length > 0;
  };

  const goNext = () => {
    flushAddress();
    setSubmitError("");
    // Company CAGE only — do not validate other steps (Providers Yes stays as-is).
    if (current.id === "P1") {
      const cageErrs = companyCageErrors(answers);
      if (Object.keys(cageErrs).length) {
        focusErrorsRef.current = true;
        applyErrors(cageErrs);
        return;
      }
    }
    setErrors({});
    if (safeBeatIdx < beats.length - 1) {
      setBeatIdx(safeBeatIdx + 1);
      return;
    }
    if (idx < steps.length - 1) {
      setIdx(idx + 1);
      setBeatIdx(0);
    }
  };

  const onCageBlur = (key: CageFieldKey) => {
    const raw = answers[key];
    const next = key === "hlocage" ? normalizeCage(raw) : normalizeCageList(raw);
    if (next !== raw) patch(key, next);
    const msg = cageFieldError(key, next);
    setErrors((e) => {
      if (msg) return { ...e, [key]: msg };
      if (!e[key]) return e;
      const rest = { ...e };
      delete rest[key];
      return rest;
    });
  };

  const goBack = () => {
    flushAddress();
    setErrors({});
    setSubmitError("");
    if (safeBeatIdx > 0) {
      setBeatIdx(safeBeatIdx - 1);
      return;
    }
    if (idx === 0) {
      setWelcome(true);
      return;
    }
    const prev = steps[idx - 1];
    const prevLast = Math.max(0, beatsForStep(prev.id, answers).length - 1);
    setIdx(idx - 1);
    setBeatIdx(prevLast);
  };

  const goToReviewSubmit = () => {
    flushAddress();
    const reviewIdx = steps.findIndex((s) => s.id === "G");
    const lastBeat = Math.max(0, beatsForStep("G", answers).length - 1);
    setIdx(reviewIdx === -1 ? steps.length - 1 : reviewIdx);
    setBeatIdx(lastBeat);
  };

  const onReviewConsents = current.id === "G" && currentBeat.id === "consents";
  const showReturnToReview = gapSummary.length > 0 && !onReviewConsents;

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const gap = firstIncompleteGap(answers, "standard", steps, beatsForStep);
    if (gap || !consentsAccepted(answers)) {
      submittingRef.current = false;
      const blocked = gap ?? {
        stepIdx: steps.findIndex((s) => s.id === "G"),
        beatIdx: reviewRailBeatIdx(true, answers),
        summary: [{ nav: "Review", messages: Object.values(validateStep("G", answers, "standard")) }],
        errors: validateStep("G", answers, "standard"),
      };
      setIdx(Math.max(0, blocked.stepIdx));
      setBeatIdx(blocked.beatIdx);
      setGapSummary(blocked.summary);
      focusErrorsRef.current = true;
      applyErrors(blocked.errors);
      const keys = Object.keys(blocked.errors);
      window.setTimeout(() => focusGapControl(wellRef.current, keys), 0);
      return;
    }
    setBusy(true);
    setSubmitError("");
    try {
      const payload: FormAnswers = {
        ...syncHeadcountAliases(answers),
        evidence_share: "Box",
      };
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        submittingRef.current = false;
        setSubmitError(json.error || "Submit failed");
        setBusy(false);
        return;
      }
      clearDraft();
      // Serverless has no shared store: carry the thank-you copy client-side.
      try {
        sessionStorage.setItem(
          "psc:thankyou",
          JSON.stringify({ firstName: json.firstName, customerLink: json.customerLink })
        );
      } catch {
        // storage disabled — /success/[id] falls back to generic copy
      }
      const fromBody =
        typeof json.redirect === "string" && successPathForId(json.redirect.slice("/success/".length))
          ? json.redirect
          : null;
      const dest = fromBody || (typeof json.id === "string" ? successPathForId(json.id) : null);
      if (!dest) {
        submittingRef.current = false;
        setSubmitError("Submit succeeded but the thank-you link was missing an id.");
        setBusy(false);
        return;
      }
      router.push(dest);
    } catch {
      submittingRef.current = false;
      setSubmitError("Network error. Try again.");
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || welcome) return;
    const moreBeats = safeBeatIdx < beats.length - 1;
    if (idx < steps.length - 1 || moreBeats) goNext();
    else {
      document.getElementById("pscSubmit")?.blur();
      void submit();
    }
  };

  return (
    <div className="h-screen overflow-hidden intake-dark flex flex-col">
      <header className="shrink-0">
        <IntakeHeaderMark />
        {!welcome ? (
          <div
            className="h-2 mx-4 sm:mx-5 rounded-full overflow-hidden"
            style={{ backgroundColor: "#12366C" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fill)}
            aria-label="Intake progress"
          >
            <div className="h-full bg-gold rounded-full transition-[width] duration-300" style={{ width: `${fill}%` }} />
          </div>
        ) : null}
        <StepRail
          steps={steps}
          idx={idx}
          started={!welcome}
          incomplete={incompleteFlags}
          onSelect={(i) => {
            flushAddress();
            setErrors({});
            setSubmitError("");
            setIdx(i);
            /* First Review visit lands on recap. After a Submit gap-jump,
               Back to Review / the rail may land on consents. */
            if (steps[i].id === "G") {
              setBeatIdx(reviewRailBeatIdx(gapSummary.length > 0, answers));
            } else {
              setBeatIdx(firstIncompleteBeatIdx(steps[i].id, answers, "standard", beatsForStep));
            }
          }}
        />
        <ScopeWarningBanner />
      </header>

      {welcome ? (
        <div ref={wellRef} className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-full max-w-3xl mx-auto px-5 pt-10 pb-10 text-center">
            <WelcomeIntro onStart={begin} />
          </div>
        </div>
      ) : (
        <form className="flex-1 flex flex-col min-h-0 overflow-hidden" onSubmit={onSubmit} noValidate>
          <div ref={wellRef} className="flex-1 min-h-0 overflow-y-auto">
            <div className="w-full max-w-[40rem] mx-auto px-5 pt-10 pb-10 space-y-10">
              <div className="space-y-10">
                <div>
                  <h1 className="font-display text-5xl sm:text-6xl text-white font-semibold leading-[1.05]">
                    {current.title}
                  </h1>
                  {safeBeatIdx === 0 ? (
                    <p className="text-white mt-6 leading-relaxed text-xl">{current.blurb}</p>
                  ) : null}
                </div>
                {current.id === "P1" && (
                  <StepP1
                    beatId={currentBeat.id}
                    a={answers}
                    patch={patch}
                    patchMany={patchMany}
                    patchHqName={(v) => commitAnswers((prev) => applyHqNameChange(prev, v), ["hqname", "oscname"])}
                    errors={errors}
                    flushAddressRef={flushAddressRef}
                    onCageBlur={onCageBlur}
                  />
                )}
                {current.id === "P2" && <StepP2 beatId={currentBeat.id} a={answers} patch={patch} errors={errors} />}
                {current.id === "P3" && (
                  <StepP3
                    beatId={currentBeat.id}
                    a={answers}
                    patch={patch}
                    patchHasSps={(v) => commitAnswers((prev) => applyHasSpsChange(prev, v), ["has_sps"])}
                    errors={errors}
                  />
                )}
                {current.id === "E1" && <StepE1 beatId={currentBeat.id} a={answers} patch={patch} errors={errors} />}
                {current.id === "E2" && (
                  <StepE2
                    beatId={currentBeat.id}
                    a={answers}
                    patch={patch}
                    patchCuiLocations={(v) =>
                      commitAnswers((prev) => applyCuiLocationChange(prev, v), ["cui_locations", "cui_host_fedramp"])
                    }
                    errors={errors}
                  />
                )}
                {current.id === "E3" && <StepE3 beatId={currentBeat.id} a={answers} patch={patch} errors={errors} />}
                {current.id === "E4" && <StepE4 beatId={currentBeat.id} a={answers} patch={patch} errors={errors} />}
                {current.id === "G" && (
                  <StepG
                    beatId={currentBeat.id}
                    a={answers}
                    patch={patch}
                    errors={errors}
                    onJumpRecap={(stepId, beatId) => {
                      const stepIdx = steps.findIndex((s) => s.id === stepId);
                      if (stepIdx < 0) return;
                      const destBeats = beatsForStep(steps[stepIdx].id, answers);
                      const destBeat = destBeats.findIndex((b) => b.id === beatId);
                      setErrors({});
                      setSubmitError("");
                      setIdx(stepIdx);
                      setBeatIdx(destBeat >= 0 ? destBeat : 0);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 z-20 border-t border-white">
            {gapSummary.length && !onReviewConsents ? (
              <div className="max-w-[40rem] mx-auto px-5 pt-3 text-base text-white space-y-1">
                <p className="font-medium">Still required before submit</p>
                <p>{gapSummary.map((g) => g.nav).join(" · ")}</p>
                {gapSummary
                  .flatMap((g) => g.messages)
                  .filter((m, i, all) => all.indexOf(m) === i)
                  .filter((m) => !Object.values(errors).includes(m))
                  .map((m) => (
                    <p key={m}>{m}</p>
                  ))}
              </div>
            ) : null}
            {showReturnToReview ? (
              <div className="max-w-[40rem] mx-auto px-5 pt-2">
                <button
                  type="button"
                  onClick={goToReviewSubmit}
                  className="text-white underline underline-offset-2"
                  style={{ fontSize: 16 }}
                  aria-label="Return to submit"
                >
                  Back to Review
                </button>
              </div>
            ) : null}
            {submitError ? (
              <p className="max-w-[40rem] mx-auto px-5 pt-3 text-base text-[#FCA5A5]">{submitError}</p>
            ) : null}
            <div className="max-w-[40rem] mx-auto px-5 py-4 flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={goBack} disabled={busy} className="text-white hover:text-white hover:bg-navy-700">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <p className="flex-1 min-w-0 text-center font-normal" style={{ fontSize: 16, color: "#FFFFFF" }}>
                {idx + 1} of {steps.length} · {remainingCopy(idx, steps.length, safeBeatIdx, beats.length)}
              </p>
              {idx < steps.length - 1 || safeBeatIdx < beats.length - 1 ? (
                <Button type="submit" size="lg" className="min-w-[9.5rem] h-12">
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" id="pscSubmit" size="lg" disabled={busy} className="min-w-[9.5rem] h-12">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Submit
                </Button>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function StepP1({
  beatId: _beatId,
  a,
  patch,
  patchMany,
  patchHqName,
  errors,
  flushAddressRef,
  onCageBlur,
}: {
  beatId: string;
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  patchMany: (updates: Partial<FormAnswers>) => void;
  patchHqName: (v: string) => void;
  errors: Record<string, string>;
  flushAddressRef: MutableRefObject<AddressFlush | null>;
  onCageBlur: (key: CageFieldKey) => void;
}) {
  return (
    <>
      <FieldGroup label="Who you are">
        <TextField label="HQ organization name" required value={a.hqname} onChange={patchHqName} fieldKey="hqname" error={errors.hqname} />
        <TextField
          label="UEI"
          required
          hint="Unique Entity ID. Not a CMMC UID. Do not enter a CUID."
          value={a.uei}
          onChange={(v) => patch("uei", v)}
          fieldKey="uei" error={errors.uei}
        />
        <TextField label="OSC name" required hint="The organization seeking certification." value={a.oscname} onChange={(v) => patch("oscname", v)} fieldKey="oscname" error={errors.oscname} />
        <TextField label="DBA" hint="Optional. Doing business as, if different from the OSC name." value={a.dba} onChange={(v) => patch("dba", v)} />
      </FieldGroup>
      <FieldGroup label="Address">
        <AddressIntake a={a} patch={patch} patchMany={patchMany} errors={errors} flushRef={flushAddressRef} />
        <TextField label="Business phone" value={a.businessphone} onChange={(v) => patch("businessphone", v)} fieldKey="businessphone" error={errors.businessphone} />
        <TextField label="Website" type="url" value={a.website} onChange={(v) => patch("website", v)} fieldKey="website" error={errors.website} />
      </FieldGroup>
      <FieldGroup label="Sector and CUI users">
        <ChoicePills
          label="Sector (CISA)"
          required
          hint="eMASS accepts more than one, separated by semicolons. This form sends the one you pick."
          options={CISA_SECTORS}
          value={a.sector}
          onChange={(v) => patch("sector", v)}
          fieldKey="sector" error={errors.sector}
        />
        {a.sector === "Other" ? (
          <TextField label="Other sector" value={a.sectorother} onChange={(v) => patch("sectorother", v)} fieldKey="sectorother" error={errors.sectorother} />
        ) : null}
        <TextField
          label="How many users will access CUI?"
          required
          hint="People who will store, process, or transmit CUI. An estimate is fine."
          value={a.cui_users}
          onChange={(v) => patch("cui_users", v)}
          fieldKey="cui_users" error={errors.cui_users}
        />
      </FieldGroup>
      <FieldGroup label="Identifiers">
        <TextField
          label="Highest Level Owner (HLO) CAGE"
          required
          tip={TIPS.hlocage}
          value={a.hlocage}
          onChange={(v) => patch("hlocage", normalizeCageTyping(v))}
          onBlur={() => onCageBlur("hlocage")}
          maxLength={CAGE_LEN}
          autoCapitalize="characters"
          spellCheck={false}
          fieldKey="hlocage"
          error={errors.hlocage}
        />
        <TextField
          label="CAGE code(s) in scope"
          required
          hint="Semicolons if more than one. This is not a CMMC UID."
          value={a.cageinscope}
          onChange={(v) => patch("cageinscope", normalizeCageTyping(v))}
          onBlur={() => onCageBlur("cageinscope")}
          maxLength={CAGE_LIST_LEN}
          autoCapitalize="characters"
          spellCheck={false}
          fieldKey="cageinscope"
          error={errors.cageinscope}
        />
      </FieldGroup>
      <FieldGroup label="What's in scope">
        <ChoicePills
          label="Scope"
          required
          tip={TIPS.scope}
          options={SCOPE_MODES}
          value={a.scopemode}
          onChange={(v) => patch("scopemode", v)}
          fieldKey="scopemode" error={errors.scopemode}
        />
        {a.scopemode === "Enclave" ? (
          <AreaField
            label="Scope description"
            required
            hint="What is in the enclave vs out. No CUI content."
            value={a.scopedesc}
            onChange={(v) => patch("scopedesc", v)}
            fieldKey="scopedesc" error={errors.scopedesc}
          />
        ) : null}
      </FieldGroup>
    </>
  );
}

function StepP2({
  beatId,
  a,
  patch,
  errors,
}: {
  beatId: string;
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <FieldGroup label="Assessment Official" tip={TIPS.ao}>
        <p className="text-white -mt-2" style={{ fontSize: 16 }}>Signature authority</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Last name" required value={a.ao_last} onChange={(v) => patch("ao_last", v)} fieldKey="ao_last" error={errors.ao_last} />
          <TextField label="First name" required value={a.ao_first} onChange={(v) => patch("ao_first", v)} fieldKey="ao_first" error={errors.ao_first} />
        </div>
        <TextField label="Title" required value={a.ao_title} onChange={(v) => patch("ao_title", v)} fieldKey="ao_title" error={errors.ao_title} />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Email" required type="email" value={a.ao_email} onChange={(v) => patch("ao_email", v)} fieldKey="ao_email" error={errors.ao_email} hint="We email a copy of your answers here." />
          <TextField label="Phone" required value={a.ao_phone} onChange={(v) => patch("ao_phone", v)} fieldKey="ao_phone" error={errors.ao_phone} />
        </div>
      </FieldGroup>
      <FieldGroup label="Technical POC">
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Last name" required value={a.tpoc_last} onChange={(v) => patch("tpoc_last", v)} fieldKey="tpoc_last" error={errors.tpoc_last} />
          <TextField label="First name" required value={a.tpoc_first} onChange={(v) => patch("tpoc_first", v)} fieldKey="tpoc_first" error={errors.tpoc_first} />
        </div>
        <TextField label="Title" required value={a.tpoc_title} onChange={(v) => patch("tpoc_title", v)} fieldKey="tpoc_title" error={errors.tpoc_title} />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Email" required type="email" value={a.tpoc_email} onChange={(v) => patch("tpoc_email", v)} fieldKey="tpoc_email" error={errors.tpoc_email} />
          <TextField label="Phone" required value={a.tpoc_phone} onChange={(v) => patch("tpoc_phone", v)} fieldKey="tpoc_phone" error={errors.tpoc_phone} />
        </div>
      </FieldGroup>
    </>
  );
}

function StepP3({
  beatId,
  a,
  patch,
  patchHasSps,
  errors,
}: {
  beatId: string;
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  patchHasSps: (v: FormAnswers["has_sps"]) => void;
  errors: Record<string, string>;
}) {
  const sps = a.sps.length ? a.sps : a.has_sps === "Yes" ? [emptyProvider()] : [];
  const update = (i: number, next: ServiceProvider) => {
    const copy = [...(a.sps.length ? a.sps : sps)];
    copy[i] = next;
    patch("sps", copy);
  };
  return (
    <div className="space-y-10">
      <ChoicePills
        label="Any service providers in this environment?"
        required
        tip={TIPS.esp}
        hint="MSP, SOC, MDR, CSP, or similar. No / N/A if none."
        options={YES_NO_NA}
        value={a.has_sps}
        onChange={(v) => {
          patchHasSps(v);
          if (v === "Yes") {
            requestAnimationFrame(() => {
              document.getElementById("field-sps")?.scrollIntoView({ block: "center" });
            });
          }
        }}
        fieldKey="has_sps" error={errors.has_sps}
      />
      {a.has_sps === "Yes" ? (
        <div id="field-sps" className="space-y-10">
          {errors.sps ? <p className="text-base text-[#FCA5A5]">{errors.sps}</p> : null}
          {sps.map((sp, i) => (
            <div key={i} className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white" style={{ fontSize: 18, fontWeight: 600 }}>
                  Provider {i + 1}
                </p>
                {sps.length > 1 ? (
                  <button
                    type="button"
                    className="text-base text-white hover:text-white inline-flex items-center gap-1"
                    onClick={() => patch("sps", sps.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                ) : null}
              </div>
              <TextField
                label="Name"
                required
                value={sp.name}
                onChange={(v) => update(i, { ...sp, name: v })}
                fieldKey={`sps:${i}:name`}
                error={errors[`sps:${i}:name`]}
              />
              <TextField
                label="POC email"
                required
                type="email"
                hint="One contact email. No CUI."
                value={sp.email}
                onChange={(v) => update(i, { ...sp, email: v })}
                fieldKey={`sps:${i}:email`}
                error={errors[`sps:${i}:email`]}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <TextField
                  label="POC last name"
                  required
                  value={sp.poc_last}
                  onChange={(v) => update(i, { ...sp, poc_last: v })}
                  fieldKey={`sps:${i}:poc_last`}
                  error={errors[`sps:${i}:poc_last`]}
                />
                <TextField
                  label="POC first name"
                  required
                  value={sp.poc_first}
                  onChange={(v) => update(i, { ...sp, poc_first: v })}
                  fieldKey={`sps:${i}:poc_first`}
                  error={errors[`sps:${i}:poc_first`]}
                />
              </div>
              <TextField
                label="POC phone"
                required
                value={sp.poc_phone}
                onChange={(v) => update(i, { ...sp, poc_phone: v })}
                fieldKey={`sps:${i}:poc_phone`}
                error={errors[`sps:${i}:poc_phone`]}
              />
              <ChoicePills
                label="What does this provider do here?"
                required
                hint="Pick the job they actually do in this environment."
                tip={TIPS.providerJob}
                options={PROVIDER_JOBS}
                value={sp.job}
                onChange={(v) => update(i, { ...sp, job: v, fedramp: v === "CSP" ? sp.fedramp : "", offering_name: v === "CSP" ? sp.offering_name : "" })}
                fieldKey={`sps:${i}:job`}
                error={errors[`sps:${i}:job`]}
              />
              <TextField
                label="Short service description"
                hint="Optional. If empty, we send the job label."
                value={sp.service_desc}
                onChange={(v) => update(i, { ...sp, service_desc: v })}
                fieldKey={`sps:${i}:service_desc`}
                error={errors[`sps:${i}:service_desc`]}
              />
              <ChoicePills
                label="Does this provider store, process, or transmit CUI, or only security-protection data (logs/config)?"
                required
                hint="CUI vs SPD. Don’t know is allowed."
                tip={TIPS.cuiVsSpd}
                options={CUI_VS_SPD}
                value={sp.cui_or_spd}
                onChange={(v) => update(i, { ...sp, cui_or_spd: v })}
                fieldKey={`sps:${i}:cui_or_spd`}
                error={errors[`sps:${i}:cui_or_spd`]}
              />
              {sp.job === "CSP" ? (
                <>
                  <ChoicePills
                    label="CSP authorization"
                    required
                    hint="SOC 2 is not equivalent. “Microsoft” is not an offering name."
                    tip={TIPS.fedramp}
                    options={PROVIDER_FEDRAMP}
                    value={sp.fedramp}
                    onChange={(v) => update(i, { ...sp, fedramp: v, offering_name: v === "FedRAMP Authorized" ? sp.offering_name : "" })}
                    fieldKey={`sps:${i}:fedramp`}
                    error={errors[`sps:${i}:fedramp`]}
                  />
                  {sp.fedramp === "FedRAMP Authorized" ? (
                    <TextField
                      label="Marketplace service offering name"
                      required
                      hint="The Service Offering column, not the company. No CUI."
                      tip={TIPS.offering}
                      value={sp.offering_name}
                      onChange={(v) => update(i, { ...sp, offering_name: v })}
                      fieldKey={`sps:${i}:offering_name`}
                      error={errors[`sps:${i}:offering_name`]}
                    />
                  ) : null}
                </>
              ) : null}
              <ChoicePills
                label="Does this provider need its own CMMC status?"
                required
                hint="Non-CSP ESPs that handle CUI are assessed in your scope or they bring a certificate."
                tip={TIPS.ownCmmc}
                options={YES_NO_NA}
                value={sp.own_cmmc}
                onChange={(v) => update(i, { ...sp, own_cmmc: v })}
                fieldKey={`sps:${i}:own_cmmc`}
                error={errors[`sps:${i}:own_cmmc`]}
              />
              <ChoicePills
                label="CMMC Status"
                required
                hint="Not assessed / Seeking L2 / L2 Self / L2 C3PAO / Unknown / N/A. eMASS Level mapping happens later in export."
                options={SP_CMMC_STATUS}
                value={sp.spcmmcstatus}
                onChange={(v) => update(i, { ...sp, spcmmcstatus: v })}
                fieldKey={`sps:${i}:spcmmcstatus`}
                error={errors[`sps:${i}:spcmmcstatus`]}
              />
              <ChoicePills
                label="Provider sector (CISA)"
                hint="Optional. Same CISA set as the company sector."
                options={CISA_SECTORS}
                value={sp.spsector}
                onChange={(v) => update(i, { ...sp, spsector: v })}
                fieldKey={`sps:${i}:spsector`}
                error={errors[`sps:${i}:spsector`]}
              />
              <ChoicePills
                label="Admin, backup, or log access to CUI systems?"
                required
                options={YES_NO_NA}
                value={sp.admin_access}
                onChange={(v) => update(i, { ...sp, admin_access: v })}
                fieldKey={`sps:${i}:admin_access`}
                error={errors[`sps:${i}:admin_access`]}
              />
              <ChoicePills
                label="Written CRM that names inherited vs OSC-owned practices?"
                required
                hint="Customer Responsibility Matrix, not an SLA cover page."
                tip={TIPS.crm}
                options={YES_NO_NA}
                value={sp.crm_inherited}
                onChange={(v) => update(i, { ...sp, crm_inherited: v })}
                fieldKey={`sps:${i}:crm_inherited`}
                error={errors[`sps:${i}:crm_inherited`]}
              />
              <ChoicePills
                label="Vendor shared-responsibility / product matrix on file for this provider?"
                required
                hint="PreVeil, CATO, Blueshift, M365 CRM/SRM. Do not upload."
                tip={TIPS.vendorSrm}
                options={YES_NO_NA_ONLY}
                value={sp.vendor_srm}
                onChange={(v) => update(i, { ...sp, vendor_srm: v })}
                fieldKey={`sps:${i}:vendor_srm`}
                error={errors[`sps:${i}:vendor_srm`]}
              />
            </div>
          ))}
          {sps.length < 5 ? (
            <button
              type="button"
              className="text-base text-white hover:text-white inline-flex items-center gap-1"
              onClick={() => patch("sps", [...sps, emptyProvider()])}
            >
              <Plus className="h-4 w-4" />
              Add provider
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StepE1({
  beatId,
  a,
  patch,
  errors,
}: {
  beatId: string;
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <FieldGroup label="Interview roles">
      <ChoicePills
        label="Can you name the roles we should interview?"
        required
        hint="Yes or no is enough. Titles are optional. Not people names."
        options={YES_NO_DK}
        value={a.interview_roles_namable}
        onChange={(v) => patch("interview_roles_namable", v)}
        fieldKey="interview_roles_namable" error={errors.interview_roles_namable}
      />
      <RevealSlot open={a.interview_roles_namable === "Yes"} className="min-h-[6.75rem]">
        <TextField
          fieldKey="interview_role_names"
          label="Interview titles (optional)"
          hint="Assessment Official, sysadmin, CUI users, ESP POC. Titles only. Not people names."
          tip={TIPS.interviewTitles}
          value={a.interview_role_names}
          onChange={(v) => patch("interview_role_names", v)}
          error={errors.interview_role_names}
        />
      </RevealSlot>
    </FieldGroup>
  );
}

function StepE2({
  beatId,
  a,
  patch,
  patchCuiLocations,
  errors,
}: {
  beatId: string;
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  patchCuiLocations: (locations: string[]) => void;
  errors: Record<string, string>;
}) {
  const locs = a.cui_locations || [];
  const hosts = locs.filter((h) => h !== "N/A / not sure");
  if (beatId === "lives") {
    return (
      <FieldGroup label="Lives and moves">
        <MultiSelectField
          label="Where CUI lives today"
          required
          hint="Select all that apply. Other opens a short write-in. N/A / not sure if you cannot say."
          options={CUI_LOCATIONS}
          exclusive={["N/A / not sure"]}
          value={locs}
          onChange={(v) => {
            const hadHosts = (a.cui_locations || []).some((h) => h !== "N/A / not sure");
            patchCuiLocations(v);
            const hasHosts = v.some((h) => h !== "N/A / not sure");
            if (hasHosts && !hadHosts) {
              requestAnimationFrame(() => {
                document.getElementById("field-cui_host_fedramp")?.scrollIntoView({ block: "center" });
              });
            }
          }}
          fieldKey="cui_locations" error={errors.cui_locations}
        />
        <RevealSlot open={locs.includes("Other")} className="min-h-[6.75rem]">
          <TextField
            label="Other location"
            required
            hint="Short write-in. No CUI content."
            value={a.cui_locations_note}
            onChange={(v) => patch("cui_locations_note", v)}
            fieldKey="cui_locations_note" error={errors.cui_locations_note}
          />
        </RevealSlot>
        {hosts.length ? (
          <div id="field-cui_host_fedramp" className="space-y-10">
            {hosts.map((host) => {
              const tag = (a.cui_host_fedramp || []).find((x) => x.host === host);
              return (
                <div key={host} className="space-y-6">
                  <ChoicePills
                    label={hostFedrampLabel(host)}
                    required
                    tip={TIPS.fedramp}
                    hint="GCC High is equivalent only if you tag it that way; still name the offering."
                    options={HOST_FEDRAMP}
                    value={tag?.fedramp || ""}
                    onChange={(v) => {
                      const existing = a.cui_host_fedramp || [];
                      const row = {
                        host,
                        fedramp: v,
                        offering_name: v === "FedRAMP Authorized" ? tag?.offering_name || "" : "",
                      };
                      const next = existing.some((x) => x.host === host)
                        ? existing.map((x) => (x.host === host ? row : x))
                        : [...existing, row];
                      patch("cui_host_fedramp", next);
                    }}
                    fieldKey={`cui_host_fedramp:${host}`}
                    error={tag?.fedramp ? undefined : errors[`cui_host_fedramp:${host}`] || errors.cui_host_fedramp}
                  />
                  {tag?.fedramp === "FedRAMP Authorized" ? (
                    <TextField
                      label="Marketplace service offering name"
                      required
                      hint="The Service Offering column, not the company. No CUI. CAP checks Marketplace Provider + Service Offering."
                      tip={TIPS.offering}
                      value={tag.offering_name || ""}
                      onChange={(v) => {
                        const existing = a.cui_host_fedramp || [];
                        const row = { host, fedramp: "FedRAMP Authorized" as const, offering_name: v };
                        const next = existing.some((x) => x.host === host)
                          ? existing.map((x) => (x.host === host ? { ...x, offering_name: v } : x))
                          : [...existing, row];
                        patch("cui_host_fedramp", next);
                      }}
                      fieldKey={`cui_host_fedramp:${host}:offering`}
                      error={errors[`cui_host_fedramp:${host}:offering`]}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </FieldGroup>
    );
  }
  if (beatId === "copies") {
    return (
      <FieldGroup label="How copies leave">
        <ChoicePills
          label="Does CUI leave as paper, printer, or USB, including at home?"
          required
          hint="A fact about the environment. Yes does not fail this intake."
          options={YES_NO_DK}
          value={a.cui_leaves_portable}
          onChange={(v) => patch("cui_leaves_portable", v)}
          fieldKey="cui_leaves_portable" error={errors.cui_leaves_portable}
        />
        <ChoicePills
          label="If people use VDI or a remote desktop, can they download or print?"
          required
          tip={TIPS.vdi}
          hint="A fact about the environment. Yes does not fail this intake."
          options={YES_NO_NA}
          value={a.vdi_download_print}
          onChange={(v) => patch("vdi_download_print", v)}
          fieldKey="vdi_download_print" error={errors.vdi_download_print}
        />
        <ChoicePills
          label="Is CUI handled at sites other than HQ (other sites or home)?"
          required
          options={YES_NO_DK}
          value={a.cui_off_hq}
          onChange={(v) => patch("cui_off_hq", v)}
          fieldKey="cui_off_hq" error={errors.cui_off_hq}
        />
        <RevealSlot open={a.cui_off_hq === "Yes"} className="min-h-[6.75rem]">
          <TextField
            fieldKey="other_sites"
            label="Sites besides HQ"
            required
            hint="City or site name only. No street addresses of CUI lockups, no CUI."
            value={a.other_sites}
            onChange={(v) => patch("other_sites", v)}
            error={errors.other_sites}
          />
        </RevealSlot>
        <ChoicePills
          label="Do backups of CUI sit in a commercial (non-gov) location?"
          required
          options={YES_NO_NA}
          value={a.cui_backup_commercial}
          onChange={(v) => patch("cui_backup_commercial", v)}
          fieldKey="cui_backup_commercial" error={errors.cui_backup_commercial}
        />
        <ChoicePills
          label="Where do CUI backups live?"
          required
          hint="Product class only: GCC High, commercial cloud, on-prem, vendor. No hostnames."
          options={BACKUP_CLASSES}
          value={a.cui_backup_where}
          onChange={(v) => patch("cui_backup_where", v)}
          fieldKey="cui_backup_where" error={errors.cui_backup_where}
        />
      </FieldGroup>
    );
  }
  if (beatId === "observer") {
    return (
      <FieldGroup label="What an observer can see">
        <ChoicePills
          label="Is there physical CUI we would need to observe (paper, media, server room, badges)?"
          required
          hint="This decides hybrid vs virtual. You do not pick virtual."
          tip={TIPS.physical}
          options={YES_NO_DK}
          value={a.physical_cui_observe}
          onChange={(v) => patch("physical_cui_observe", v)}
          fieldKey="physical_cui_observe" error={errors.physical_cui_observe}
        />
        <ChoicePills
          label="Would a site walkthrough put CUI on screen or in the room?"
          required
          options={YES_NO_DK}
          value={a.virtual_tour_exposes_cui}
          onChange={(v) => patch("virtual_tour_exposes_cui", v)}
          fieldKey="virtual_tour_exposes_cui" error={errors.virtual_tour_exposes_cui}
        />
        <ChoicePills
          label="Can we screenshare live system configs without CUI appearing on the call?"
          required
          hint="Yes means assessors can see live configs. CUI stays off the call."
          options={YES_NO_NA}
          value={a.dlp_blocks_screenshare}
          onChange={(v) => patch("dlp_blocks_screenshare", v)}
          fieldKey="dlp_blocks_screenshare" error={errors.dlp_blocks_screenshare}
        />
      </FieldGroup>
    );
  }
  if (beatId === "enclave") {
    return (
      <FieldGroup label="Enclave shape">
        <ChoicePills
          label="What is the CUI environment?"
          required
          tip={TIPS.scope}
          options={ENV_MODES}
          value={a.env_mode}
          onChange={(v) => patch("env_mode", v)}
          fieldKey="env_mode" error={errors.env_mode}
        />
        <RevealSlot open={a.env_mode === "Other named enclave"} className="min-h-[6.75rem]">
          <TextField label="Named enclave" required hint="Short name only." value={a.enclave_what} onChange={(v) => patch("enclave_what", v)} fieldKey="enclave_what" error={errors.enclave_what} />
        </RevealSlot>
        <ChoicePills
          label="CUI boundary defined?"
          required
          tip={TIPS.boundary}
          options={YES_NO_DK}
          value={a.boundary_defined}
          onChange={(v) => patch("boundary_defined", v)}
          fieldKey="boundary_defined" error={errors.boundary_defined}
        />
        <ChoicePills label="Separation" required tip={TIPS.separation} options={SEPARATION} value={a.separation} onChange={(v) => patch("separation", v)} fieldKey="separation" error={errors.separation} />
      </FieldGroup>
    );
  }
  return (
    <FieldGroup label="Diagram evidence">
      <ChoicePills label="Network diagram exists?" required options={YES_NO_DK} value={a.network_diagram} onChange={(v) => patch("network_diagram", v)} fieldKey="network_diagram" error={errors.network_diagram} />
      <ChoicePills
        label="Have the network diagram and the applicability matrix been walked against each other?"
        required
        hint="Both exist and they match. Not a second 'does a diagram exist' question."
        options={YES_NO_DK}
        value={a.diagram_vs_matrix}
        onChange={(v) => patch("diagram_vs_matrix", v)}
        fieldKey="diagram_vs_matrix" error={errors.diagram_vs_matrix}
      />
    </FieldGroup>
  );
}

function StepE3({
  beatId,
  a,
  patch,
  errors,
}: {
  beatId: string;
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <ChoicePills
        label="Do you have systems that could touch CUI but you keep off CUI by policy or technical control (CRMA)?"
        required
        tip={TIPS.crmaHas}
        hint="Contractor Risk Managed Assets. Not a list of hostnames."
        options={YES_NO_DK}
        value={a.has_crma}
        onChange={(v) => patch("has_crma", v)}
        fieldKey="has_crma" error={errors.has_crma}
      />
      <RevealSlot open={a.has_crma === "Yes"} className="min-h-[6.75rem]">
        <ChoicePills
          label="Can any of them still store, process, or transmit CUI even by accident (email, OneDrive, print, USB, screen share)?"
          required
          tip={TIPS.crmaAccident}
          hint="If yes, that asset is a CUI Asset, not CRMA. This is a fact, not an intake fail."
          options={YES_NO_DK}
          value={a.crma_handles_cui}
          onChange={(v) => patch("crma_handles_cui", v)}
          fieldKey="crma_handles_cui" error={errors.crma_handles_cui}
        />
      </RevealSlot>
      <ChoicePills
        label="Can an out-of-scope asset still reach a CUI system (same login, print queue, file share, backup, thumb drive)?"
        required
        tip={TIPS.oos}
        hint="If yes, it is not out of scope. This is a fact, not an intake fail."
        options={YES_NO_NA}
        value={a.oos_can_reach_cui}
        onChange={(v) => patch("oos_can_reach_cui", v)}
        fieldKey="oos_can_reach_cui" error={errors.oos_can_reach_cui}
      />
    </>
  );
}

function StepE4({
  beatId,
  a,
  patch,
  errors,
}: {
  beatId: string;
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  errors: Record<string, string>;
}) {
  if (beatId === "readiness") {
    return (
      <div className="space-y-10">
        <FieldGroup label="System Security Plan">
          <ChoicePills
            label="SSP exists?"
            required
            tip={TIPS.ssp}
            options={YES_NO_PARTIAL}
            value={a.ssp_exists}
            onChange={(v) => patch("ssp_exists", v)}
            fieldKey="ssp_exists" error={errors.ssp_exists}
          />
          <RevealSlot open={a.ssp_exists === "Yes" || a.ssp_exists === "Partial / in progress"} className="space-y-10">
            <ChoicePills
              label="Do supporting SSP artifacts exist (policies, procedures)?"
              required
              options={YES_NO_DK}
              value={a.ssp_artifacts_exist}
              onChange={(v) => patch("ssp_artifacts_exist", v)}
              fieldKey="ssp_artifacts_exist" error={errors.ssp_artifacts_exist}
            />
            <RevealSlot open={a.ssp_artifacts_exist === "Yes"} className="min-h-[6.75rem]">
              <TextField
                fieldKey="ssp_artifact_types"
                label="Name the types that exist today"
                required
                hint="SSP, policies, procedures, diagrams, inventory. Types only. Do not upload. No CUI, no filenames of CUI files."
                tip={TIPS.sspTypes}
                value={a.ssp_artifact_types}
                onChange={(v) => patch("ssp_artifact_types", v)}
                error={errors.ssp_artifact_types}
              />
            </RevealSlot>
          </RevealSlot>
        </FieldGroup>
        <FieldGroup label="POA&M">
          <ChoicePills
            label="Any POA&M / temporary deficiencies?"
            required
            tip={TIPS.poam}
            options={YES_NO_NA}
            value={a.poam_open}
            onChange={(v) => patch("poam_open", v)}
            fieldKey="poam_open" error={errors.poam_open}
          />
          <RevealSlot open={a.poam_open === "Yes"} className="space-y-10">
            <ChoicePills
              label="Are any POA&Ms conditional (time-boxed / allowed)?"
              required
              options={YES_NO_NA}
              value={a.poam_conditional}
              onChange={(v) => patch("poam_conditional", v)}
              fieldKey="poam_conditional" error={errors.poam_conditional}
            />
          </RevealSlot>
        </FieldGroup>
        <FieldGroup label="During the assessment">
          <ChoicePills
            label="Expect to fix remaining gaps during the assessment itself?"
            required
            hint="Say so if you still plan to close remaining gaps during the assessment week."
            options={YES_NO_DK}
            value={a.fix_during_assessment}
            onChange={(v) => patch("fix_during_assessment", v)}
            fieldKey="fix_during_assessment" error={errors.fix_during_assessment}
          />
          <ChoicePills
            label="Is a freeze planned during the assessment window?"
            required
            hint="A freeze is expected. It is not a not-ready signal."
            options={YES_NO_DK}
            value={a.freeze_during_assessment}
            onChange={(v) => patch("freeze_during_assessment", v)}
            fieldKey="freeze_during_assessment" error={errors.freeze_during_assessment}
          />
          <ChoicePills
            label="Is a migration planned during the assessment window?"
            required
            hint="Migration in-window is a not-ready fact. Freeze is separate."
            options={YES_NO_DK}
            value={a.migrate_during_assessment}
            onChange={(v) => patch("migrate_during_assessment", v)}
            fieldKey="migrate_during_assessment" error={errors.migrate_during_assessment}
          />
        </FieldGroup>
      </div>
    );
  }
  const named = (a.sps || []).filter((s) => s.name.trim()).length;
  return (
    <div className="space-y-10">
      {a.has_sps === "Yes" ? (
        <p className="text-white leading-relaxed" style={{ fontSize: 16 }}>
          You listed {named} {named === 1 ? "provider" : "providers"} on Providers. Admin, backup, or log access and CRM inherited vs owned were asked there — not again here.
        </p>
      ) : a.has_sps === "No" || a.has_sps === "N/A" ? (
        <p className="text-white leading-relaxed" style={{ fontSize: 16 }}>
          No service providers were listed. Monitoring here is only MFA.
        </p>
      ) : null}
      <TextField label="MFA solution" required value={a.mfa_solution} onChange={(v) => patch("mfa_solution", v)} fieldKey="mfa_solution" error={errors.mfa_solution} />
      <ChoicePills
        label="Where MFA is enforced"
        required
        hint="All, some, or none on remote and privileged access."
        options={MFA_COVERAGE}
        value={a.mfa_coverage}
        onChange={(v) => patch("mfa_coverage", v)}
        fieldKey="mfa_coverage" error={errors.mfa_coverage}
      />
      <TextField
        label="Continuous monitoring tool (optional)"
        hint="Name only. Review cadence can wait for the call."
        value={a.contmon_tool}
        onChange={(v) => patch("contmon_tool", v)}
      />
    </div>
  );
}

function ConsentRow({
  id,
  fieldKey,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  fieldKey: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label
      id={`field-${fieldKey}`}
      htmlFor={id}
      tabIndex={-1}
      className="flex gap-4 items-start rounded-lg border border-white px-4 py-4 min-h-11 cursor-pointer text-white leading-relaxed text-base"
    >
      <input
        id={id}
        name={fieldKey}
        type="checkbox"
        checked={checked}
        aria-invalid={!!error}
        onClick={(e) => {
          if (!e.nativeEvent.isTrusted) e.preventDefault();
        }}
        onChange={(e) => {
          if (!e.nativeEvent.isTrusted) return;
          onChange(e.target.checked === true);
        }}
        className="mt-0.5 h-6 w-6 shrink-0 rounded-sm border border-white bg-white accent-[#FBBF24] focus:ring-2 focus:ring-[#FBBF24]"
      />
      <span>
        {children}
        {error ? <span className="block text-[#FCA5A5] mt-2" style={{ fontSize: 14 }}>{error}</span> : null}
      </span>
    </label>
  );
}

function StepG({
  beatId,
  a,
  patch,
  errors,
  onJumpRecap,
}: {
  beatId: string;
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  errors: Record<string, string>;
  onJumpRecap?: (stepId: string, beatId: string) => void;
}) {
  if (beatId === "recap") {
    const rows = reviewRecapRows(a);
    return (
      <div className="space-y-6">
        {rows.length ? (
          rows.map((row) => {
            const dest = RECAP_JUMPS[row.label];
            return (
              <RecapRow
                key={row.label}
                label={row.label}
                value={row.value}
                onJump={dest && onJumpRecap ? () => onJumpRecap(dest.stepId, dest.beatId) : undefined}
              />
            );
          })
        ) : (
          <p className="text-white leading-relaxed">Nothing to recap yet. Next takes you to the last confirmations.</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <p className="font-semibold text-white" style={{ fontSize: 18, fontWeight: 600 }}>Required consents</p>
      <ConsentRow
        id="consent-nocui"
        fieldKey="consent_nocui"
        checked={a.consent_nocui}
        onChange={(v) => patch("consent_nocui", v)}
        error={errors.consent_nocui}
      >
        I confirm that nothing submitted here is Controlled Unclassified Information, a CMMC UID, or a SPRS score.
      </ConsentRow>
      <ConsentRow
        id="consent-notassessment"
        fieldKey="consent_notassessment"
        checked={a.consent_notassessment}
        onChange={(v) => patch("consent_notassessment", v)}
        error={errors.consent_notassessment}
      >
        I understand this is not a CMMC assessment, designation, or SPRS posting. It gathers environment information
        so the C3PAO can identify what is being assessed.
      </ConsentRow>
    </div>
  );
}
