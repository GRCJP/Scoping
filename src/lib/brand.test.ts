import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  OVERLAY_LOGO_SRC,
  SCOPING_DEFAULTS,
  brandTitle,
  applyBrandPack,
  envBrandBase,
  resolveBrandOverlay,
  safeLogoFilename,
  selectedBrandId,
  type BrandPackJson,
} from "./brand.ts";

function readPackFromRoot(root: string, id: string): { pack: BrandPackJson; logoReady: boolean } | null {
  try {
    const pack = JSON.parse(readFileSync(join(root, "brands", id, "brand.json"), "utf8")) as BrandPackJson;
    const logo = safeLogoFilename(pack.logo);
    if (!logo) return { pack, logoReady: false };
    return { pack, logoReady: existsSync(join(root, "brands", id, logo)) };
  } catch {
    return null;
  }
}

describe("selectedBrandId", () => {
  it("reads BRAND or NEXT_PUBLIC_BRAND", () => {
    assert.equal(selectedBrandId({ BRAND: "acme" }), "acme");
    assert.equal(selectedBrandId({ NEXT_PUBLIC_BRAND: "acme" }), "acme");
    assert.equal(selectedBrandId({ BRAND: "  acme  " }), "acme");
  });

  it("prefers BRAND when both are set", () => {
    assert.equal(selectedBrandId({ BRAND: "acme", NEXT_PUBLIC_BRAND: "other" }), "acme");
  });

  it("returns null when unset, empty, or not a safe folder id", () => {
    assert.equal(selectedBrandId({}), null);
    assert.equal(selectedBrandId({ BRAND: "" }), null);
    assert.equal(selectedBrandId({ BRAND: "../secret" }), null);
    assert.equal(selectedBrandId({ BRAND: "acme/../x" }), null);
    assert.equal(selectedBrandId({ BRAND: "acme/logo.png" }), null);
    assert.equal(selectedBrandId({ BRAND: ".." }), null);
    assert.equal(selectedBrandId({ BRAND: "acme c3pao" }), null);
  });
});

describe("safeLogoFilename", () => {
  it("allows a simple filename and rejects paths", () => {
    assert.equal(safeLogoFilename("logo.png"), "logo.png");
    assert.equal(safeLogoFilename("mark.svg"), "mark.svg");
    assert.equal(safeLogoFilename("../logo.png"), null);
    assert.equal(safeLogoFilename("sub/logo.png"), null);
    assert.equal(safeLogoFilename(""), null);
    assert.equal(safeLogoFilename(null), null);
  });
});

describe("applyBrandPack / resolveBrandOverlay", () => {
  const acmePack = { id: "acme", name: "Acme Assessments", logo: "logo.svg", shortName: "Acme" };

  it("prefers a complete overlay when the pack is present", () => {
    const resolved = resolveBrandOverlay({
      env: { BRAND: "acme" },
      base: { ...SCOPING_DEFAULTS },
      readPack: (id) => (id === "acme" ? { pack: acmePack, logoReady: true } : null),
    });
    assert.equal(resolved.displayName, "Acme Assessments");
    assert.equal(resolved.shortName, "Acme");
    assert.equal(resolved.logoSrc, OVERLAY_LOGO_SRC);
    assert.equal(resolved.overlay, true);
    assert.equal(resolved.productName, SCOPING_DEFAULTS.productName);
  });

  it("honors a pack-supplied logoSrc (Worker ASSETS path)", () => {
    const resolved = resolveBrandOverlay({
      env: { BRAND: "acme" },
      base: { ...SCOPING_DEFAULTS },
      readPack: (id) =>
        id === "acme"
          ? { pack: acmePack, logoReady: true, logoSrc: "/brand-overlay/acme/logo.svg" }
          : null,
    });
    assert.equal(resolved.logoSrc, "/brand-overlay/acme/logo.svg");
    assert.equal(resolved.overlay, true);
  });

  it("falls back to Scoping when the env id is unset", () => {
    const resolved = resolveBrandOverlay({
      env: {},
      base: { ...SCOPING_DEFAULTS },
      readPack: () => {
        throw new Error("must not read a pack when BRAND is unset");
      },
    });
    assert.deepEqual(resolved, SCOPING_DEFAULTS);
  });

  it("falls back when the folder, json, or logo is missing — never throws", () => {
    assert.deepEqual(
      resolveBrandOverlay({
        env: { BRAND: "acme" },
        base: { ...SCOPING_DEFAULTS },
        readPack: () => null,
      }),
      SCOPING_DEFAULTS,
    );
    assert.deepEqual(
      resolveBrandOverlay({
        env: { BRAND: "acme" },
        base: { ...SCOPING_DEFAULTS },
        readPack: () => {
          throw new Error("broken json");
        },
      }),
      SCOPING_DEFAULTS,
    );
    assert.deepEqual(
      applyBrandPack(SCOPING_DEFAULTS, acmePack, { logoReady: false, logoSrc: OVERLAY_LOGO_SRC }),
      SCOPING_DEFAULTS,
    );
    assert.deepEqual(
      applyBrandPack(SCOPING_DEFAULTS, { name: "Acme Assessments" }, { logoReady: true, logoSrc: OVERLAY_LOGO_SRC }),
      SCOPING_DEFAULTS,
    );
  });
});

