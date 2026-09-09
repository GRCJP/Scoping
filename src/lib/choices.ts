export const YES_NO_DK = ["Yes", "No", "Don't know"] as const;
export const YES_NO_NA = ["Yes", "No", "N/A", "Don't know"] as const;
export const YES_NO_UNSURE = ["Yes", "No", "Unsure"] as const;
export const YES_NO_PARTIAL = ["Yes", "Partial / in progress", "No"] as const;

export const CISA_SECTORS = [
  "Defense Industrial Base",
  "Critical Manufacturing",
  "Information Technology",
  "Cloud Service Provider",
  "Chemical",
  "Commercial Facilities",
  "Communications",
  "Dams",
  "Emergency Services",
  "Energy",
  "Financial Services",
  "Food and Agriculture",
  "Government Facilities",
  "Healthcare and Public Health",
  "Nuclear Reactors, Materials, and Waste",
  "Transportation Systems",
  "Water and Wastewater Systems",
  "Other",
] as const;

export const SCOPE_MODES = ["Enterprise", "Enclave"] as const;

export const ENV_MODES = [
  "GCC High tenant",
  "PreVeil",
  "Other named enclave",
  "Broader environment",
  "N/A",
] as const;

export const SEPARATION = ["Logical", "Physical", "Both", "Neither / unclear", "N/A"] as const;

export const CRMA_ENFORCE = ["Technically enforced", "Policy-only", "Mixed", "Don't know", "N/A"] as const;

export const CUI_LOCATIONS = [
  "M365 GCC High",
  "M365 GCC",
  "M365 Commercial",
  "PreVeil",
  "Azure Government",
  "AWS GovCloud",
  "On-prem file shares / servers",
  "Email (non-PreVeil)",
  "VDI / virtual enclave",
  "Third-party CSP",
  "Other",
  "N/A / not sure",
] as const;

export const CUI_GOV_PATH = ["M365 GCC High", "PreVeil", "Azure Government", "AWS GovCloud"] as const;

export const ESP_ROLES = ["MSP", "SOC", "MDR", "CSP", "Other"] as const;

export const ESP_KINDS = ["None", "MSP", "SOC / MDR", "CSP", "Other"] as const;

/** Job this named provider actually does in the environment. */
export const PROVIDER_JOBS = ["MSP", "SOC or MDR", "CSP", "Other"] as const;

/** CUI vs security-protection data for a named provider. */
export const CUI_VS_SPD = [
  "Stores, processes, or transmits CUI",
  "Security-protection data only",
  "Don't know",
] as const;

/** FedRAMP / equivalency for a CSP provider. Offering name is a follow-up field. */
export const PROVIDER_FEDRAMP = [
  "FedRAMP Authorized",
  "DoD-recognized equivalent with body of evidence",
  "SPD only",
  "Not authorized",
  "Don't know",
] as const;

export const YES_NO_NA_ONLY = ["Yes", "No", "N/A"] as const;

export const BACKUP_CLASSES = [
  "GCC High",
  "Commercial cloud",
  "On-prem",
  "Vendor",
  "Don't know",
  "N/A",
] as const;

export const DEVICE_CLASSES = [
  "Workstations",
  "Laptops",
  "Servers",
  "Mobile",
  "Home / BYOD",
  "None",
  "N/A",
] as const;

export const SPECIALIZED_KINDS = ["None", "GFE", "OT", "IoT", "Test equipment", "Other", "N/A"] as const;

export const COUNT_BANDS = ["None", "A few (1–10)", "Some (11–50)", "Many (51+)", "Don't know", "N/A"] as const;

export const FEDRAMP = [
  "FedRAMP High (or equiv, e.g. GCC High)",
  "FedRAMP Moderate (or equiv)",
  "No / not authorized",
  "Don't know",
  "N/A (no CSP holding CUI)",
] as const;

export const HOST_FEDRAMP = [
  "FedRAMP Authorized",
  "DoD equivalent + BoE",
  "SPD only",
  "Not authorized",
  "Don't know",
  "N/A",
] as const;

export const MFA_COVERAGE = [
  "All remote and privileged",
  "Some accounts only",
  "Not enforced",
  "Don't know",
] as const;

export const EVIDENCE_SHARE = ["Box", "GCC High", "Encrypted portal", "PreVeil", "Other", "N/A"] as const;

export const SP_CMMC_STATUS = [
  "Not assessed",
  "Seeking L2",
  "L2 Self",
  "L2 C3PAO",
  "Unknown",
  "N/A",
] as const;

export const CONFIDENCE = ["High", "Medium", "Low"] as const;
export const EFFORT = ["S", "M", "L", "XL"] as const;



export type YesNoDk = (typeof YES_NO_DK)[number];
export type YesNoNa = (typeof YES_NO_NA)[number];
export type YesNoUnsure = (typeof YES_NO_UNSURE)[number];
export type YesNoPartial = (typeof YES_NO_PARTIAL)[number];
export type CisaSector = (typeof CISA_SECTORS)[number];
export type ScopeMode = (typeof SCOPE_MODES)[number];
export type EnvMode = (typeof ENV_MODES)[number];
export type Separation = (typeof SEPARATION)[number];
export type CrmaEnforce = (typeof CRMA_ENFORCE)[number];
export type CuiLocation = (typeof CUI_LOCATIONS)[number];
export type EspRole = (typeof ESP_ROLES)[number];
export type EspKind = (typeof ESP_KINDS)[number];
export type ProviderJob = (typeof PROVIDER_JOBS)[number];
export type CuiVsSpd = (typeof CUI_VS_SPD)[number];
export type ProviderFedramp = (typeof PROVIDER_FEDRAMP)[number];
export type YesNoNaOnly = (typeof YES_NO_NA_ONLY)[number];
export type BackupClass = (typeof BACKUP_CLASSES)[number];
export type DeviceClass = (typeof DEVICE_CLASSES)[number];
export type SpecializedKind = (typeof SPECIALIZED_KINDS)[number];
export type CountBand = (typeof COUNT_BANDS)[number];
export type Fedramp = (typeof FEDRAMP)[number];
export type HostFedramp = (typeof HOST_FEDRAMP)[number];
export type MfaCoverage = (typeof MFA_COVERAGE)[number];
export type EvidenceShare = (typeof EVIDENCE_SHARE)[number];
export type SpCmmcStatus = (typeof SP_CMMC_STATUS)[number];
export type Confidence = (typeof CONFIDENCE)[number];
export type Effort = (typeof EFFORT)[number];
