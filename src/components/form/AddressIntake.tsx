"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Field, TextField } from "@/components/form/Field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import {
  applyParsedAddress,
  formatAddressSummary,
  hasStructuredAddress,
  parseUsMailingAddress,
} from "@/lib/parse-address";
import type { FormAnswers } from "@/lib/types";

const PASTE_PLACEHOLDER = `18 Thames St
Suite 12
Newport, RI 02840`;

export type AddressFlush = () => void;

export function AddressIntake({
  a,
  patch,
  patchMany,
  errors,
  flushRef,
}: {
  a: FormAnswers;
  patch: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void;
  patchMany: (updates: Partial<FormAnswers>) => void;
  errors: Record<string, string>;
  flushRef?: MutableRefObject<AddressFlush | null>;
}) {
  const structured = hasStructuredAddress(a);
  const addressErrors = Boolean(
    errors.address1 || errors.address2 || errors.city || errors.state || errors.zip || errors.country,
  );
  const [paste, setPaste] = useState("");
  const [appliedPaste, setAppliedPaste] = useState("");
  const [fieldsOpen, setFieldsOpen] = useState(structured || addressErrors);
  const answersRef = useRef(a);
  const appliedRef = useRef(appliedPaste);
  answersRef.current = a;
  appliedRef.current = appliedPaste;

  useEffect(() => {
    if (structured || addressErrors) setFieldsOpen(true);
  }, [structured, addressErrors]);

  const applyFromText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      if (trimmed === appliedRef.current) {
        setFieldsOpen(true);
        return false;
      }
      const current = answersRef.current;
      const parsed = parseUsMailingAddress(trimmed, { defaultCountry: current.country || "United States" });
      setFieldsOpen(true);
      if (!parsed) return false;
      patchMany(applyParsedAddress(current, parsed));
      appliedRef.current = trimmed;
      setAppliedPaste(trimmed);
      return true;
    },
    [patchMany],
  );

  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = () => {
      applyFromText(paste);
    };
    return () => {
      flushRef.current = null;
    };
  }, [applyFromText, flushRef, paste]);

  const showFields = fieldsOpen || structured || addressErrors || Boolean(paste.trim());
  const summary = showFields ? formatAddressSummary(a) : "";

  return (
    <>
      <Field
        label="Paste address"
        hint="Paste or type the full mailing address. Street, city, state, and ZIP — the fields below update as you go."
        fieldKey="address_paste"
        htmlFor="address-paste"
      >
        <Textarea
          id="address-paste"
          name="address_paste"
          rows={4}
          value={paste}
          placeholder={PASTE_PLACEHOLDER}
          onChange={(e) => {
            const next = e.target.value;
            setPaste(next);
            applyFromText(next);
          }}
          onBlur={() => applyFromText(paste)}
          autoComplete="street-address"
          className={cn(
            "text-lg bg-white text-navy rounded-lg border-paper-300 placeholder:text-navy min-h-[7rem]",
          )}
        />
      </Field>
      {!showFields ? (
        <button
          type="button"
          onClick={() => setFieldsOpen(true)}
          className="text-base text-white underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-expanded={false}
        >
          Edit address fields
        </button>
      ) : null}
      {summary ? (
        <p className="text-white leading-relaxed" style={{ fontSize: 16 }} aria-live="polite">
          {summary}
        </p>
      ) : null}
      {showFields ? (
        <div className="space-y-6">
          <TextField
            label="Address line 1"
            required
            value={a.address1}
            onChange={(v) => patch("address1", v)}
            fieldKey="address1"
            error={errors.address1}
          />
          <TextField
            label="Address line 2"
            value={a.address2}
            onChange={(v) => patch("address2", v)}
            fieldKey="address2"
            error={errors.address2}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField
              label="City"
              required
              value={a.city}
              onChange={(v) => patch("city", v)}
              fieldKey="city"
              error={errors.city}
            />
            <TextField
              label="State"
              required
              value={a.state}
              onChange={(v) => patch("state", v)}
              fieldKey="state"
              error={errors.state}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="ZIP" value={a.zip} onChange={(v) => patch("zip", v)} fieldKey="zip" error={errors.zip} />
            <TextField
              label="Country"
              required
              value={a.country}
              onChange={(v) => patch("country", v)}
              fieldKey="country"
              error={errors.country}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
