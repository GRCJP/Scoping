"use client";

import Link from "next/link";
import { useBrand } from "@/components/layout/BrandProvider";

export function SiteFooter({
  dark = false,
  audience = "osc",
}: {
  dark?: boolean;
  audience?: "osc" | "assessor";
}) {
  const brand = useBrand();
  const assessor = audience === "assessor";
  return (
    <footer
      className={
        dark
          ? "border-t border-white/10 px-6 py-4 text-xs text-white/90"
          : "border-t border-paper-300 px-6 py-5 text-xs text-ink-400"
      }
    >
      <p>{brand.displayName}</p>
      {assessor ? (
        <p className="mt-2">
          Evidence folders are simulated in this deployment. Box is not connected.
          {" · "}
          <Link href="/assessor" className="underline underline-offset-2">
            Assessor console
          </Link>
        </p>
      ) : null}
    </footer>
  );
}
