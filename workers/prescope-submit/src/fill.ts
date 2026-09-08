/**
 * Fill adapter. Mapping lives in src/lib/emass-xlsx.ts — do not add a second map.
 *
 * FILL_MODE=node       — import fillEmassXlsxPack (wrangler / nodejs_compat).
 * FILL_MODE=skip       — tests / dry-run; fill no-ops, then drop + answers markdown.
 * FILL_MODE=container  — POST answers to PRESCOPE_FILL binding or FILL_CONTAINER_URL.
 *
 * Live Box: download official Assessment Results bytes from Templates.
 * Never upload the mapping stub (it drops official assessor tabs).
 */
import { fillConcurrency, fillMode, trim, type WorkerEnv } from "./env.ts";
import { loadBlankTemplates, type BoxClient } from "./box.ts";
import {
  acceptOfficialAssessmentResultsBytes,
  acceptOfficialAssessmentResultsOutput,
} from "../../../src/lib/assessment-results-sheets.ts";
import { fillBindingStub } from "./prescope-fill.ts";
import type { FormAnswers } from "../../../src/lib/types.ts";
import type { EmassXlsxPack } from "../../../src/lib/emass-xlsx.ts";

/** Same handling string as EMASS_XLSX_BOX_NOTE — do not import emass-xlsx on the container path. */
const CUI_BOX_NOTE = "CUI (When Filled In). Box 00 Internal only. Never email the filled xlsx.";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FILL_TIMEOUT_MS = 120_000;

export type FillFetch = typeof fetch;

export type FillDeps = {
  fetchImpl?: FillFetch;
};

/**
 * workerd throws `Illegal invocation` when `fetch` (or a Fetcher/DO `.fetch`)
 * is extracted and called later without the right `this`. Never
 * `const f = fetch; f(url)` — call through a wrapper or `fetch.bind(globalThis)`.
 * Same pattern as `fillBindingStub` (`prescope-fill.ts`): `(input, init) => stub.fetch(...)`.
 */
export function asFillFetch(fetchImpl?: FillFetch): FillFetch {
  if (fetchImpl) {
    return (input, init) => fetchImpl(input, init);
  }
  return fetch.bind(globalThis);
}

function asBytes(mod: unknown): Uint8Array {
  const value = (mod as { default?: unknown }).default ?? mod;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return new Uint8Array(value);
  throw new Error("Unexpected xlsx module shape");
}

async function bundledTemplates(): Promise<{
  preAssessment: Uint8Array;
  requiredData: Uint8Array;
  assessmentResults?: Uint8Array;
} | null> {
  try {
    const [pre, req] = await Promise.all([
      import("../../../docs/emass/CMMC-L2-Pre-Assessment-Form-v3.9.xlsx"),
      import("../../../docs/emass/Required-Data-OSC.xlsx"),
    ]);
    let assessmentResults: Uint8Array | undefined;
    try {
      const results = await import("../../../docs/emass/CMMC_Level2_AssessmentResults_Template.xlsx");
      // In-repo file at this name has been the Cover stub — never treat as official.
      const accepted = acceptOfficialAssessmentResultsBytes(asBytes(results));
      assessmentResults = accepted.bytes;
    } catch {
      /* official CAC blank is not committed — mock/dev may stub; live Box must download it */
    }
    return { preAssessment: asBytes(pre), requiredData: asBytes(req), assessmentResults };
  } catch {
    return null;
  }
}

export type FillResult =
  | { ok: true; pack: EmassXlsxPack; source: "node" | "container" }
  | { ok: true; pack: null; source: "skip" }
  | { ok: false; error: string };

const PRE_REL = "docs/emass/CMMC-L2-Pre-Assessment-Form-v3.9.xlsx";
const REQ_REL = "docs/emass/Required-Data-OSC.xlsx";
const RESULTS_REL = "docs/emass/CMMC_Level2_AssessmentResults_Template.xlsx";

async function templatesFromFs(root: string): Promise<{
  preAssessment: Uint8Array;
  requiredData: Uint8Array;
  assessmentResults?: Uint8Array;
}> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const [preAssessment, requiredData] = await Promise.all([
    readFile(join(root, PRE_REL)),
    readFile(join(root, REQ_REL)),
  ]);
  let assessmentResults: Uint8Array | undefined;
  try {
    const raw = await readFile(join(root, RESULTS_REL));
    assessmentResults = acceptOfficialAssessmentResultsBytes(raw).bytes;
  } catch {
    /* Box / eMASS blank not in-repo, or the Cover stub at this filename */
  }
  return { preAssessment, requiredData, assessmentResults };
}

