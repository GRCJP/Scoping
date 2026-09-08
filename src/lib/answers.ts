import type { FormAnswers } from "./types";

/** Immutable single-key patch. Callers must thread the returned object. */
export function patchAnswers<K extends keyof FormAnswers>(
  current: FormAnswers,
  key: K,
  value: FormAnswers[K],
): FormAnswers {
  return { ...current, [key]: value };
}

/** One write for several keys so a later field cannot drop an earlier one. */
export function patchAnswersMany(
  current: FormAnswers,
  updates: Partial<FormAnswers>,
): FormAnswers {
  return { ...current, ...updates };
}

/**
 * Keep FedRAMP/offering rows aligned with selected CUI hosts.
 * N/A / not sure is not a host. Existing tags for still-selected hosts are kept.
 */
export function syncCuiHostFedramp(
  locations: string[],
  existing: FormAnswers["cui_host_fedramp"],
): FormAnswers["cui_host_fedramp"] {
  const keep = locations.filter((h) => h !== "N/A / not sure");
  return keep.map((host) => existing.find((x) => x.host === host) ?? { host, fedramp: "", offering_name: "" });
}

/**
 * CUI-path beat: persist locations and sync host tags from the same previous state.
 * Unchecking a host drops its tag; checking one adds an empty tag so FedRAMP can reveal.
 */
export function applyCuiLocationChange(
  current: FormAnswers,
  locations: string[],
): FormAnswers {
  return patchAnswersMany(current, {
    cui_locations: locations,
    cui_host_fedramp: syncCuiHostFedramp(locations, current.cui_host_fedramp || []),
  });
}

/**
 * Providers Yes/No/N/A. Never wipe `sps` — a No→Yes round-trip must keep
 * rows the user already typed. The list is hidden while not Yes.
 */
export function applyHasSpsChange(
  current: FormAnswers,
  value: FormAnswers["has_sps"],
): FormAnswers {
  return patchAnswers(current, "has_sps", value);
}

/**
 * Company step: copy HQ name into OSC name while OSC is still synced.
 * Synced means OSC is empty/whitespace or still equals the previous HQ value.
 * An independent OSC edit is user-owned and is left alone. No extra schema.
 */
export function applyHqNameChange(current: FormAnswers, hqname: string): FormAnswers {
  const prevHq = current.hqname;
  const prevOsc = current.oscname;
  const oscSynced = !prevOsc.trim() || prevOsc === prevHq;
  return patchAnswersMany(current, oscSynced ? { hqname, oscname: hqname } : { hqname });
}
