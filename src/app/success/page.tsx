import { Suspense } from "react";
import { ThankYouView } from "@/components/form/ThankYouView";

/**
 * Bare /success — keep for old links. Submit always goes to /success/[id].
 * No store lookup.
 */
export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouView />
    </Suspense>
  );
}
