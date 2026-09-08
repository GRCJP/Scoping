"use client";

import { BrandMark } from "@/components/layout/BrandMark";
import { useBrand } from "@/components/layout/BrandProvider";

const DEFAULT_CONTACT = "assessors@example.com";

type NextStep = {
  label: string;
  current?: boolean;
  folder?: boolean;
};

const NEXT_STEPS: readonly NextStep[] = [
  { label: "Submission received", current: true },
  { label: "Box link — upload evidence", folder: true },
  { label: "Mock or certification assessment scheduled" },
  { label: "Evidence uploaded ~2 weeks before the assessment" },
];

function FolderGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l1.8 1.8H18.5A2.5 2.5 0 0 1 21 9.3v8.2A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10z" />
    </svg>
  );
}

/**
 * Public thank-you chrome. Same copy and workflow as the Power Pages
 * in-page success view. Does not dump answers or invent a Box URL.
 * Contact mailbox comes from brand / NEXT_PUBLIC_CONTACT_EMAIL (generic default).
 */
export function ThankYouView() {
  const brand = useBrand();
  const contact = brand.contactMailbox || DEFAULT_CONTACT;

  return (
    <div className="min-h-screen flex flex-col intake-dark text-white">
      <header className="flex items-center justify-center px-6 pt-6 pb-4">
        <BrandMark />
      </header>

      <main className="flex-1 px-5 pb-16">
        <div className="mx-auto max-w-4xl pt-6 text-center">
          <h1 className="font-display font-semibold text-white leading-tight text-4xl sm:text-5xl">
            Thank you.
          </h1>
          <p className="mt-4 text-white leading-relaxed text-xl sm:text-2xl">
            We received your submission.
          </p>

          <ol className="psc-done-flow mt-12 mx-auto flex flex-col md:flex-row max-w-xs md:max-w-4xl text-left md:text-center list-none p-0" aria-label="What happens next">
            {NEXT_STEPS.map((step, i) => (
              <li
                key={step.label}
                className="relative grid grid-cols-[2.5rem_1fr] gap-x-3 pb-6 last:pb-0 md:flex md:flex-col md:items-center md:flex-1 md:min-w-0 md:px-2 md:pb-0"
                aria-current={step.current ? "step" : undefined}
              >
                {i < NEXT_STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[1.2rem] top-10 bottom-0 w-px bg-white/20 md:left-[calc(50%+1.35rem)] md:right-[calc(-50%+1.35rem)] md:top-5 md:bottom-auto md:h-px md:w-auto"
                  />
                ) : null}
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                  style={
                    step.current
                      ? { backgroundColor: "#FBBF24", color: "#021E47" }
                      : { backgroundColor: "#12366C", color: "#fff", border: "1px solid rgba(251, 191, 36, 0.45)" }
                  }
                  aria-hidden="true"
                >
                  {step.folder ? <FolderGlyph /> : i + 1}
                </span>
                <div>
                  <p className="m-0 pt-1.5 md:pt-0 md:mt-3 text-base font-medium text-white leading-snug">
                    {step.label}
                  </p>
                  {step.current ? (
                    <p className="m-0 mt-1 text-sm font-semibold" style={{ color: "#FBBF24" }}>
                      You are here
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-10 text-white text-base leading-relaxed">
            We notify the assessment team when you submit.
          </p>
          <p className="mt-3 text-white text-base leading-relaxed">
            If you have questions, email{" "}
            <a href={`mailto:${contact}`} className="underline underline-offset-2" style={{ color: "#FBBF24" }}>
              {contact}
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
