import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmassPrefillPanel } from "@/components/assessor/EmassPrefill";
import { AssessorShell } from "@/components/layout/AssessorShell";
import { Badge } from "@/components/ui/badge";
import { easternStamp } from "@/lib/format";
import { isSubmissionId } from "@/lib/ids";
import { Markdown } from "@/lib/markdown";
import { getSubmission } from "@/lib/store";
import { contactEmail, contactName, orgName } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AssessorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSubmissionId(id)) notFound();
  const s = getSubmission(id);
  if (!s) notFound();
  const sc = s.scope;

  return (
    <AssessorShell title={orgName(s.answers)}>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/assessor" className="text-xs text-ink-400 hover:text-ink">
              ← All intakes
            </Link>
            <h2 className="font-display text-3xl mt-2 font-semibold">{orgName(s.answers)}</h2>
            <p className="text-sm text-ink-400 mt-1">
              {s.answers.scopemode || "—"} · CAGE {s.answers.cageinscope || "—"} · {contactName(s.answers)} ·{" "}
              {contactEmail(s.answers)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{s.orchstatus}</Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Panel kicker="Environment" title={sc.infodetermination}>
            <p className="text-sm text-ink-500 mt-2">
              Readiness is your call on the scoping call. This record reports what the OSC stated.
            </p>
          </Panel>
          <Panel kicker="Box 00 Internal" title="Assessor only">
            <Link href={s.box.internalUrl} className="text-sm text-teal underline mt-2 inline-block">
              Open simulated 00 Internal
            </Link>
            <p className="text-xs text-ink-400 mt-2">{s.box.parentName}</p>
          </Panel>
        </div>

        <EmassPrefillPanel answers={s.answers} submissionId={s.id} />

        <section className="rounded-xl border border-paper-300 bg-white p-6 shadow-card">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Assessment type — three lines</p>
          <ol className="mt-4 space-y-4">
            <Line n="1" label="What is being assessed" text={sc.assess_line1} />
            <Line n="2" label="Boundary / FedRAMP / MFA" text={sc.assess_line2} />
            <Line n="3" label="Call focus" text={sc.assess_line3} />
          </ol>
        </section>


        <section className="rounded-xl border border-paper-300 bg-white p-6 shadow-card">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Orchestration log</p>
          <p className="text-xs text-ink-400 mt-1 mb-4">
            Seven beats. Empty DROP in dedicated Scoping parent (not assessment / CUI library). Template then emails.
          </p>
          <ol className="space-y-3">
            {s.beats.map((b) => (
              <li key={b.beat} className="grid grid-cols-[2rem_1fr] gap-3">
                <div className="h-8 w-8 rounded-full bg-navy text-white text-xs flex items-center justify-center font-mono">
                  {b.beat}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {b.name}{" "}
                    <span className="text-ink-400 font-normal text-xs">{easternStamp(b.at)} ET</span>
                  </p>
                  <p className="text-sm text-ink-500 leading-relaxed">{b.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="rounded-xl border border-paper-300 bg-white p-6 shadow-card">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Email 1 · customer</p>
            <p className="text-sm mt-2 font-medium">{s.customerEmail.subject}</p>
            <p className="text-xs text-ink-400">To {s.customerEmail.to}</p>
            <pre className="mt-3 text-xs text-ink-500 whitespace-pre-wrap font-sans">{s.customerEmail.body}</pre>
          </section>
          <section className="rounded-xl border border-paper-300 bg-white p-6 shadow-card">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Email 2 · assessors</p>
            <p className="text-sm mt-2 font-medium">{s.assessorEmail.subject}</p>
            <p className="text-xs text-ink-400">To {s.assessorEmail.to}</p>
            <pre className="mt-3 text-xs text-ink-500 whitespace-pre-wrap font-sans">{s.assessorEmail.body}</pre>
          </section>
        </div>

        <section className="rounded-xl border border-paper-300 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">00 Internal · scope brief</p>
            <Link href={s.box.internalUrl} className="text-xs underline text-teal">
              Folder view
            </Link>
          </div>
          <div className="mt-4">
            <Markdown source={s.internalMarkdown} />
          </div>
        </section>
      </div>
    </AssessorShell>
  );
}

function Panel({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-paper-300 bg-white p-5 shadow-card">
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{kicker}</p>
      <p className="font-display text-xl mt-1">{title}</p>
      {children}
    </div>
  );
}

function Line({ n, label, text }: { n: string; label: string; text: string }) {
  return (
    <li className="flex gap-4">
      <span className="font-mono text-xs text-teal mt-1">{n}</span>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-ink-400">{label}</p>
        <p className="text-sm text-ink-700 leading-relaxed mt-1">{text}</p>
      </div>
    </li>
  );
}
