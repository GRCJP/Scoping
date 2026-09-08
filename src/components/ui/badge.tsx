import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "border-transparent bg-pine-100 text-teal",
        outline: "border-paper-300 text-ink-500",
        brass: "border-transparent bg-brass-100 text-brass-600",
        clay: "border-transparent bg-clay-50 text-clay-600",
        ink: "border-transparent bg-navy text-white",
        paper: "border-paper-300 bg-paper-50 text-ink-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
