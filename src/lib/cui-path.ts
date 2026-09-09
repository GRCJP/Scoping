/** Trust-boundary copy for the CUI Path step (E2). Not an enclave or evidence system. */
export const CUI_PATH_WARNING =
  "Do not enter CUI, assessment evidence, network addresses, system configurations, vulnerability information, credentials, or other sensitive security information. Provide only high-level descriptions sufficient to support assessment scoping. Detailed documentation and assessment evidence must be provided through the authorized assessment repository.";

/** Shorter global / other-step banner body. CUI Path uses CUI_PATH_WARNING instead. */
export const SCOPE_WARNING_SHORT =
  "High-level only. No server names, machine names, file paths, or IPs.";

export const CUI_PATH_NOTE_MAX = 100;

export const CUI_PATH_NOTE_TOO_LONG =
  "Keep this to 100 characters. High-level description only.";

/** Remaining free-text notes on CUI Path. Location answers stay structured. */
export const CUI_PATH_NOTE_KEYS = [
  "cui_locations_note",
  "cui_off_hq_note",
  "other_sites",
  "enclave_what",
] as const;

/** Adjacent enclave write-in on Company (not CUI Path, same dump risk). */
export const SCOPING_NOTE_KEYS = ["scopedesc"] as const;