describe("brandTitle", () => {
  it("is the display name only — no OSC Discovery", () => {
    assert.equal(brandTitle(SCOPING_DEFAULTS), "Scoping");
    assert.ok(!brandTitle(SCOPING_DEFAULTS).includes("OSC Discovery"));
    assert.equal(brandTitle({ ...SCOPING_DEFAULTS, displayName: "Acme Assessments" }), "Acme Assessments");
  });
});

describe("envBrandBase", () => {
  it("keeps Scoping when overlay env vars are absent", () => {
    const base = envBrandBase({});
    assert.equal(base.displayName, "Scoping");
    assert.equal(base.logoSrc, "/brand/mark.svg");
    assert.equal(base.contactMailbox, "assessors@example.com");
    assert.equal(base.overlay, false);
  });

  it("applies Path A NEXT_PUBLIC name and logo when BRAND is unset", () => {
    const base = envBrandBase({
      NEXT_PUBLIC_BRAND_NAME: "Acme Assessments",
      NEXT_PUBLIC_BRAND_LOGO: "/brand/acme.png",
      NEXT_PUBLIC_CONTACT_EMAIL: "hello@example.com",
    });
    assert.equal(base.displayName, "Acme Assessments");
    assert.equal(base.logoSrc, "/brand/acme.png");
    assert.equal(base.contactMailbox, "hello@example.com");
    assert.equal(base.overlay, false);
    assert.equal(base.id, "scoping");
  });
});

describe("disk pack overlay", () => {
  it("prefers brands/<id> when brand.json and logo exist; otherwise Scoping", () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-brand-"));
    try {
      const packDir = join(root, "brands", "acme");
      mkdirSync(packDir, { recursive: true });
      writeFileSync(
        join(packDir, "brand.json"),
        JSON.stringify({ id: "acme", name: "Acme Assessments", logo: "logo.svg" }),
      );
      writeFileSync(join(packDir, "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'></svg>");

      const overlay = resolveBrandOverlay({
        env: { BRAND: "acme" },
        readPack: (id) => readPackFromRoot(root, id),
      });
      assert.equal(overlay.displayName, "Acme Assessments");
      assert.equal(overlay.logoSrc, OVERLAY_LOGO_SRC);
      assert.equal(overlay.overlay, true);

      const missing = resolveBrandOverlay({
        env: { BRAND: "missing" },
        readPack: (id) => readPackFromRoot(root, id),
      });
      assert.equal(missing.displayName, "Scoping");
      assert.equal(missing.overlay, false);

      const unset = resolveBrandOverlay({
        env: {},
        readPack: (id) => readPackFromRoot(root, id),
      });
      assert.equal(unset.displayName, "Scoping");
      assert.equal(unset.logoSrc, "/brand/mark.svg");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
