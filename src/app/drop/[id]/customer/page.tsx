import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Folder } from "lucide-react";
import { SiteFooter } from "@/components/layout/Footer";
import { BrandMark } from "@/components/layout/BrandMark";
import { isSubmissionId } from "@/lib/ids";

export const dynamic = "force-dynamic";

const GENERIC_FILES = [
  { folder: "01 Answers", name: "OSC Discovery Answers.md", kind: "md" as const },
  { folder: "02 Uploads", name: "README-uploads.txt", kind: "txt" as const },
];

/**
 * Public evidence-folder simulation. No store lookup — official / TPOC
 * email and org names are not rendered from an unauthenticated URL.
 */
export default async function CustomerDropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSubmissionId(id)) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="bg-navy text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BrandMark href={`/success/${id}`} compact />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white">Evidence folder</p>
            <p className="text-sm font-medium">evidence / 02 Uploads</p>
          </div>
        </div>
        <p className="text-xs text-white">Editor</p>
      </header>
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs text-ink-400">Scoping / OSC Discovery Drops</p>
          <h1 className="font-display text-2xl mt-1 font-semibold">02 Uploads</h1>
          <p className="text-sm text-ink-400 mt-2 leading-relaxed">
            Upload evidence here. This Box folder is FedRAMP authorized or equivalent.
          </p>

          <ul className="mt-6 rounded-lg border border-paper-300 bg-white divide-y divide-paper-200">
            {GENERIC_FILES.map((f) => (
              <li key={`${f.folder}-${f.name}`} className="px-4 py-3 flex items-center gap-3 text-sm">
                {f.kind === "txt" ? (
                  <Folder className="h-4 w-4 text-teal" />
                ) : (
                  <FileText className="h-4 w-4 text-teal" />
                )}
                <span>
                  {f.folder} / {f.name}
                </span>
              </li>
            ))}
          </ul>

          <Link href={`/success/${id}`} className="inline-block mt-6 text-sm underline text-teal">
            Back to thank-you page
          </Link>
        </div>
      </main>
      <SiteFooter audience="osc" />
    </div>
  );
}
