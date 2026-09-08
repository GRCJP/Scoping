"use client";

import { useMemo, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildEmassPack,
  buildEmassPrefill,
  type EmassPrefill,
  type PrefillCell,
} from "@/lib/emass";
import type { FormAnswers } from "@/lib/types";

function displayValue(c: PrefillCell): string {
  if (c.value) return c.value;
  if (c.origin === "c3pao") return "";
  return "";
}

function FieldRows({ cells, emptyHint }: { cells: PrefillCell[]; emptyHint?: string }) {
  return (
    <dl className="divide-y divide-paper-200 border-t border-paper-200">
      {cells.map((c) => {
        const v = displayValue(c);
        return (
          <div key={c.field} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] gap-2 py-1.5 text-xs">
            <dt className="text-ink-400 leading-snug">{c.field}</dt>
            <dd className="text-ink-700 leading-snug break-words">
              {v ? (
                v
              ) : (
                <span className="text-ink-400 italic">{emptyHint ?? (c.origin === "c3pao" ? "leave blank" : "—")}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Card({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-paper-300 bg-white p-5 shadow-card flex flex-col min-h-0">
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{kicker}</p>
      <h3 className="font-display text-lg mt-1 font-semibold">{title}</h3>
      <div className="mt-3 overflow-auto max-h-[32rem] pr-1">{children}</div>
    </article>
  );
}

function kv(field: string, value: string): PrefillCell {
  return { field, value, origin: "intake" };
}

function join(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.filter(Boolean).join("; ");
  return (v ?? "").trim();
}

function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function scopingCells(a: FormAnswers): PrefillCell[] {
  return [
    kv("Users who access CUI", a.cui_users || a.employees_total || a.employees),
    kv("Device classes", join(a.device_classes)),
    kv("Workstations", a.devices_workstations),
    kv("Laptops", a.devices_laptops),
    kv("Servers", a.devices_servers),
    kv("Where CUI lives", join(a.cui_locations)),
    kv("How CUI enters and leaves", a.cui_flow),
    kv("CUI environment", a.env_mode),
    kv("Named enclave", a.enclave_what),
    kv("FedRAMP / equivalent", a.enclave_fedramp),
    kv("CUI boundary defined", a.boundary_defined),
    kv("Network diagram", a.network_diagram),
    kv("Separation", a.separation),
    kv("CUI Assets", a.count_cui_assets),
    kv("SPA", a.count_spa),
    kv("CRMA", a.count_crma),
    kv("CRMA enforcement", a.crma_enforce),
    kv("Specialized assets", join(a.specialized_kinds)),
    kv("Out-of-scope", a.count_oos),
    kv("Monitoring", `${a.contmon_tool}${a.contmon_who ? ` · ${a.contmon_who}` : ""}${a.contmon_howoften ? ` · ${a.contmon_howoften}` : ""}`),
    kv("MFA", `${a.mfa_solution}${a.mfa_coverage ? ` · ${a.mfa_coverage}` : ""}`),
    kv("Named providers", String((a.sps || []).filter((s) => s.name.trim()).length || "None")),
    kv("CRMA present", a.has_crma),
    kv("CRMA accidental CUI", a.crma_handles_cui),
    kv("SSP exists", a.ssp_exists),
    kv("Inventory", a.inventory_exists),
    kv("POA&M", a.poam_open),
    kv("Evidence share", "Box (required)"),
  ];
}

function dataTemplateCells(a: FormAnswers): PrefillCell[] {
  const address = [a.address1, a.address2].filter((x) => (x || "").trim()).join(", ");
  return [
    kv("HQ Organization Name", a.hqname),
    kv("UEI", a.uei),
    kv("OSC Name", a.oscname),
    kv("Address", address),
    kv("City / state / ZIP", [a.city, a.state, a.zip].filter(Boolean).join(", ")),
    kv("Country", a.country),
    kv("Sector", a.sector === "Other" ? `Other — ${a.sectorother}` : a.sector),
    kv("Users who access CUI", a.cui_users || a.employees),
    kv("HLO CAGE", a.hlocage),
    kv("CAGE code(s) in scope", a.cageinscope),
    kv("Scope (Enterprise vs Enclave)", a.scopemode),
    kv("Assessment Official", [a.ao_first, a.ao_last].filter(Boolean).join(" ")),
    kv("Technical POC", [a.tpoc_first, a.tpoc_last].filter(Boolean).join(" ")),
  ];
}

export function EmassPrefillPanel({
  answers,
  data: dataProp,
  submissionId,
}: {
  answers?: FormAnswers;
  data?: EmassPrefill;
  submissionId?: string;
}) {
  const data = useMemo(
    () => dataProp ?? (answers ? buildEmassPrefill(answers) : null),
    [answers, dataProp]
  );
  const files = useMemo(
    () => (answers ? buildEmassPack(answers, data ?? undefined) : data ? buildEmassPack({} as FormAnswers, data) : []),
    [answers, data]
  );

  if (!data) return null;

  return (
    <section className="space-y-4">
      {data.cuiWhenFilled ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg bg-navy px-4 py-2.5 text-white"
          role="status"
        >
          <span className="font-display font-semibold tracking-[0.32em] text-gold">CUI</span>
          <p className="text-xs text-white/80 leading-relaxed">
            CUI when filled. 00 Internal only — customer Box never gets these four files. Do not collect a CMMC
            UID from the OSC.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Prefill for eMASS</p>
          <h2 className="font-display text-2xl mt-1 font-semibold">Four artifacts — scores stay blank</h2>
          <p className="text-sm text-ink-400 mt-1 max-w-3xl leading-relaxed">
            eMASS requires each template uploaded separately — never one merged blob. 00 Internal only; customer
            Box never gets these. No assessment scores, no MET/NOT MET, no hash, no CPN, no CMMC UID. Certificate
            of CMMC Status is not generated from intake (identity preview only). After Submit, the filled Pre-Assessment
            xlsx (not the blank) is what F2 will put on Box 00 Internal. CUI when filled — never email it.
          </p>
        </div>
        {submissionId ? (
          <div className="w-full rounded-xl border border-paper-300 bg-white px-5 py-3 shadow-card flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">Filled Pre-Assessment xlsx</p>
              <p className="text-[11px] text-ink-400 mt-1">
                CUI (When Filled In) · 00 Internal only · never email
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" asChild>
              <a href={`/api/assessor/emass?id=${encodeURIComponent(submissionId)}`}>Pre-Assessment xlsx</a>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={`/api/assessor/emass?id=${encodeURIComponent(submissionId)}&file=required-data`}>
                Required Data xlsx
              </a>
            </Button>
          </div>
        ) : null}

        <ul className="w-full rounded-xl border border-paper-300 bg-white divide-y divide-paper-200 shadow-card">
          {files.map((f) => (
            <li key={f.filename} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{f.label}</p>
                <p className="text-xs font-mono text-ink-400 mt-0.5 truncate">{f.filename}</p>
                <p className="text-[11px] text-ink-400 mt-1">00 Internal · not on customer Box</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => downloadMarkdown(f.filename, f.markdown)}
              >
                <Download className="h-3.5 w-3.5" />
                {f.label}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card kicker="A · Scoping Call Discovery Script" title="Scoping Guide">
          <p className="text-xs text-ink-400 mb-2">Filled from intake. Own eMASS file.</p>
          {answers ? <FieldRows cells={scopingCells(answers)} /> : <p className="text-xs text-ink-400">Open from an intake to fill.</p>}
        </Card>

        <Card kicker="B · eMASS v3.9" title="Pre-Assessment">
          <p className="text-xs text-ink-400 mb-2">{data.preAssessment.template}</p>
          <FieldRows cells={data.preAssessment.fields} />
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mt-4 mb-1">ESP rows</p>
          {data.preAssessment.espRows.length === 0 ? (
            <p className="text-xs text-ink-400">None listed on intake.</p>
          ) : (
            <ul className="space-y-3">
              {data.preAssessment.espRows.map((r, i) => (
                <li key={`${r.name}-${i}`} className="rounded-md border border-paper-200 p-2 text-xs space-y-1">
                  <p className="font-medium text-ink">{r.name}</p>
                  <p className="text-ink-500">
                    {r.job || "—"} · {r.cui_or_spd || "—"} · {r.email || "—"}
                  </p>
                  <p className="text-ink-500">
                    FedRAMP {r.fedramp || "—"}
                    {r.offering_name ? ` (${r.offering_name})` : ""} · own CMMC {r.own_cmmc || "—"}
                  </p>
                  <p className="text-ink-500">
                    Admin/logs {r.admin_access || "—"} · CRM {r.crm_inherited || "—"} · SRM {r.vendor_srm || "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mt-4 mb-1">Leave blank (C3PAO fills)</p>
          <FieldRows cells={data.preAssessment.leaveBlank} emptyHint="leave blank" />
        </Card>

        <Card kicker="C · OSC Information" title="Data Template">
          <p className="text-xs text-ink-400 mb-2">Identity spine. Own file — not folded into Pre-Assessment.</p>
          {answers ? <FieldRows cells={dataTemplateCells(answers)} /> : <FieldRows cells={data.preAssessment.fields} />}
        </Card>

        <Card kicker="D · Assessment Results Form" title="Results stub">
          <FieldRows cells={data.results.fields} />
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mt-4 mb-1">OSC SSP(s)</p>
          <FieldRows cells={data.results.ssp} />
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mt-4 mb-1">Standards Acceptance</p>
          <FieldRows cells={[data.results.standardsAcceptance]} emptyHint="blank (Commercial / none)" />
          {data.results.standardsAcceptance.note ? (
            <p className="text-[11px] text-ink-400 mt-1 leading-relaxed">{data.results.standardsAcceptance.note}</p>
          ) : null}
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mt-4 mb-1">Interview names seed</p>
          <FieldRows cells={data.results.interviewSeeds} />
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mt-4 mb-1">
            Objectives — ESP Name (inherited likely)
          </p>
          {data.results.inherited.length === 0 ? (
            <p className="text-xs text-ink-400">No PreVeil, GCC High CSP, or named MSP hinted.</p>
          ) : (
            <ul className="space-y-2">
              {data.results.inherited.map((h) => (
                <li key={h.espName} className="rounded-md border border-paper-200 p-2 text-xs">
                  <p className="font-medium text-ink">ESP Name: {h.espName}</p>
                  <p className="text-ink-500 mt-0.5">{h.objectives.join(", ")}</p>
                  <p className="text-ink-400 mt-1 leading-relaxed">{h.why}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mt-4 mb-1">Do not set</p>
          <ul className="text-xs text-ink-400 list-disc pl-4 space-y-0.5">
            {data.results.leaveBlank.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Card>

        <Card kicker="Certificate of CMMC Status" title="Certificate identity">
          <p className="text-xs text-ink-400 mb-2">Preview only — not a fifth download. Identity, CUID blank.</p>
          <FieldRows cells={data.certificate.fields} />
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 mt-4 mb-1">Leave blank</p>
          <FieldRows cells={data.certificate.leaveBlank} emptyHint="leave blank" />
        </Card>
      </div>
    </section>
  );
}
