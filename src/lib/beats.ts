import type { StepId } from "./path";
import type { FormAnswers } from "./types";

export type Beat = {
  id: string;
  fields: string[];
};

/** Intra-step beats. The rail still has the 8 categories — these are not nav items. */
export function beatsForStep(step: StepId, _a: FormAnswers): Beat[] {
  switch (step) {
    case "P1":
      return [
        {
          id: "company",
          fields: [
            "hqname",
            "uei",
            "oscname",
            "address1",
            "address2",
            "city",
            "state",
            "zip",
            "country",
            "businessphone",
            "website",
            "sector",
            "sectorother",
            "cui_users",
            "hlocage",
            "cageinscope",
            "scopemode",
            "scopedesc",
          ],
        },
      ];
    case "P2":
      return [
        {
          id: "officials",
          fields: [
            "ao_last",
            "ao_first",
            "ao_title",
            "ao_email",
            "ao_phone",
            "tpoc_last",
            "tpoc_first",
            "tpoc_title",
            "tpoc_email",
            "tpoc_phone",
          ],
        },
      ];
    case "P3":
      return [{ id: "providers", fields: ["has_sps", "sps"] }];
    case "E1":
      return [
        {
          id: "people",
          fields: ["interview_roles_namable"],
        },
      ];
    case "E2":
      return [
        {
          id: "lives",
          fields: ["cui_locations", "cui_locations_note", "cui_host_fedramp"],
        },
        {
          id: "copies",
          fields: ["cui_leaves_portable", "vdi_download_print", "cui_off_hq", "other_sites", "cui_backup_commercial", "cui_backup_where"],
        },
        {
          id: "observer",
          fields: ["physical_cui_observe", "virtual_tour_exposes_cui", "dlp_blocks_screenshare"],
        },
        {
          id: "enclave",
          fields: ["env_mode", "enclave_what", "boundary_defined", "separation"],
        },
        {
          id: "evidence",
          fields: ["network_diagram", "diagram_vs_matrix"],
        },
      ];
    case "E3":
      return [
        { id: "crma", fields: ["has_crma", "crma_handles_cui", "oos_can_reach_cui"] },
      ];
    case "E4":
      return [
        {
          id: "monitoring",
          fields: ["mfa_solution", "mfa_coverage"],
        },
        {
          id: "readiness",
          fields: [
            "ssp_exists",
            "ssp_artifacts_exist",
            "ssp_artifact_types",
            "poam_open",
            "poam_conditional",
            "fix_during_assessment",
            "freeze_during_assessment",
            "migrate_during_assessment",
          ],
        },
      ];
    case "G":
      return [
        { id: "recap", fields: [] },
        { id: "consents", fields: ["consent_nocui", "consent_notassessment"] },
      ];
  }
}

export function clampBeatIndex(step: StepId, a: FormAnswers, beatIdx: number): number {
  const n = beatsForStep(step, a).length;
  if (n <= 0) return 0;
  if (!Number.isFinite(beatIdx)) return 0;
  return Math.max(0, Math.min(n - 1, Math.floor(beatIdx)));
}

export function progressPercent(
  welcome: boolean,
  stepIdx: number,
  beatIdx: number,
  beatCount: number,
  stepCount: number,
): number {
  if (welcome || stepCount <= 0) return 0;
  const frac = beatCount > 1 ? beatIdx / (beatCount - 1) : 1;
  return Math.min(100, Math.max(0, ((stepIdx + 0.8 + 0.2 * frac) / stepCount) * 100));
}

/**
 * Footer time left. Rail stays 8 chips — intra-step beats must still move
 * the remaining copy so "N of 8" does not look frozen on sub-screens.
 */
export function remainingCopy(
  idx: number,
  total: number,
  beatIdx = 0,
  beatCount = 1,
): string {
  const frac = beatCount > 1 ? Math.min(1, Math.max(0, beatIdx / beatCount)) : 0;
  const remaining = Math.max(0, total - idx - frac);
  const minutes = Math.max(1, Math.round(remaining * 2));
  const time = idx === 0 && beatIdx === 0 ? "About 16 minutes left" : `About ${minutes} minutes left`;
  if (beatCount > 1) return `${beatIdx + 1} of ${beatCount} · ${time}`;
  return time;
}

/** Recap row → owning step/beat. Used by Review jumps. */
export const RECAP_JUMPS: Record<string, { stepId: StepId; beatId: string }> = {
  Organization: { stepId: "P1", beatId: "company" },
  Scope: { stepId: "P1", beatId: "company" },
  Official: { stepId: "P2", beatId: "officials" },
  Providers: { stepId: "P3", beatId: "providers" },
  "CUI locations": { stepId: "E2", beatId: "lives" },
  Backups: { stepId: "E2", beatId: "copies" },
  MFA: { stepId: "E4", beatId: "monitoring" },
  SSP: { stepId: "E4", beatId: "readiness" },
  "POA&M": { stepId: "E4", beatId: "readiness" },
  "Fix during assessment": { stepId: "E4", beatId: "readiness" },
  Freeze: { stepId: "E4", beatId: "readiness" },
  Migration: { stepId: "E4", beatId: "readiness" },
};

/** First Review rail visit → recap. After a Submit gap-jump → consents. */
export function reviewRailBeatIdx(gapActive: boolean, a: FormAnswers): number {
  const beats = beatsForStep("G", a);
  const recap = beats.findIndex((b) => b.id === "recap");
  const consents = beats.findIndex((b) => b.id === "consents");
  if (gapActive) return consents >= 0 ? consents : Math.max(0, beats.length - 1);
  return recap >= 0 ? recap : 0;
}
