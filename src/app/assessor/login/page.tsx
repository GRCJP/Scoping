"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Assessor gate. POSTs the key; the server sets an HttpOnly SameSite=Strict cookie.
 * Do not put the key in the URL.
 */
export default function AssessorLoginPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/assessor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "That key is not accepted." : "Could not sign in.");
        setBusy(false);
        return;
      }
      router.replace("/assessor");
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white flex flex-col">
      <header className="px-6 py-4">
        <BrandMark href="/" compact />
      </header>
      <main className="flex-1 flex items-start justify-center px-6 pt-16">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="w-full max-w-sm rounded-xl border border-white/15 bg-navy p-6 shadow-card"
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Internal</p>
          <h1 className="font-display text-2xl font-semibold mt-1">Assessor sign-in</h1>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            Enter the assessor key. It is stored in a session cookie (HttpOnly, SameSite=Strict). Do
            not put it in the address bar.
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="assessor-key" className="text-white/80">
              Assessor key
            </Label>
            <Input
              id="assessor-key"
              name="assessor-key"
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="bg-white"
            />
          </div>
          {error ? <p className="mt-3 text-sm text-gold">{error}</p> : null}
          <Button type="submit" className="mt-6 w-full" disabled={busy || !key.trim()}>
            {busy ? "Signing in…" : "Continue"}
          </Button>
        </form>
      </main>
    </div>
  );
}
