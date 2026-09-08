"use client";

import Link from "next/link";
import { useBrand } from "@/components/layout/BrandProvider";
import { cn } from "@/lib/cn";

export function BrandMark({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  const brand = useBrand();
  const img = (
    <img
      src={brand.logoSrc}
      alt={brand.displayName}
      className={cn("w-auto bg-transparent", compact ? "h-12" : "h-16")}
    />
  );
  if (!href) return <div className={cn("inline-flex items-center", className)}>{img}</div>;
  return (
    <Link href={href} className={cn("inline-flex items-center", className)} aria-label={`${brand.displayName} home`}>
      {img}
    </Link>
  );
}
