import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Lock } from "lucide-react";
import { AssessorShell } from "@/components/layout/AssessorShell";
import { Markdown } from "@/lib/markdown";
import { isSubmissionId } from "@/lib/ids";
import { CALL_README, UPLOADS_README } from "@/lib/orchestrate";
import { getSubmission } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InternalDropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSubmissionId(id)) notFound();
  const s = getSubmission(id);
  if (!s) notFound();

  return (
    <AssessorShell title="Box · 00 Internal">
      <div className="p-6 md:p-8">
        <p className="text-xs text-ink-400">{s.box.parentNote}</p>
        <h2 className="font-display text-2xl mt-2 font-semibold">{s.box.dropFolderName}</h2>
        <p className="text-sm text-ink-400 mt-1">
          Folder id {s.box.dropFolderId} · parent <strong>{s.box.parentName}</strong>
        </p>

        <ul className="mt-6 rounded-xl border border-paper-300 bg-white divide-y divide-paper-200">
          {s.box.files.map((f) => (
            <li key={f.name} className="px-4 py-3 flex items-center gap-3 text-sm">
              {f.customerVisible ? (
                <FileText className="h-4 w-4 text-teal" />
              ) : (
                <Lock className="h-4 w-4 text-clay-600" />
              )}
              <span className="font-medium">
                {f.folder} / {f.name}
              </span>
              <span className="text-xs text-ink-400 ml-auto">
                {f.customerVisible ? "on customer link" : "assessor only"}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-xl border border-paper-300 bg-white p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">00 Internal</p>
          <Markdown source={s.internalMarkdown} />
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-paper-300 bg-white p-4">
            <p className="font-medium">02 Uploads / README</p>
            <p className="text-ink-500 mt-2">{UPLOADS_README}</p>
          </div>
          <div className="rounded-xl border border-paper-300 bg-white p-4">
            <p className="font-medium">03 Scoping call / README</p>
            <p className="text-ink-500 mt-2">{CALL_README}</p>
          </div>
        </div>

        <Link href={`/assessor/${s.id}`} className="inline-block mt-6 text-sm underline text-teal">
          Back to intake record
        </Link>
      </div>
    </AssessorShell>
  );
}
