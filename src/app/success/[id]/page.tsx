import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ThankYouView } from "@/components/form/ThankYouView";
import { isSubmissionId } from "@/lib/ids";

export const dynamic = "force-dynamic";

/**
 * Public thank-you by id. No store lookup — do not confirm names, emails,
 * or answers from an unauthenticated URL.
 */
export default async function SuccessByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSubmissionId(id)) notFound();

  return (
    <Suspense fallback={null}>
      <ThankYouView />
    </Suspense>
  );
}
