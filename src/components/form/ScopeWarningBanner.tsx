"use client";

import { CUI_PATH_WARNING, SCOPE_WARNING_SHORT } from "@/lib/cui-path";

/** Sticky no-CUI bar. Gold ALL CAPS is the voice — no icon, no warning word. */
export function ScopeWarningBanner({ strong = false }: { strong?: boolean }) {
  return (
    <aside
      role="note"
      aria-label="Do not include CUI"
      className="w-full flex items-center justify-center"
      style={{
        backgroundColor: "#12366C",
        minHeight: 60,
        height: strong ? undefined : 60,
        paddingTop: strong ? 10 : undefined,
        paddingBottom: strong ? 10 : undefined,
      }}
    >
      <p className="w-full text-center px-4 leading-tight">
        <span className="block font-bold tracking-wide" style={{ color: "#FBBF24", fontSize: 17 }}>
          DO NOT INCLUDE CUI.
        </span>
        <span
          className="block font-medium"
          style={{ color: "#FFFFFF", fontSize: strong ? 15 : 17, marginTop: 2, lineHeight: strong ? 1.35 : undefined }}
        >
          {strong ? CUI_PATH_WARNING : SCOPE_WARNING_SHORT}
        </span>
      </p>
    </aside>
  );
}
