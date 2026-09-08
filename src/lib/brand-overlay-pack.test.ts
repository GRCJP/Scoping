import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Buffer } from "node:buffer";
import { OVERLAY_LOGO_SRC, SCOPING_DEFAULTS } from "./brand.ts";
import {
  listLocalBrandPacks,
  overlayAssetLogoSrc,
  overlayAssetPath,
  syncBrandOverlay,
  syncPublicBrandOverlay,
} from "./brand-overlay-pack.ts";
import { readPackFromCloudflare, readLogoFromCloudflare, readIconFromCloudflare } from "./cf-brand.ts";
import {
  loadBrand,
  loadBrandSync,
  readOverlayIcon,
  readOverlayIconSync,
  readPackFromPublicOverlay,
} from "./load-brand.ts";

const svg = "<svg xmlns='http://www.w3.org/2000/svg'></svg>";

function writePack(root: string, section: string, id: string, name: string, logo = "logo.svg") {
  const dir = join(root, section, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brand.json"), JSON.stringify({ id, name, shortName: name, logo }));
  writeFileSync(join(dir, logo), svg);
}

describe("syncPublicBrandOverlay", () => {
  it("copies org-logos over brands into public/brand-overlay and wipes stale files", () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-overlay-"));
    try {
      writePack(root, "brands", "acme", "Brands Acme");
      writePack(root, "org-logos", "acme", "Org Acme");
      writePack(root, "org-logos", "globex", "Globex Assessments");

      const first = syncPublicBrandOverlay(root);
      assert.deepEqual(first.copied.sort(), ["acme", "globex"]);
      assert.equal(
        JSON.parse(readFileSync(join(root, "public", "brand-overlay", "acme", "brand.json"), "utf8")).name,
        "Org Acme",
      );
      assert.ok(existsSync(join(root, "public", "brand-overlay", "globex", "logo.svg")));

      const listed = listLocalBrandPacks(root).map((p) => p.id).sort();
      assert.deepEqual(listed, ["acme", "globex"]);

      rmSync(join(root, "org-logos", "globex"), { recursive: true, force: true });
      rmSync(join(root, "org-logos", "acme"), { recursive: true, force: true });
      rmSync(join(root, "brands", "acme"), { recursive: true, force: true });
      const second = syncPublicBrandOverlay(root);
      assert.deepEqual(second.copied, []);
      assert.equal(existsSync(join(root, "public", "brand-overlay", "globex")), false);

      writePack(root, "org-logos", "globex", "Globex Assessments");
      const attached = syncBrandOverlay(root, join(".open-next", "assets", "brand-overlay"));
      assert.deepEqual(attached.copied, ["globex"]);
      assert.ok(existsSync(join(root, ".open-next", "assets", "brand-overlay", "globex", "brand.json")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("copies optional square icon.png next to the logo", () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-overlay-icon-"));
    try {
      writePack(root, "org-logos", "globex", "Globex Assessments");
      writeFileSync(join(root, "org-logos", "globex", "icon.png"), "icon-bytes");
      syncPublicBrandOverlay(root);
      assert.equal(
        readFileSync(join(root, "public", "brand-overlay", "globex", "icon.png"), "utf8"),
        "icon-bytes",
      );
      assert.ok(existsSync(join(root, "public", "brand-overlay", "globex", "logo.svg")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips unsafe ids and path-like logo names", () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-overlay-bad-"));
    try {
      writePack(root, "org-logos", "ok", "Ok");
      const evil = join(root, "org-logos", "..evil");
      mkdirSync(evil, { recursive: true });
      writeFileSync(join(evil, "brand.json"), JSON.stringify({ name: "Nope", logo: "logo.svg" }));
      writeFileSync(join(evil, "logo.svg"), svg);
      const nested = join(root, "org-logos", "acme");
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(nested, "brand.json"), JSON.stringify({ name: "Path", logo: "../logo.svg" }));
      const result = syncPublicBrandOverlay(root);
      assert.deepEqual(result.copied, ["ok"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("loadBrandSync public overlay", () => {
  it("uses public/brand-overlay when BRAND is set and disk packs are absent", () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-overlay-load-"));
    try {
      writePack(root, "org-logos", "globex", "Globex Assessments");
      syncPublicBrandOverlay(root);
      rmSync(join(root, "org-logos", "globex"), { recursive: true, force: true });

      const overlay = readPackFromPublicOverlay(root, "globex");
      assert.equal(overlay?.pack.name, "Globex Assessments");
      assert.equal(overlay?.logoReady, true);

      const branded = loadBrandSync({ BRAND: "globex" }, root);
      assert.equal(branded.displayName, "Globex Assessments");
      assert.equal(branded.overlay, true);
      assert.equal(branded.logoSrc, overlayAssetLogoSrc("globex", "logo.svg"));

      const unset = loadBrandSync({}, root);
      assert.equal(unset.displayName, "Scoping");
      assert.equal(unset.overlay, false);
      assert.equal(unset.logoSrc, SCOPING_DEFAULTS.logoSrc);

      const pathA = loadBrandSync(
        {
          NEXT_PUBLIC_BRAND_NAME: "Globex Assessments",
          NEXT_PUBLIC_BRAND_LOGO: "/brand/globex.png",
        },
        root,
      );
      assert.equal(pathA.displayName, "Globex Assessments");
      assert.equal(pathA.logoSrc, "/brand/globex.png");
      assert.equal(pathA.overlay, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("readOverlayIconSync", () => {
  it("serves pack icon.png, else a generated Globex mark — never the Scoping reticle", () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-icon-load-"));
    try {
      writePack(root, "org-logos", "globex", "Globex Assessments");
      const generated = readOverlayIconSync({ BRAND: "globex" }, root);
      assert.ok(generated);
      assert.equal(generated.contentType, "image/svg+xml");
      assert.match(generated.body.toString(), />Glo</);
      assert.doesNotMatch(generated.body.toString(), /<circle/);

      writeFileSync(join(root, "org-logos", "globex", "icon.png"), "png-icon");
      const file = readOverlayIconSync({ BRAND: "globex" }, root);
      assert.ok(file);
      assert.equal(file.contentType, "image/png");
      assert.equal(file.body.toString(), "png-icon");

      assert.equal(readOverlayIconSync({}, root), null);
      assert.equal(
        readOverlayIconSync({ NEXT_PUBLIC_BRAND_NAME: "Globex Assessments", NEXT_PUBLIC_BRAND_LOGO: "/brand/globex.png" }, root),
        null,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("loadBrand async without Cloudflare", () => {
  it("stays Scoping when BRAND is set but no pack exists", async () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-overlay-empty-"));
    try {
      const resolved = await loadBrand({ BRAND: "globex" }, root);
      assert.equal(resolved.displayName, "Scoping");
      assert.equal(resolved.overlay, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("Cloudflare ASSETS / R2 pack readers", () => {
  it("reads a complete pack from ASSETS and ignores an empty env", async () => {
    assert.equal(await readPackFromCloudflare("globex", null), null);

    const pack = { id: "globex", name: "Globex Assessments", logo: "logo.png" };
    const files = new Map<string, BodyInit>([
      [overlayAssetPath("globex", "brand.json"), JSON.stringify(pack)],
      [overlayAssetPath("globex", "logo.png"), Buffer.from("png")],
    ]);
    const assets = {
      async fetch(input: Request) {
        const path = new URL(input.url).pathname;
        const body = files.get(path);
        if (!body) return new Response(null, { status: 404 });
        return new Response(body, { status: 200 });
      },
    };

    const loaded = await readPackFromCloudflare("globex", { ASSETS: assets });
    assert.equal(loaded?.pack.name, "Globex Assessments");
    assert.equal(loaded?.logoReady, true);
    assert.equal(loaded?.logoSrc, overlayAssetPath("globex", "logo.png"));
    assert.equal(loaded?.source, "assets");

    const logo = await readLogoFromCloudflare("globex", { ASSETS: assets });
    assert.ok(logo);
    assert.equal(logo.contentType, "image/png");
    assert.equal(logo.body.toString(), "png");

    assert.equal(await readIconFromCloudflare("globex", { ASSETS: assets }), null);

    files.set(overlayAssetPath("globex", "icon.png"), Buffer.from("icon-png"));
    const icon = await readIconFromCloudflare("globex", { ASSETS: assets });
    assert.ok(icon);
    assert.equal(icon.contentType, "image/png");
    assert.equal(icon.body.toString(), "icon-png");
  });

  it("prefers R2 when the object store has the pack; logo uses the API route", async () => {
    const objects = new Map<string, string>([
      ["globex/brand.json", JSON.stringify({ id: "globex", name: "Globex Assessments", logo: "logo.svg" })],
      ["globex/logo.svg", svg],
    ]);
    const bucket = {
      async get(key: string) {
        const value = objects.get(key);
        if (value == null) return null;
        return {
          async text() {
            return value;
          },
          async arrayBuffer() {
            const bytes = Buffer.from(value);
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          },
        };
      },
    };
    const loaded = await readPackFromCloudflare("globex", { BRAND_PACK: bucket });
    assert.equal(loaded?.pack.name, "Globex Assessments");
    assert.equal(loaded?.source, "r2");
    assert.equal(loaded?.logoSrc, OVERLAY_LOGO_SRC);

    objects.set("globex/icon.png", "r2-icon");
    const icon = await readIconFromCloudflare("globex", { BRAND_PACK: bucket });
    assert.ok(icon);
    assert.equal(icon.body.toString(), "r2-icon");
  });
});

describe("readOverlayIcon async without Cloudflare", () => {
  it("generates a square mark when the overlay pack has only a wide logo", async () => {
    const root = mkdtempSync(join(tmpdir(), "prescope-icon-async-"));
    try {
      writePack(root, "org-logos", "globex", "Globex Assessments");
      const icon = await readOverlayIcon({ BRAND: "globex" }, root);
      assert.ok(icon);
      assert.equal(icon.contentType, "image/svg+xml");
      assert.match(icon.body.toString(), />Glo</);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
