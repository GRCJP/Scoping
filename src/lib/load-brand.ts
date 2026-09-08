/**
 * Server-only company-pack loader. Do not import from client components.
 * Missing or invalid packs never throw — callers get Scoping defaults.
 *
 * Resolution order when BRAND is set:
 *   1. org-logos/<id>/ (canonical disk — `next dev`)
 *   2. brands/<id>/ (fallback disk)
 *   3. public/brand-overlay/<id>/ (optional local copy)
 *   4. Cloudflare BRAND_PACK R2, then ASSETS /brand-overlay/<id>/
 * Empty BRAND → Scoping, or Path A NEXT_PUBLIC_BRAND_* if those were baked.
 */
import fs from "node:fs";
import path from "node:path";
import {
  applyBrandPack,
  envBrandBase,
  resolveBrandOverlay,
  safeLogoFilename,
  selectedBrandId,
  type BrandPackJson,
  type ResolvedBrand,
} from "./brand.ts";
import { overlayIconLabel, overlayIconSvg, packIconCandidates } from "./brand-icon.ts";
import { OVERLAY_ASSET_DIR, logoContentType, overlayAssetLogoSrc } from "./brand-overlay-pack.ts";

export const PACK_SECTIONS = ["org-logos", "brands"] as const;

function packDir(root: string, section: string, id: string): string {
  return path.join(root, section, id);
}

function readPackInSection(
  root: string,
  section: string,
  id: string,
): { pack: BrandPackJson; logoReady: boolean; section: string } | null {
  const jsonPath = path.join(packDir(root, section, id), "brand.json");
  if (!fs.existsSync(jsonPath)) return null;
  const pack = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as BrandPackJson;
  const logoName = safeLogoFilename(pack.logo);
  if (!logoName) return { pack, logoReady: false, section };
  const logoPath = path.join(packDir(root, section, id), logoName);
  if (!fs.existsSync(logoPath) || !fs.statSync(logoPath).isFile()) {
    return { pack, logoReady: false, section };
  }
  return { pack, logoReady: true, section };
}

/** org-logos first (complete pack wins), then brands. Incomplete json-only packs lose to a complete later section. */
export function readPackFromDisk(
  root: string,
  id: string,
): { pack: BrandPackJson; logoReady: boolean; section?: string } | null {
  let incomplete: { pack: BrandPackJson; logoReady: boolean; section: string } | null = null;
  for (const section of PACK_SECTIONS) {
    try {
      const loaded = readPackInSection(root, section, id);
      if (!loaded) continue;
      if (loaded.logoReady) return loaded;
      if (!incomplete) incomplete = loaded;
    } catch {
      /* missing or unreadable — try the next section */
    }
  }
  return incomplete;
}

/** Deploy overlay copied into public/brand-overlay/<id>/ (Node / next build). */
export function readPackFromPublicOverlay(
  root: string,
  id: string,
): { pack: BrandPackJson; logoReady: boolean; section: string } | null {
  try {
    return readPackInSection(root, path.join("public", OVERLAY_ASSET_DIR), id);
  } catch {
    return null;
  }
}

function readLocalPack(
  root: string,
  id: string,
): { pack: BrandPackJson; logoReady: boolean; logoSrc?: string; section?: string } | null {
  const disk = readPackFromDisk(root, id);
  if (disk?.logoReady) return disk;
  const overlay = readPackFromPublicOverlay(root, id);
  if (overlay?.logoReady) {
    const logoName = safeLogoFilename(overlay.pack.logo);
    return {
      ...overlay,
      logoSrc: logoName ? overlayAssetLogoSrc(id, logoName) : undefined,
    };
  }
  return disk;
}

/** Sync resolver for tests and Node. Workers without a disk pack get Scoping here. */
export function loadBrandSync(
  env: Record<string, string | undefined> = process.env,
  root: string = process.cwd(),
): ResolvedBrand {
  return resolveBrandOverlay({
    env,
    readPack: (id) => {
      try {
        return readLocalPack(root, id);
      } catch {
        return null;
      }
    },
  });
}

/** Disk / public overlay, then Cloudflare ASSETS or optional R2. */
export async function loadBrand(
  env: Record<string, string | undefined> = process.env,
  root: string = process.cwd(),
): Promise<ResolvedBrand> {
  const local = loadBrandSync(env, root);
  if (local.overlay) return local;
  const id = selectedBrandId(env);
  if (!id) return local;
  try {
    const { readPackFromCloudflare } = await import("./cf-brand.ts");
    const remote = await readPackFromCloudflare(id);
    if (!remote?.logoReady) return local;
    return applyBrandPack(envBrandBase(env), remote.pack, {
      logoReady: true,
      logoSrc: remote.logoSrc,
      selectedId: id,
    });
  } catch {
    return local;
  }
}

