import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  OVERLAY_LOGO_SRC,
  resolveBrandOverlay,
  safeLogoFilename,
  type BrandPackJson,
} from "./brand.ts";

const svg = "<svg xmlns='http://www.w3.org/2000/svg'></svg>";

function writePack(root: string, section: string, id: string, name: string) {
  const dir = join(root, section, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brand.json"), JSON.stringify({ id, name, logo: "logo.svg" }));
  writeFileSync(join(dir, "logo.svg"), svg);
}

/** Same order as load-brand.ts: org-logos first, then brands. */
function readPackFromRoot(root: string, id: string): { pack: BrandPackJson; logoReady: boolean } | null {
  for (const section of ["org-logos", "brands"]) {
    try {
      const pack = JSON.parse(readFileSync(join(root, section, id, "brand.json"), "utf8")) as BrandPackJson;
      const logo = safeLogoFilename(pack.logo);
      const logoReady = Boolean(logo && existsSync(join(root, section, id, logo as string)));
      if (logoReady) return { pack, logoReady };
    } catch {
      /* try next section */
    }
  }
  return null;
}

describe("org-logos vs brands pack order", () => {
  it("prefers org-logos over brands, then Scoping", () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-pack-"));
    try {
      writePack(root, "brands", "acme", "Brands Acme");
      writePack(root, "org-logos", "acme", "Org Acme");

      const overlay = resolveBrandOverlay({
        env: { BRAND: "acme" },
        readPack: (id) => readPackFromRoot(root, id),
      });
      assert.equal(overlay.displayName, "Org Acme");
      assert.equal(overlay.logoSrc, OVERLAY_LOGO_SRC);

      const brandsOnly = mkdtempSync(join(tmpdir(), "prescope-pack-fb-"));
      try {
        writePack(brandsOnly, "brands", "acme", "Brands Only");
        const fb = resolveBrandOverlay({
          env: { BRAND: "acme" },
          readPack: (id) => readPackFromRoot(brandsOnly, id),
        });
        assert.equal(fb.displayName, "Brands Only");
      } finally {
        rmSync(brandsOnly, { recursive: true, force: true });
      }

      const missing = resolveBrandOverlay({
        env: { BRAND: "nope" },
        readPack: (id) => readPackFromRoot(root, id),
      });
      assert.equal(missing.displayName, "Scoping");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
