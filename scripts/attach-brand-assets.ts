/**
 * Copy gitignored org-logos/<id>/ into .open-next/assets/brand-overlay/.
 * Includes brand.json, logo, and optional square icon.png / favicon.png.
 * Run after `npx opennextjs-cloudflare build`, before deploy.
 * Does not run `next build` and does not set NEXT_PUBLIC_*.
 *
 *   npm run attach-brand-assets
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { OVERLAY_ASSET_DIR, syncBrandOverlay } from "../src/lib/brand-overlay-pack.ts";

const root = process.cwd();
const assetsRoot = path.join(root, ".open-next", "assets");
if (!existsSync(assetsRoot)) {
  console.error("attach-brand-assets: .open-next/assets missing. Run `npx opennextjs-cloudflare build` first.");
  process.exit(1);
}

const result = syncBrandOverlay(root, path.join(".open-next", "assets", OVERLAY_ASSET_DIR));
if (result.copied.length) {
  console.log(`brand ASSETS: ${result.copied.join(", ")} → .open-next/assets/brand-overlay/ (not in git)`);
} else {
  console.log("brand ASSETS: no local org-logos/ or brands/ pack; set BRAND_PACK R2 or leave Scoping");
}
