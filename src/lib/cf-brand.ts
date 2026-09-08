/**
 * Cloudflare-only pack readers. Missing bindings / local Next never throw.
 *
 * - BRAND_PACK R2 (preferred): <id>/brand.json + logo — no NEXT_PUBLIC rebuild
 * - ASSETS: /brand-overlay/<id>/ attached after OpenNext build (attach-brand-assets)
 */
import { Buffer } from "node:buffer";
import { OVERLAY_LOGO_SRC, safeLogoFilename, type BrandPackJson } from "./brand.ts";
import { packIconCandidates } from "./brand-icon.ts";
import { logoContentType, overlayAssetPath } from "./brand-overlay-pack.ts";

export type CfBrandPack = {
  pack: BrandPackJson;
  logoReady: boolean;
  logoSrc: string;
  source: "assets" | "r2";
};

type AssetsBinding = { fetch: (input: Request) => Promise<Response> };
type R2Object = { text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> };
type R2Binding = { get: (key: string) => Promise<R2Object | null> };

export type BrandCfEnv = {
  ASSETS?: AssetsBinding;
  BRAND_PACK?: R2Binding;
};

async function cloudflareEnv(): Promise<BrandCfEnv | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx?.env ?? null) as BrandCfEnv | null;
  } catch {
    return null;
  }
}

const ASSET_ORIGINS = ["https://dummy.internal", "https://assets.local"] as const;

async function assetsFetch(assets: AssetsBinding, pathname: string): Promise<Response | null> {
  for (const origin of ASSET_ORIGINS) {
    try {
      const res = await assets.fetch(new Request(`${origin}${pathname}`));
      if (res.ok) return res;
    } catch {
      /* try the next dummy origin */
    }
  }
  return null;
}

async function readPackFromR2(bucket: R2Binding, id: string): Promise<CfBrandPack | null> {
  const jsonObj = await bucket.get(`${id}/brand.json`);
  if (!jsonObj) return null;
  const pack = JSON.parse(await jsonObj.text()) as BrandPackJson;
  const logoName = safeLogoFilename(pack.logo);
  if (!logoName) return { pack, logoReady: false, logoSrc: OVERLAY_LOGO_SRC, source: "r2" };
  const logoObj = await bucket.get(`${id}/${logoName}`);
  if (!logoObj) return { pack, logoReady: false, logoSrc: OVERLAY_LOGO_SRC, source: "r2" };
  return { pack, logoReady: true, logoSrc: OVERLAY_LOGO_SRC, source: "r2" };
}

async function readPackFromAssets(assets: AssetsBinding, id: string): Promise<CfBrandPack | null> {
  const res = await assetsFetch(assets, overlayAssetPath(id, "brand.json"));
  if (!res) return null;
  const pack = (await res.json()) as BrandPackJson;
  const logoName = safeLogoFilename(pack.logo);
  if (!logoName) return { pack, logoReady: false, logoSrc: OVERLAY_LOGO_SRC, source: "assets" };
  const logoPath = overlayAssetPath(id, logoName);
  const logoRes = await assetsFetch(assets, logoPath);
  if (!logoRes) return { pack, logoReady: false, logoSrc: logoPath, source: "assets" };
  return { pack, logoReady: true, logoSrc: logoPath, source: "assets" };
}

export async function readPackFromCloudflare(
  id: string,
  injected?: BrandCfEnv | null,
): Promise<CfBrandPack | null> {
  const env = injected === undefined ? await cloudflareEnv() : injected;
  if (!env) return null;
  try {
    if (env.BRAND_PACK) {
      const fromR2 = await readPackFromR2(env.BRAND_PACK, id);
      if (fromR2?.logoReady) return fromR2;
    }
  } catch {
    /* fall through to ASSETS */
  }
  try {
    if (env.ASSETS) return await readPackFromAssets(env.ASSETS, id);
  } catch {
    return null;
  }
  return null;
}

export async function readLogoFromCloudflare(
  id: string,
  injected?: BrandCfEnv | null,
): Promise<{ body: Buffer; contentType: string } | null> {
  const env = injected === undefined ? await cloudflareEnv() : injected;
  if (!env) return null;

  if (env.BRAND_PACK) {
    try {
      const jsonObj = await env.BRAND_PACK.get(`${id}/brand.json`);
      if (jsonObj) {
        const pack = JSON.parse(await jsonObj.text()) as BrandPackJson;
        const logoName = safeLogoFilename(pack.logo);
        if (logoName) {
          const logoObj = await env.BRAND_PACK.get(`${id}/${logoName}`);
          if (logoObj) {
            return {
              body: Buffer.from(await logoObj.arrayBuffer()),
              contentType: logoContentType(logoName),
            };
          }
        }
      }
    } catch {
      /* try ASSETS */
    }
  }

  if (!env.ASSETS) return null;
  try {
    const jsonRes = await assetsFetch(env.ASSETS, overlayAssetPath(id, "brand.json"));
    if (!jsonRes) return null;
    const pack = (await jsonRes.json()) as BrandPackJson;
    const logoName = safeLogoFilename(pack.logo);
    if (!logoName) return null;
    const logoRes = await assetsFetch(env.ASSETS, overlayAssetPath(id, logoName));
    if (!logoRes) return null;
    return {
      body: Buffer.from(await logoRes.arrayBuffer()),
      contentType: logoContentType(logoName),
    };
  } catch {
    return null;
  }
}

export async function readIconFromCloudflare(
  id: string,
  injected?: BrandCfEnv | null,
): Promise<{ body: Buffer; contentType: string } | null> {
  const env = injected === undefined ? await cloudflareEnv() : injected;
  if (!env) return null;

  if (env.BRAND_PACK) {
    try {
      const jsonObj = await env.BRAND_PACK.get(`${id}/brand.json`);
      if (jsonObj) {
        const pack = JSON.parse(await jsonObj.text()) as BrandPackJson;
        for (const iconName of packIconCandidates(pack)) {
          const iconObj = await env.BRAND_PACK.get(`${id}/${iconName}`);
          if (iconObj) {
            return {
              body: Buffer.from(await iconObj.arrayBuffer()),
              contentType: logoContentType(iconName),
            };
          }
        }
      }
    } catch {
      /* try ASSETS */
    }
  }

  if (!env.ASSETS) return null;
  try {
    const jsonRes = await assetsFetch(env.ASSETS, overlayAssetPath(id, "brand.json"));
    if (!jsonRes) return null;
    const pack = (await jsonRes.json()) as BrandPackJson;
    for (const iconName of packIconCandidates(pack)) {
      const iconRes = await assetsFetch(env.ASSETS, overlayAssetPath(id, iconName));
      if (!iconRes) continue;
      return {
        body: Buffer.from(await iconRes.arrayBuffer()),
        contentType: logoContentType(iconName),
      };
    }
    return null;
  } catch {
    return null;
  }
}
