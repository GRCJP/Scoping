/**
 * Deploy-time copy of gitignored company packs into public/brand-overlay/.
 * OpenNext / Wrangler ships that folder as Worker ASSETS. Nothing here is committed.
 */
import fs from "node:fs";
import path from "node:path";
import { safeLogoFilename, type BrandPackJson } from "./brand.ts";
import { packIconCandidates } from "./brand-icon.ts";

export const OVERLAY_ASSET_DIR = "brand-overlay";
export const PUBLIC_OVERLAY_DIR = path.join("public", OVERLAY_ASSET_DIR);

/** Browser / ASSETS path for a copied pack file (logo or brand.json). */
export function overlayAssetPath(id: string, fileName: string): string {
  return `/${OVERLAY_ASSET_DIR}/${id}/${fileName}`;
}

/** Browser URL for a copied pack logo. */
export function overlayAssetLogoSrc(id: string, logoName: string): string {
  return overlayAssetPath(id, logoName);
}

const LOGO_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

export function logoContentType(fileName: string): string {
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase() : "";
  return LOGO_CONTENT_TYPES[ext] || "application/octet-stream";
}

export type LocalBrandPack = {
  id: string;
  section: string;
  dir: string;
  pack: BrandPackJson;
  logoName: string;
};

const DISK_SECTIONS = ["brands", "org-logos"] as const;

function isSafePackId(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}

/** Complete local packs. org-logos wins over brands for the same id. */
export function listLocalBrandPacks(root: string): LocalBrandPack[] {
  const byId = new Map<string, LocalBrandPack>();
  for (const section of DISK_SECTIONS) {
    const sectionDir = path.join(root, section);
    let names: string[] = [];
    try {
      names = fs.readdirSync(sectionDir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!isSafePackId(name)) continue;
      const dir = path.join(sectionDir, name);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
        const pack = JSON.parse(fs.readFileSync(path.join(dir, "brand.json"), "utf8")) as BrandPackJson;
        const logoName = safeLogoFilename(pack.logo);
        if (!logoName) continue;
        const logoPath = path.join(dir, logoName);
        if (!fs.existsSync(logoPath) || !fs.statSync(logoPath).isFile()) continue;
        byId.set(name, { id: name, section, dir, pack, logoName });
      } catch {
        /* skip incomplete / unreadable */
      }
    }
  }
  return [...byId.values()];
}

/**
 * Wipe and recopy complete local packs into destRel/<id>/.
 * Default dest is public/brand-overlay (gitignored). Pass
 * `.open-next/assets/brand-overlay` to attach after an OpenNext build
 * without baking NEXT_PUBLIC_* into the client.
 */
export function syncBrandOverlay(
  root: string,
  destRel: string = PUBLIC_OVERLAY_DIR,
): { copied: string[]; dest: string } {
  const dest = path.join(root, destRel);
  fs.rmSync(dest, { recursive: true, force: true });
  const copied: string[] = [];
  for (const pack of listLocalBrandPacks(root)) {
    const out = path.join(dest, pack.id);
    fs.mkdirSync(out, { recursive: true });
    fs.copyFileSync(path.join(pack.dir, "brand.json"), path.join(out, "brand.json"));
    fs.copyFileSync(path.join(pack.dir, pack.logoName), path.join(out, pack.logoName));
    for (const iconName of packIconCandidates(pack.pack)) {
      if (iconName === pack.logoName) continue;
      const iconSrc = path.join(pack.dir, iconName);
      if (!fs.existsSync(iconSrc) || !fs.statSync(iconSrc).isFile()) continue;
      fs.copyFileSync(iconSrc, path.join(out, iconName));
    }
    copied.push(pack.id);
  }
  return { copied, dest };
}

export function syncPublicBrandOverlay(root: string): { copied: string[]; dest: string } {
  return syncBrandOverlay(root, PUBLIC_OVERLAY_DIR);
}
