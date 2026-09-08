"use client";

/** Sticky two-line no-CUI bar. Gold ALL CAPS is the voice — no icon, no warning word. */
export function ScopeWarningBanner() {
  return (
    <aside
      role="note"
      aria-label="Do not include CUI"
      className="w-full flex items-center justify-center"
      style={{
        backgroundColor: "#12366C",
        minHeight: 60,
        height: 60,
      }}
    >
      <p className="w-full text-center px-4 leading-tight">
        <span className="block font-bold tracking-wide" style={{ color: "#FBBF24", fontSize: 17 }}>
          DO NOT INCLUDE CUI.
        </span>
        <span className="block font-medium" style={{ color: "#FFFFFF", fontSize: 17, marginTop: 2 }}>
          High-level only. No server names, machine names, file paths, or IPs.
        </span>
      </p>
    </aside>
  );
}
