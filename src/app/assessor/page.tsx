import Link from "next/link";
import { AssessorShell } from "@/components/layout/AssessorShell";
import { Badge } from "@/components/ui/badge";
import { easternStamp } from "@/lib/format";
import { listSubmissions } from "@/lib/store";
import { contactName, orgName } from "@/lib/types";

export const dynamic = "force-dynamic";


export default function AssessorListPage() {
  const rows = listSubmissions();

  return (
    <AssessorShell title="OSC Discovery intakes">
      <div className="p-6 md:p-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-3xl font-semibold">Intakes</h2>
            <p className="text-sm text-ink-400 mt-1">
              Each record summarises what the OSC reported. Readiness is your judgment on the call — nothing here is scored.
            </p>
          </div>
          <Link
            href="/intake"
            className="h-10 inline-flex items-center rounded-md bg-navy px-4 text-sm text-white hover:bg-navy-800"
          >
            New public intake
          </Link>
        </div>

        <div className="rounded-xl border border-paper-300 bg-white overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-paper-50 text-left text-[11px] uppercase tracking-[0.14em] text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-ink-400">
                    No intakes yet.{" "}
                    <Link href="/intake" className="underline text-teal">
                      Run the public form
                    </Link>.
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="border-t border-paper-200 hover:bg-paper-50/80">
                    <td className="px-4 py-3">
                      <Link href={`/assessor/${s.id}`} className="font-medium text-ink hover:underline">
                        {orgName(s.answers)}
                      </Link>
                      <div className="text-xs text-ink-400">{contactName(s.answers)}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{s.scope.infodetermination}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{s.orchstatus}</td>
                    <td className="px-4 py-3 text-xs text-ink-400 whitespace-nowrap">
                      {easternStamp(s.submittedon)} ET
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AssessorShell>
  );
}
