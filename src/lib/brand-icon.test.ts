import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCOPING_DEFAULTS } from "./brand.ts";
import {
  OVERLAY_ICON_SRC,
  PACK_ICON_FILENAMES,
  SCOPING_ICON_SRC,
  overlayIconLabel,
  overlayIconSvg,
  packIconCandidates,
  resolveBrandIcons,
} from "./brand-icon.ts";

describe("resolveBrandIcons", () => {
  it("keeps the committed Scoping reticle when overlay is off", () => {
    const icons = resolveBrandIcons(SCOPING_DEFAULTS);
    assert.deepEqual(icons, { icon: [{ url: SCOPING_ICON_SRC, type: "image/svg+xml" }] });
  });

  it("points at the overlay icon route when a company pack is active", () => {
    const icons = resolveBrandIcons({
      ...SCOPING_DEFAULTS,
      displayName: "Acme Assessments",
      shortName: "Acme",
      overlay: true,
    });
    assert.deepEqual(icons, { icon: [{ url: OVERLAY_ICON_SRC }] });
  });

  it("does not treat Path A name/logo bake as an overlay favicon", () => {
    const icons = resolveBrandIcons({
      ...SCOPING_DEFAULTS,
      displayName: "Acme Assessments",
      logoSrc: "/brand/acme.png",
      overlay: false,
    });
    assert.deepEqual(icons, { icon: [{ url: SCOPING_ICON_SRC, type: "image/svg+xml" }] });
  });
});

describe("packIconCandidates", () => {
  it("prefers brand.json icon when the filename is safe", () => {
    assert.equal(packIconCandidates({ icon: "mark.png" })[0], "mark.png");
    assert.ok(packIconCandidates({ icon: "mark.png" }).includes("icon.png"));
  });

  it("ignores path-like icon names and uses the conventional list", () => {
    assert.deepEqual(packIconCandidates({ icon: "../secret.png" }), [...PACK_ICON_FILENAMES]);
    assert.deepEqual(packIconCandidates({}), [...PACK_ICON_FILENAMES]);
  });
});

describe("overlayIconSvg", () => {
  it("uses shortName when it fits a tab; otherwise a compact name stem", () => {
    assert.equal(overlayIconLabel({ shortName: "Acme", displayName: "Acme Assessments" }), "Acme");
    assert.equal(overlayIconLabel({ shortName: "Acme Assessments", displayName: "Acme Assessments" }), "Acm");
  });

  it("draws a navy square with a silver/gold mark, not the Scoping reticle", () => {
    const svg = overlayIconSvg("Acme");
    assert.match(svg, /fill="#021E47"/);
    assert.match(svg, />Acme</);
    assert.match(svg, /fill="#FBBF24"/);
    assert.doesNotMatch(svg, /<circle/);
    assert.match(overlayIconSvg(`<img src="x">`), /&lt;img/);
  });
});
