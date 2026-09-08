import type { FormAnswers, IntakePath } from "./types";

/** Linear environment-discovery form. No FCI fork, no COTS stop, no CUID. */
export function computePath(_a?: FormAnswers): IntakePath {
  return "standard";
}

export function pathLabel(_path: IntakePath): string {
  return "L2 environment discovery";
}

export type StepId = "P1" | "P2" | "P3" | "E1" | "E2" | "E3" | "E4" | "G";

export function stepsForPath(_path?: IntakePath | null): {
  id: StepId;
  title: string;
  blurb: string;
  nav: string;
}[] {
  return [
    {
      id: "P1",
      nav: "Company",
      title: "Company information",
      blurb:
        "Legal entity, address, UEI, CAGE, sector, and city/state. We do not ask for a CMMC UID.",
    },
    {
      id: "P2",
      nav: "Officials",
      title: "Assessment Official and Technical POC",
      blurb:
        "The Assessment Official has signature authority. The Technical POC knows the environment. We send a copy of these answers to the Official.",
    },
    {
      id: "P3",
      nav: "Providers",
      title: "Service providers",
      blurb:
        "Who touches the CUI path, and whether they are FedRAMP-covered or need their own CMMC status. High-level names only. No CUI.",
    },
    {
      id: "E1",
      nav: "Interview roles",
      title: "Interview roles",
      blurb:
        "Whether interview roles can be named. No people names, hostnames, or serial numbers.",
    },
    {
      id: "E2",
      nav: "CUI path",
      title: "How CUI moves",
      blurb:
        "Where CUI is stored and how it enters and leaves, including paper, printers, USB, and home use. Do not paste CUI into this form.",
    },
    {
      id: "E3",
      nav: "Assets",
      title: "Asset categories",
      blurb:
        "CRMA accident and out-of-scope reach — facts, not intake fails.",
    },
    {
      id: "E4",
      nav: "Monitoring",
      title: "Monitoring and access",
      blurb:
        "MFA coverage, then SSP, POA&M, and what you plan during the assessment window.",
    },
    {
      id: "G",
      nav: "Review",
      title: "Review and submit",
      blurb:
        "A recap of answers already given, two required confirmations, and Submit.",
    },
  ];
}