function generatedOverlayIcon(
  env: Record<string, string | undefined>,
  root: string,
): { body: Buffer; contentType: string } | null {
  const brand = loadBrandSync(env, root);
  if (!brand.overlay) return null;
  return {
    body: Buffer.from(overlayIconSvg(overlayIconLabel(brand))),
    contentType: "image/svg+xml",
  };
}

function readIconBytes(
  dir: string,
  pack: BrandPackJson,
): { body: Buffer; contentType: string } | null {
  for (const iconName of packIconCandidates(pack)) {
    const iconPath = path.join(dir, iconName);
    if (!fs.existsSync(iconPath) || !fs.statSync(iconPath).isFile()) continue;
    return {
      body: fs.readFileSync(iconPath),
      contentType: logoContentType(iconName),
    };
  }
  return null;
}

function readLogoBytes(
  dir: string,
  pack: BrandPackJson,
): { body: Buffer; contentType: string } | null {
  const logoName = safeLogoFilename(pack.logo);
  if (!logoName) return null;
  const logoPath = path.join(dir, logoName);
  if (!fs.existsSync(logoPath) || !fs.statSync(logoPath).isFile()) return null;
  return {
    body: fs.readFileSync(logoPath),
    contentType: logoContentType(logoName),
  };
}

export function readOverlayLogoSync(
  env: Record<string, string | undefined> = process.env,
  root: string = process.cwd(),
): { body: Buffer; contentType: string } | null {
  const id = selectedBrandId(env);
  if (!id) return null;
  try {
    const disk = readPackFromDisk(root, id);
    const diskLogo = disk?.logoReady && disk.section ? readLogoBytes(packDir(root, disk.section, id), disk.pack) : null;
    if (diskLogo) return diskLogo;
    const overlay = readPackFromPublicOverlay(root, id);
    if (overlay?.logoReady) {
      return readLogoBytes(path.join(root, "public", OVERLAY_ASSET_DIR, id), overlay.pack);
    }
    return null;
  } catch {
    return null;
  }
}

export async function readOverlayLogo(
  env: Record<string, string | undefined> = process.env,
  root: string = process.cwd(),
): Promise<{ body: Buffer; contentType: string } | null> {
  const local = readOverlayLogoSync(env, root);
  if (local) return local;
  const id = selectedBrandId(env);
  if (!id) return null;
  try {
    const { readLogoFromCloudflare } = await import("./cf-brand.ts");
    return await readLogoFromCloudflare(id);
  } catch {
    return null;
  }
}

export function readOverlayIconSync(
  env: Record<string, string | undefined> = process.env,
  root: string = process.cwd(),
): { body: Buffer; contentType: string } | null {
  const id = selectedBrandId(env);
  if (!id) return null;
  try {
    const disk = readPackFromDisk(root, id);
    const diskIcon = disk?.logoReady && disk.section ? readIconBytes(packDir(root, disk.section, id), disk.pack) : null;
    if (diskIcon) return diskIcon;
    const overlay = readPackFromPublicOverlay(root, id);
    if (overlay?.logoReady) {
      const overlayIcon = readIconBytes(path.join(root, "public", OVERLAY_ASSET_DIR, id), overlay.pack);
      if (overlayIcon) return overlayIcon;
    }
  } catch {
    /* fall through to generated mark */
  }
  return generatedOverlayIcon(env, root);
}

export async function readOverlayIcon(
  env: Record<string, string | undefined> = process.env,
  root: string = process.cwd(),
): Promise<{ body: Buffer; contentType: string } | null> {
  const id = selectedBrandId(env);
  if (!id) return null;
  try {
    const disk = readPackFromDisk(root, id);
    const diskIcon = disk?.logoReady && disk.section ? readIconBytes(packDir(root, disk.section, id), disk.pack) : null;
    if (diskIcon) return diskIcon;
    const overlay = readPackFromPublicOverlay(root, id);
    if (overlay?.logoReady) {
      const overlayIcon = readIconBytes(path.join(root, "public", OVERLAY_ASSET_DIR, id), overlay.pack);
      if (overlayIcon) return overlayIcon;
    }
  } catch {
    /* try Cloudflare, then generated mark */
  }
  try {
    const { readIconFromCloudflare } = await import("./cf-brand.ts");
    const remote = await readIconFromCloudflare(id);
    if (remote) return remote;
  } catch {
    /* generate from the resolved overlay when the pack has no square icon */
  }
  const brand = await loadBrand(env, root);
  if (!brand.overlay) return null;
  return {
    body: Buffer.from(overlayIconSvg(overlayIconLabel(brand))),
    contentType: "image/svg+xml",
  };
}