/** wrangler dev cwd is often the worker package; walk up to the repo root. */
async function findLocalTemplateRoot(): Promise<string | null> {
  try {
    const { access } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const cwd = process.cwd();
    const roots = [cwd, join(cwd, ".."), join(cwd, "../.."), join(cwd, "../../..")];
    for (const root of roots) {
      try {
        await access(join(root, PRE_REL));
        await access(join(root, REQ_REL));
        return root;
      } catch {
        /* try the next candidate */
      }
    }
  } catch {
    /* no fs in this isolate */
  }
  return null;
}

async function fillNode(answers: FormAnswers, env: WorkerEnv, box: BoxClient): Promise<EmassXlsxPack> {
  const { fillEmassXlsxPack } = await import("../../../src/lib/emass-xlsx.ts");
  const live = box.mode === "live";
  const concurrency = fillConcurrency(env);
  const fromBox = live ? await loadBlankTemplates(box, env) : {};
  const bundled = await bundledTemplates();
  const root = trim(env.EMASS_TEMPLATE_ROOT) || (await findLocalTemplateRoot()) || "";
  const fromFs =
    !fromBox.preAssessment || !fromBox.requiredData || !fromBox.assessmentResults
      ? bundled ?? (root ? await templatesFromFs(root) : null)
      : null;
  const templates = {
    preAssessment: fromBox.preAssessment ?? fromFs?.preAssessment,
    requiredData: fromBox.requiredData ?? fromFs?.requiredData,
    // Live Box: only official Templates bytes. Do not fall back to a missing in-repo stub.
    assessmentResults: fromBox.assessmentResults ?? (live ? undefined : fromFs?.assessmentResults),
  };
  const allowStub = !live;
  const boxArSkipped = live ? fromBox.assessmentResultsSkipped : undefined;
  if (!templates.preAssessment || !templates.requiredData) {
    if (root && !live) {
      return fillEmassXlsxPack(answers, root, undefined, { allowAssessmentResultsStub: true, concurrency });
    }
    throw new Error(
      "No blank eMASS templates. Set BOX_*_TEMPLATE_FILE_ID / BOX_TEMPLATE_FOLDER_ID, or rely on bundled docs/emass files.",
    );
  }
  if (live && !templates.assessmentResults) {
    const pack = await fillEmassXlsxPack(answers, undefined, templates, {
      allowAssessmentResultsStub: false,
      assessmentResultsFromBytesOnly: true,
      concurrency,
    });
    return {
      ...pack,
      assessmentResults: undefined,
      assessmentResultsSkipped:
        boxArSkipped ||
        pack.assessmentResultsSkipped ||
        "Assessment Results blank missing from Box. Set BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID (your Templates folder). Skipped upload — will not ship a stub that drops official tabs.",
    };
  }
  return fillEmassXlsxPack(answers, undefined, templates, {
    allowAssessmentResultsStub: allowStub,
    assessmentResultsFromBytesOnly: live,
    concurrency,
  });
}

export function resolveFillContainerUrl(env: WorkerEnv): string {
  return trim(env.FILL_CONTAINER_URL).replace(/\/$/, "");
}

function bytesToB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function liveTemplatesForContainer(
  env: WorkerEnv,
  box: BoxClient,
): Promise<{ preAssessment?: { base64: string }; requiredData?: { base64: string }; assessmentResults?: { base64: string } } | undefined> {
  if (box.mode !== "live") return undefined;
  const fromBox = await loadBlankTemplates(box, env);
  const templates: {
    preAssessment?: { base64: string };
    requiredData?: { base64: string };
    assessmentResults?: { base64: string };
  } = {};
  if (fromBox.preAssessment) templates.preAssessment = { base64: bytesToB64(fromBox.preAssessment) };
  if (fromBox.requiredData) templates.requiredData = { base64: bytesToB64(fromBox.requiredData) };
  // Name-match Cover stub is omitted by loadBlankTemplates — never POST it.
  if (fromBox.assessmentResults) templates.assessmentResults = { base64: bytesToB64(fromBox.assessmentResults) };
  return templates.preAssessment || templates.requiredData || templates.assessmentResults ? templates : undefined;
}

