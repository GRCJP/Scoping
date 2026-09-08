/**
 * Copy gitignored org-logos/<id>/ (then brands/<id>/) into public/brand-overlay/.
 * OpenNext includes public/ in Worker ASSETS. Run before build / deploy.
 *
 *   npm run prepare-brand
 *
 * Does not git-add anything. public/brand-overlay/ is gitignored.
 */
import { syncPublicBrandOverlay } from "../src/lib/brand-overlay-pack.ts";

const result = syncPublicBrandOverlay(process.cwd());
if (result.copied.length) {
  console.log(`brand overlay: ${result.copied.join(", ")} → public/brand-overlay/ (gitignored, shipped as Worker ASSETS)`);
} else {
  console.log("brand overlay: no local org-logos/ or brands/ pack; intake stays Scoping unless BRAND_PACK R2 is bound");
}
