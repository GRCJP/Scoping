/**
 * White-label name and mark.
 *
 * Committed defaults are Scoping only. A local checkout may overlay a company
 * pack from `org-logos/<id>/` (then `brands/<id>/`) when BRAND or
 * NEXT_PUBLIC_BRAND is set — see load-brand.ts and org-logos/README.md. Visual chrome (navy #021E47 /
 * #12366C, gold #FBBF24, type, stepper) stays in tailwind.config.ts and
 * globals.css — do not restyle the intake to re-skin.
 */

export type BrandPackJson = {
  id?: string;
  name?: string;
  shortName?: string;
  logo?: string;
  /** Optional square tab icon filename next to brand.json (icon.png / favicon.png). */
  icon?: string;
  /** Optional public contact mailbox (thank-you page). */
  contactEmail?: string;
};

export type ResolvedBrand = {
  id: string;
  displayName: string;
  shortName: string;
  productName: string;
  legalName: string;
  logoSrc: string;
  publicSiteUrl: string;
  assessorMailbox: string;
  /** Public thank-you / “questions” mailbox. Not the internal assessor To:. */
  contactMailbox: string;
  /** True when a local company pack supplied name + logo. */
  overlay: boolean;
};

export const OVERLAY_LOGO_SRC = "/api/brand/logo";

/** Committed Scoping defaults. Never put a customer name or logo path here. */
export const SCOPING_DEFAULTS: ResolvedBrand = {
  id: "scoping",
  displayName: "Scoping",
  shortName: "Scoping",
  /** Internal product label — do not render on public intake, welcome, or header. */
  productName: "OSC Discovery",
  legalName: "the C3PAO",
  logoSrc: "/brand/mark.svg",
  publicSiteUrl: "/",
  assessorMailbox: "assessors@example.com",
  contactMailbox: "assessors@example.com",
  overlay: false,
};

function envMailbox(
  env: Record<string, string | undefined>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Optional env overrides that do not require a company pack (name/logo still Scoping unless set). */
export function envBrandBase(env: Record<string, string | undefined> = process.env): ResolvedBrand {
  const name = env.NEXT_PUBLIC_BRAND_NAME?.trim();
  const assessorMailbox =
    envMailbox(env, "NEXT_PUBLIC_ASSESSOR_MAILBOX") || SCOPING_DEFAULTS.assessorMailbox;
  return {
    id: "scoping",
    displayName: name || SCOPING_DEFAULTS.displayName,
    shortName: name || SCOPING_DEFAULTS.shortName,
    productName: env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || SCOPING_DEFAULTS.productName,
    legalName: env.NEXT_PUBLIC_C3PAO_LEGAL_NAME?.trim() || SCOPING_DEFAULTS.legalName,
    logoSrc: env.NEXT_PUBLIC_BRAND_LOGO?.trim() || SCOPING_DEFAULTS.logoSrc,
    publicSiteUrl: env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim() || SCOPING_DEFAULTS.publicSiteUrl,
    assessorMailbox,
    contactMailbox:
      envMailbox(env, "NEXT_PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_ASSESSOR_MAILBOX") ||
      SCOPING_DEFAULTS.contactMailbox,
    overlay: false,
  };
}

/**
 * Folder id under brands/. Rejects path traversal and empty values.
 * Unset or invalid → null (caller uses Scoping defaults).
 */
export function selectedBrandId(env: Record<string, string | undefined>): string | null {
  const raw = (env.BRAND || env.NEXT_PUBLIC_BRAND || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(raw)) return null;
  return raw;
}

/** Logo must be a single filename next to brand.json — never a path. */
export function safeLogoFilename(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(trimmed)) return null;
  return trimmed;
}

export function applyBrandPack(
  base: ResolvedBrand,
  pack: BrandPackJson | null,
  opts: { logoReady: boolean; logoSrc: string; selectedId?: string },
): ResolvedBrand {
  if (!pack || !opts.logoReady) return base;
  const name = typeof pack.name === "string" ? pack.name.trim() : "";
  const logo = safeLogoFilename(pack.logo);
  if (!name || !logo) return base;
  const shortName = typeof pack.shortName === "string" && pack.shortName.trim() ? pack.shortName.trim() : name;
  const id =
    (typeof pack.id === "string" && pack.id.trim()) || opts.selectedId || base.id;
  const contact =
    typeof pack.contactEmail === "string" && pack.contactEmail.trim() ? pack.contactEmail.trim() : "";
  return {
    ...base,
    id,
    displayName: name,
    shortName,
    logoSrc: opts.logoSrc,
    contactMailbox: contact || base.contactMailbox,
    overlay: true,
  };
}

export function resolveBrandOverlay(input: {
  env: Record<string, string | undefined>;
  base?: ResolvedBrand;
  readPack: (id: string) => { pack: BrandPackJson; logoReady: boolean; logoSrc?: string } | null;
}): ResolvedBrand {
  const base = input.base ?? envBrandBase(input.env);
  const id = selectedBrandId(input.env);
  if (!id) return base;
  try {
    const loaded = input.readPack(id);
    if (!loaded) return base;
    return applyBrandPack(base, loaded.pack, {
      logoReady: loaded.logoReady,
      logoSrc: loaded.logoSrc || OVERLAY_LOGO_SRC,
      selectedId: id,
    });
  } catch {
    return base;
  }
}

/** Env-only snapshot for modules that do not load a disk pack. Overlay is applied via loadBrand() / BrandProvider. */
export const brand = envBrandBase();

export function brandTitle(b: ResolvedBrand = brand): string {
  return b.displayName;
}
