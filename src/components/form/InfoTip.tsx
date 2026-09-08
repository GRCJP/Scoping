"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** On-demand jargon help. Not a chat persona. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 rounded-full border border-white text-[16px] font-semibold italic text-white hover:bg-white hover:text-navy hover:border-white inline-flex items-center justify-center leading-none"
      >
        i
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-0 top-[calc(100%+0.45rem)] z-40 w-72 max-w-[min(18rem,calc(100vw-2.5rem))] rounded-lg bg-white text-navy text-base leading-relaxed px-3.5 py-3 shadow-lift"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
