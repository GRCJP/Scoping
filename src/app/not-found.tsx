import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-4">
          <BrandMark />
        </div>
        <h1 className="font-display text-4xl mt-2 font-semibold">Not in this drop</h1>
        <p className="text-ink-500 mt-3">
          That record is not in the in-memory store. Submit the public form again, or open the assessor list.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/intake" className="h-10 inline-flex items-center rounded-md bg-gold px-4 text-sm text-navy font-semibold">
            Public form
          </Link>
          <Link href="/assessor" className="h-10 inline-flex items-center rounded-md border border-paper-300 bg-white px-4 text-sm">
            Assessor
          </Link>
        </div>
      </div>
    </div>
  );
}
