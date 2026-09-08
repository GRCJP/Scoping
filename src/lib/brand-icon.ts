/**
 * Tab / URL favicon selection. Committed default is the Scoping reticle
 * (`public/icon.svg`). Overlay packs may ship a square icon; otherwise a
 * navy + silver/gold mark is generated at request time. Never commit
 * customer art.
 */
import type { Metadata } from "next";
import { safeLogoFilename, type BrandPackJson, type ResolvedBrand } from "./brand.ts";

export const SCOPING_ICON_SRC = "/icon.svg";
export const OVERLAY_ICON_SRC = "/api/brand/icon";

/** Conventional square filenames next to brand.json + logo. First match wins. */
export const PACK_ICON_FILENAMES = [
  "icon.png",
  "icon.svg",
  "favicon.png",
  "favicon.svg",
  "favicon.ico",
] as const;

export function packIconCandidates(pack: BrandPackJson): string[] {
  const preferred = safeLogoFilename(pack.icon);
  const rest = PACK_ICON_FILENAMES.filter((name) => name !== preferred);
  return preferred ? [preferred, ...rest] : [...PACK_ICON_FILENAMES];
}

/** Short tab mark: pack shortName when it fits, else a compact display-name stem. */
export function overlayIconLabel(brand: Pick<ResolvedBrand, "shortName" | "displayName">): string {
  const short = brand.shortName.trim();
  if (short && short.length <= 4) return short;
  const stem = brand.displayName.replace(/[^A-Za-z0-9]/g, "").slice(0, 3);
  return stem || "•";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Navy square + silver label + gold rule. Used when the pack has no icon.png. */
export function overlayIconSvg(label: string): string {
  const text = escapeXml(label.slice(0, 4));
  const fontSize = text.length >= 4 ? 10 : text.length === 3 ? 12 : 14;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">`,
    `<rect width="32" height="32" fill="#021E47"/>`,
    `<text x="16" y="21" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="#E8ECF1">${text}</text>`,
    `<rect x="8" y="25" width="16" height="1.5" rx="0.75" fill="#FBBF24"/>`,
    `</svg>`,
  ].join("");
}

export function resolveBrandIcons(brand: ResolvedBrand): NonNullable<Metadata["icons"]> {
  if (brand.overlay) {
    return { icon: [{ url: OVERLAY_ICON_SRC }] };
  }
  return { icon: [{ url: SCOPING_ICON_SRC, type: "image/svg+xml" }] };
}
