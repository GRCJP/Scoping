"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/form/InfoTip";

export function Field({
  label,
  hint,
  notice,
  error,
  children,
  required,
  tip,
  fieldKey,
  htmlFor,
}: {
  label: string;
  hint?: string;
  notice?: string;
  error?: string;
  required?: boolean;
  tip?: string;
  fieldKey?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2" id={fieldKey ? `field-${fieldKey}` : undefined}>
      <Label
        htmlFor={htmlFor}
        className="font-semibold tracking-normal text-white inline-flex items-center flex-wrap gap-x-2 gap-y-1"
        style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF" }}
      >
        <span>
          {label}
          {required ? <span className="text-white ml-1">*</span> : null}
        </span>
        {tip ? <InfoTip label={label}>{tip}</InfoTip> : null}
      </Label>
      {hint ? <p className="text-white leading-relaxed" style={{ fontSize: 16 }}>{hint}</p> : null}
      {notice ? (
        <p className="leading-relaxed" role="note" style={{ color: "#FBBF24", fontSize: 14 }}>
          {notice}
        </p>
      ) : null}
      {children}
      {error ? <p className="text-[#FCA5A5] leading-relaxed" style={{ fontSize: 14 }}>{error}</p> : null}
    </div>
  );
}

type FieldBits = {
  label: string;
  hint?: string;
  notice?: string;
  error?: string;
  required?: boolean;
  tip?: string;
  fieldKey?: string;
};

export function TextField({
  label,
  hint,
  notice,
  error,
  required,
  tip,
  fieldKey,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  maxLength,
  autoCapitalize,
  spellCheck,
}: FieldBits & {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  autoCapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
  spellCheck?: boolean;
}) {
  return (
    <Field label={label} hint={hint} notice={notice} error={error} required={required} tip={tip} fieldKey={fieldKey}>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        className={cn(
          "h-12 text-lg bg-white text-navy rounded-lg border-paper-300 placeholder:text-navy",
          error && "border-[#FCA5A5]"
        )}
      />
    </Field>
  );
}

export function AreaField({
  label,
  hint,
  error,
  required,
  tip,
  fieldKey,
  value,
  onChange,
  placeholder,
  rows = 3,
}: FieldBits & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} tip={tip} fieldKey={fieldKey}>
      <Textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "text-lg bg-white text-navy rounded-lg border-paper-300 placeholder:text-navy min-h-[7rem]",
          error && "border-[#FCA5A5]"
        )}
      />
    </Field>
  );
}

const pillBase =
  "min-h-11 px-3.5 py-2.5 rounded-full border text-base leading-snug whitespace-normal text-left break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
const pillOn = "bg-gold text-navy border-gold";
const pillOff = "bg-transparent text-white border-white";

export function ChoicePills<T extends string>({
  label,
  hint,
  error,
  required,
  tip,
  fieldKey,
  value,
  onChange,
  options,
}: FieldBits & {
  value: string;
  onChange: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} tip={tip} fieldKey={fieldKey}>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(pillBase, on ? pillOn : pillOff)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function MultiPills<T extends string>({
  label,
  hint,
  error,
  required,
  tip,
  fieldKey,
  value,
  onChange,
  options,
  exclusive,
}: FieldBits & {
  value: string[];
  onChange: (v: T[]) => void;
  options: readonly T[];
  exclusive?: readonly string[];
}) {
  const exclusiveSet = exclusive ?? [];
  return (
    <Field label={label} hint={hint} error={error} required={required} tip={tip} fieldKey={fieldKey}>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (exclusiveSet.includes(opt)) {
                  onChange(on ? [] : [opt]);
                  return;
                }
                const next = on
                  ? value.filter((x) => x !== opt)
                  : [...value.filter((x) => !exclusiveSet.includes(x)), opt];
                onChange(next as T[]);
              }}
              className={cn(pillBase, on ? pillOn : pillOff)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

const selectClass =
  "h-12 w-full text-lg bg-white text-navy rounded-lg border border-paper-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";

export function SelectField<T extends string>({
  label,
  hint,
  error,
  required,
  tip,
  fieldKey,
  value,
  onChange,
  options,
}: FieldBits & {
  value: string;
  onChange: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} tip={tip} fieldKey={fieldKey}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-invalid={!!error}
        className={cn(selectClass, error && "border-[#FCA5A5]")}
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function MultiSelectField<T extends string>({
  label,
  hint,
  error,
  required,
  tip,
  fieldKey,
  value,
  onChange,
  options,
  exclusive,
}: FieldBits & {
  value: string[];
  onChange: (v: T[]) => void;
  options: readonly T[];
  exclusive?: readonly string[];
}) {
  const exclusiveSet = exclusive ?? [];
  const toggle = (opt: T) => {
    const on = value.includes(opt);
    if (exclusiveSet.includes(opt)) {
      onChange(on ? [] : [opt]);
      return;
    }
    const next = on
      ? value.filter((x) => x !== opt)
      : [...value.filter((x) => !exclusiveSet.includes(x)), opt];
    onChange(next as T[]);
  };
  return (
    <Field label={label} hint={hint} error={error} required={required} tip={tip} fieldKey={fieldKey}>
      <div
        role="group"
        aria-invalid={!!error}
        className={cn(
          "rounded-lg overflow-hidden",
          error && "ring-1 ring-[#FCA5A5]"
        )}
        style={{ backgroundColor: "#FFFFFF", color: "#021E47" }}
      >
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <label
              key={opt}
              className={cn(
                "flex items-center gap-2.5 px-3 min-h-12 text-base cursor-pointer",
                on && "bg-gold"
              )}
              style={{ color: "#021E47" }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(opt)}
                className="h-4 w-4 shrink-0 rounded-sm accent-navy"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}

/** Reserve follow-up height so later pills do not jump under the cursor. */
export function RevealSlot({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!open) {
    return <div className="hidden" hidden aria-hidden />;
  }
  return <div className={className}>{children}</div>;
}