function fillFetcher(env: WorkerEnv, fetchImpl: FillFetch): { url: string; fetchImpl: FillFetch } {
  const binding = fillBindingStub(env);
  if (binding) {
    return {
      url: "https://prescope-fill.internal/fill",
      // Do not return `binding.fetch` unbound — workerd needs the receiver.
      fetchImpl: (input, init) => binding.fetch(input, init),
    };
  }
  const origin = resolveFillContainerUrl(env);
  if (!origin) {
    throw new Error("FILL_MODE=container requires FILL_CONTAINER_URL or a PRESCOPE_FILL Containers binding.");
  }
  return { url: `${origin}/fill`, fetchImpl: (input, init) => fetchImpl(input, init) };
}

function toFilledWorkbook(part: { filename?: string; contentType?: string; base64: string }, fallback: string) {
  return {
    filename: part.filename || fallback,
    buffer: Buffer.from(part.base64, "base64"),
    contentType: part.contentType || XLSX_TYPE,
    cuiWhenFilled: true as const,
    handling: CUI_BOX_NOTE,
  };
}

async function fillContainer(
  answers: FormAnswers,
  env: WorkerEnv,
  box: BoxClient,
  fetchImpl: FillFetch,
): Promise<EmassXlsxPack> {
  const secret = trim(env.PRESCOPE_SUBMIT_SECRET);
  if (!secret) throw new Error("FILL_MODE=container requires PRESCOPE_SUBMIT_SECRET.");
  const target = fillFetcher(env, fetchImpl);
  const templates = await liveTemplatesForContainer(env, box);
  const res = await target.fetchImpl(target.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      answers,
      ...(templates ? { templates } : {}),
      allowAssessmentResultsStub: false,
      assessmentResultsFromBytesOnly: true,
    }),
    signal: AbortSignal.timeout(FILL_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Fill container ${res.status}`);
  let json: {
    preAssessment?: { filename?: string; contentType?: string; base64?: string };
    requiredData?: { filename?: string; contentType?: string; base64?: string };
    assessmentResults?: { filename?: string; contentType?: string; base64?: string };
    assessmentResultsSkipped?: string;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("Fill container returned invalid JSON.");
  }
  if (!json.preAssessment?.base64 || !json.requiredData?.base64) {
    throw new Error("Fill container returned no workbooks.");
  }
  const pack: EmassXlsxPack = {
    preAssessment: toFilledWorkbook(json.preAssessment as { base64: string; filename?: string; contentType?: string }, "CUI-Pre-Assessment.xlsx"),
    requiredData: toFilledWorkbook(json.requiredData as { base64: string; filename?: string; contentType?: string }, "CUI-Required-Data-OSC.xlsx"),
  };
  if (json.assessmentResults?.base64) {
    const raw = Buffer.from(json.assessmentResults.base64, "base64");
    // Stale sidecar images (Assessment-Scoping-redeploy) still emit Cover +
    // thin tabs even when we POST official Box bytes. Refuse that output.
    const accepted = acceptOfficialAssessmentResultsOutput(raw);
    if (accepted.bytes) {
      pack.assessmentResults = toFilledWorkbook(
        json.assessmentResults as { base64: string; filename?: string; contentType?: string },
        "CUI-Assessment-Results.xlsx",
      );
    } else {
      pack.assessmentResultsSkipped =
        accepted.skipped ||
        json.assessmentResultsSkipped ||
        "Fill sidecar returned a Cover stub Assessment Results workbook. Skipped upload.";
    }
  } else {
    pack.assessmentResultsSkipped =
      json.assessmentResultsSkipped ||
      "Fill container returned no Assessment Results workbook (official blank required in live).";
  }
  return pack;
}

export async function fillEmassForSubmit(
  answers: FormAnswers,
  env: WorkerEnv,
  box: BoxClient,
  deps: FillDeps = {},
): Promise<FillResult> {
  const mode = fillMode(env);
  if (mode === "skip") return { ok: true, pack: null, source: "skip" };
  const fetchImpl = asFillFetch(deps.fetchImpl);
  try {
    if (mode === "container") {
      return { ok: true, pack: await fillContainer(answers, env, box, fetchImpl), source: "container" };
    }
    return { ok: true, pack: await fillNode(answers, env, box), source: "node" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fill failed.";
    return { ok: false, error: message };
  }
}
