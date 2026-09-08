"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Saved = { dates: string[]; note: string };

function formatDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PreferredDatesForm({
  submissionId,
  initial,
}: {
  submissionId: string;
  initial?: Saved;
}) {
  const [d1, setD1] = useState(initial?.dates[0] ?? "");
  const [d2, setD2] = useState(initial?.dates[1] ?? "");
  const [d3, setD3] = useState(initial?.dates[2] ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saved, setSaved] = useState<Saved | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const dates = [d1, d2, d3].map((d) => d.trim()).filter(Boolean);
    if (!dates.length) {
      setError("Add at least one date.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/submissions/${submissionId}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates, note: note.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        preferredDates?: Saved;
      };
      if (!res.ok) {
        setError(json.error || "Could not save dates.");
        return;
      }
      setSaved(json.preferredDates ?? { dates, note: note.trim() });
    } catch {
      setError("Could not save dates.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 rounded-lg bg-navy-700 p-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white">Preferred dates</p>
      {saved ? (
        <div className="mt-3">
          <p className="text-white leading-relaxed">Thanks, we have those dates.</p>
          <ul className="mt-3 space-y-1 text-sm text-white">
            {saved.dates.map((d) => (
              <li key={d}>{formatDate(d)}</li>
            ))}
          </ul>
          {saved.note ? <p className="mt-3 text-sm text-white/90 leading-relaxed">{saved.note}</p> : null}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-3">
          <p className="text-sm text-white leading-relaxed">
            Optional. A few windows when you would like the assessment finalized.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Date 1", d1, setD1],
                ["Date 2", d2, setD2],
                ["Date 3", d3, setD3],
              ] as const
            ).map(([label, value, set]) => (
              <label key={label} className="block">
                <span className="text-sm font-medium text-white">{label}</span>
                <Input
                  type="date"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="mt-1.5 h-11 bg-white text-navy"
                />
              </label>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-white">Note (optional)</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Timezone, windows, or anything we should know"
              className="mt-1.5 bg-white text-navy placeholder:text-navy/40"
            />
          </label>
          {error ? <p className="mt-3 text-xs text-[#FCA5A5]">{error}</p> : null}
          <Button type="submit" size="lg" className="mt-4" disabled={busy}>
            {busy ? "Sending…" : "Send dates"}
          </Button>
        </form>
      )}
    </div>
  );
}
