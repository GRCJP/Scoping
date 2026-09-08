"use client";

import { Button } from "@/components/ui/button";

const CARDS = [
  {
    label: "Scope, not a score",
    body: "No SPRS, no MET / NOT MET. Just how CUI moves through your environment.",
  },
  {
    label: "High-level only",
    body: "No CUI in the answers. No hostnames, file paths, or machine names.",
  },
  {
    label: "Gets the process started",
    body: "Leave and come back. Your answers kick off the engagement with the shape of the enclave already clear.",
  },
];

export function WelcomeIntro({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full max-w-3xl text-center">
      <h1
        className="font-display text-5xl sm:text-6xl font-semibold text-white leading-tight text-center"
        style={{ textAlign: "center" }}
      >
        Map the CUI boundary before the assessment.
      </h1>
      <p className="mt-10 text-2xl text-white leading-relaxed text-center" style={{ textAlign: "center" }}>
        This questionnaire describes the environment that will be assessed. Complete it to get the process started.
      </p>
      <ul className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <li
            key={card.label}
            className="rounded-lg min-h-[10.5rem] px-6 py-7 text-left"
            style={{ backgroundColor: "#12366C", border: "1px solid rgba(251, 191, 36, 0.45)" }}
          >
            <p className="font-medium text-white leading-snug" style={{ fontSize: 18 }}>
              {card.label}
            </p>
            <p className="mt-2 text-white leading-relaxed" style={{ fontSize: 16 }}>
              {card.body}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex justify-center">
        <Button type="button" size="lg" onClick={onStart} className="min-w-[9.5rem] h-14">
          Start
        </Button>
      </div>
    </div>
  );
}
