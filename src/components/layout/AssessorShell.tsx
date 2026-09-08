import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";
import { loadBrand } from "@/lib/load-brand";

export async function AssessorShell({ children, title }: { children: ReactNode; title?: string }) {
  const brand = await loadBrand();
  return (
    <div className="min-h-screen bg-navy-900 text-white flex">
      <aside className="w-56 shrink-0 border-r border-white/10 hidden md:flex flex-col circuit-chrome">
        <div className="px-4 py-5">
          <BrandMark href="/assessor" compact />
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/50 mt-4">Scoping</p>
          <p className="font-display text-xl mt-0.5 font-semibold">{brand.displayName}</p>
        </div>
        <nav className="px-3 space-y-1 text-sm">
          <Link href="/assessor" className="block rounded-md px-3 py-2 bg-white/10 text-white border border-white/15">
            OSC Discovery
          </Link>
          <span className="block rounded-md px-3 py-2 text-white/35">Assessments (not this product)</span>
          <span className="block rounded-md px-3 py-2 text-white/35">CUI library (not this product)</span>
        </nav>
        <p className="mt-auto px-5 py-6 text-[11px] text-white/35 leading-relaxed">
          Demo console. In-memory store. Dedicated Scoping drops parent — not assessment, not CUI.
        </p>
      </aside>
      <div className="flex-1 min-w-0 bg-paper text-ink flex flex-col">
        <header className="h-14 border-b border-navy/20 bg-navy px-6 flex items-center justify-between text-white">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Internal</p>
            <h1 className="text-sm font-medium">{title ?? "OSC Discovery"}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/intake" className="text-white/80 hover:text-white">
              Public form
            </Link>
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
