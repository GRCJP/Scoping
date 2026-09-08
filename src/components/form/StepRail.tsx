"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { remainingCopy } from "@/lib/beats";

export { remainingCopy };

export function StepRail({
  steps,
  idx,
  started,
  incomplete,
  onSelect,
}: {
  steps: { id: string; nav: string }[];
  idx: number;
  started: boolean;
  incomplete?: boolean[];
  onSelect: (i: number) => void;
}) {
  const current = idx;
  return (
    <nav aria-label="Intake sections" className="shrink-0">
      <ol className="flex overflow-x-auto snap-x snap-mandatory gap-2 px-4 sm:px-5 py-2 sm:justify-center">
        {steps.map((s, i) => {
          const done = started && i < idx && !incomplete?.[i];
          const on = started && i === current;
          const gap = started && Boolean(incomplete?.[i]) && !on;
          return (
            <li key={s.id} className="shrink-0 snap-start">
              <button
                type="button"
                aria-label={s.nav}
                aria-current={on ? "step" : undefined}
                disabled={!started}
                onClick={() => {
                  if (started) onSelect(i);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full text-white font-medium whitespace-nowrap border border-transparent font-sans",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  started && "cursor-pointer",
                  on && "bg-gold text-navy border-gold",
                  !started && "pointer-events-none cursor-default"
                )}
                style={{
                  fontSize: 16,
                  minHeight: 40,
                  paddingLeft: 16,
                  paddingRight: 16,
                }}
              >
                {done ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden /> : null}
                {gap ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0 bg-white"
                    aria-hidden
                    title="Still required"
                  />
                ) : null}
                {s.nav}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
