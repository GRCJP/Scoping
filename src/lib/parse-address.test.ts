import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { patchAnswersMany } from "./answers.ts";
import { beatsForStep } from "./beats.ts";
import { harborlineOscAnswers } from "./demo-fill.ts";
import {
  ADDRESS_FIELD_KEYS,
  applyParsedAddress,
  formatAddressSummary,
  hasStructuredAddress,
  parseUsMailingAddress,
} from "./parse-address.ts";
import { stepsForPath } from "./path.ts";
import { emptyAnswers } from "./types.ts";
import { firstIncompleteGap, validateStep } from "./validate.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function parsed(
  address1: string,
  address2: string,
  city: string,
  state: string,
  zip: string,
  country = "United States",
) {
  return { address1, address2, city, state, zip, country };
}

describe("parseUsMailingAddress", () => {
  it("breaks out Harborline multiline (demo fill)", () => {
    const got = parseUsMailingAddress(
      `18 Thames St
Suite 12
Newport, RI 02840
United States`,
    );
    assert.deepEqual(got, parsed("18 Thames St", "Suite 12", "Newport", "RI", "02840"));
  });

  it("breaks out a single comma line", () => {
    const got = parseUsMailingAddress("18 Thames St, Suite 12, Newport, RI 02840");
    assert.deepEqual(got, parsed("18 Thames St", "Suite 12", "Newport", "RI", "02840", ""));
  });

  it("accepts suite on the street line and ZIP+4", () => {
    const got = parseUsMailingAddress("410 Narragansett Ave Suite 12, Warwick, RI 02888-1234");
    assert.deepEqual(got, parsed("410 Narragansett Ave", "Suite 12", "Warwick", "RI", "02888-1234", ""));
  });

  it("accepts a full state name and extra commas", () => {
    const got = parseUsMailingAddress("90 Doremus Ave,, Newark,, New Jersey, 07105,");
    assert.deepEqual(got, parsed("90 Doremus Ave", "", "Newark", "NJ", "07105", ""));
  });

  it("maps USA / US to United States and leaves country empty when absent", () => {
    const usa = parseUsMailingAddress("18 Thames St, Newport, RI 02840, USA");
    assert.equal(usa?.country, "United States");
    const bare = parseUsMailingAddress("18 Thames St\nNewport, RI 02840");
    assert.equal(bare?.country, "");
    const withDefault = parseUsMailingAddress("18 Thames St\nNewport, RI 02840", {
      defaultCountry: "United States",
    });
    assert.equal(withDefault?.country, "United States");
  });

  it("keeps a non-US country when present", () => {
    const got = parseUsMailingAddress("18 Thames St, Newport, RI 02840, Canada");
    assert.equal(got?.country, "Canada");
  });

  it("tolerates a simple UK-style paste", () => {
    const got = parseUsMailingAddress("10 Downing Street\nLondon\nSW1A 2AA\nUnited Kingdom");
    assert.equal(got?.address1, "10 Downing Street");
    assert.equal(got?.city, "London");
    assert.equal(got?.zip, "SW1A 2AA");
    assert.equal(got?.country, "United Kingdom");
  });

  it("parses a space-separated one-liner", () => {
    const got = parseUsMailingAddress("18 Thames St Suite 12 Newport RI 02840");
    assert.deepEqual(got, parsed("18 Thames St", "Suite 12", "Newport", "RI", "02840", ""));
  });

  it("parses PO Box, DC, and Washington the state", () => {
    const box = parseUsMailingAddress("PO Box 123\nNewport, RI 02840");
    assert.deepEqual(box, parsed("PO Box 123", "", "Newport", "RI", "02840", ""));
    const dc = parseUsMailingAddress("1600 Pennsylvania Avenue NW, Washington, DC 20500");
    assert.deepEqual(dc, parsed("1600 Pennsylvania Avenue NW", "", "Washington", "DC", "20500", ""));
    const wa = parseUsMailingAddress("500 Yesler Way, Seattle, Washington 98104");
    assert.deepEqual(wa, parsed("500 Yesler Way", "", "Seattle", "WA", "98104", ""));
  });

  it("ignores phone and website lines and a leading company name", () => {
    const got = parseUsMailingAddress(
      `Harborline Precision
18 Thames St
Suite 12
Newport, RI 02840
401-555-0188
https://harborline.example`,
    );
    assert.deepEqual(got, parsed("18 Thames St", "Suite 12", "Newport", "RI", "02840", ""));
  });

  it("returns null for empty or non-address text", () => {
    assert.equal(parseUsMailingAddress(""), null);
    assert.equal(parseUsMailingAddress("   \n  "), null);
    assert.equal(parseUsMailingAddress("hello there"), null);
  });

  it("round-trips a formatted Harborline summary", () => {
    const first = parseUsMailingAddress("18 Thames St, Suite 12, Newport, RI 02840, United States");
    assert.ok(first);
    const summary = formatAddressSummary(first);
    assert.equal(summary, "18 Thames St, Suite 12, Newport, RI 02840");
    const again = parseUsMailingAddress(summary, { defaultCountry: first.country });
    assert.deepEqual(again, first);
  });
});

describe("applyParsedAddress / form keys", () => {
  it("writes only the six address keys and leaves phone and website alone", () => {
    const start = emptyAnswers();
    start.businessphone = "401-555-0188";
    start.website = "https://harborline.example";
    start.country = "United States";
    const parsedAddr = parseUsMailingAddress("18 Thames St\nSuite 12\nNewport, RI 02840");
    assert.ok(parsedAddr);
    const next = patchAnswersMany(start, applyParsedAddress(start, parsedAddr));
    assert.equal(next.address1, "18 Thames St");
    assert.equal(next.address2, "Suite 12");
    assert.equal(next.city, "Newport");
    assert.equal(next.state, "RI");
    assert.equal(next.zip, "02840");
    assert.equal(next.country, "United States");
    assert.equal(next.businessphone, "401-555-0188");
    assert.equal(next.website, "https://harborline.example");
    assert.equal("address3" in next, false);
    assert.deepEqual([...ADDRESS_FIELD_KEYS], ["address1", "address2", "city", "state", "zip", "country"]);
  });

  it("does not wipe structured fields when paste is empty", () => {
    const demo = harborlineOscAnswers();
    assert.equal(parseUsMailingAddress("   "), null);
    assert.equal(hasStructuredAddress(demo), true);
    assert.equal(demo.address1, "18 Thames St");
    assert.equal(demo.country, "United States");
  });

  it("keeps Harborline demo valid and fills the same keys from a paste", () => {
    const demo = harborlineOscAnswers();
    assert.equal(firstIncompleteGap(demo, "standard", stepsForPath("standard"), beatsForStep), null);
    const blank = {
      ...emptyAnswers(),
      hqname: demo.hqname,
      uei: demo.uei,
      oscname: demo.oscname,
      sector: demo.sector,
      cui_users: demo.cui_users,
      hlocage: demo.hlocage,
      cageinscope: demo.cageinscope,
      scopemode: demo.scopemode,
      scopedesc: demo.scopedesc,
    };
    assert.ok(validateStep("P1", blank, "standard").address1);
    const parsedAddr = parseUsMailingAddress(`18 Thames St
Suite 12
Newport, RI 02840
United States`);
    assert.ok(parsedAddr);
    const filled = patchAnswersMany(blank, applyParsedAddress(blank, parsedAddr));
    const errs = validateStep("P1", filled, "standard");
    assert.equal(errs.address1, undefined);
    assert.equal(errs.city, undefined);
    assert.equal(errs.state, undefined);
    assert.equal(errs.country, undefined);
    assert.equal(filled.address1, demo.address1);
    assert.equal(filled.address2, demo.address2);
    assert.equal(filled.city, demo.city);
    assert.equal(filled.state, demo.state);
    assert.equal(filled.zip, demo.zip);
    assert.equal(filled.country, demo.country);
  });

  it("manual field edits still flow through patchAnswersMany", () => {
    const start = harborlineOscAnswers();
    const edited = patchAnswersMany(start, { city: "Warwick", zip: "02888" });
    assert.equal(edited.address1, "18 Thames St");
    assert.equal(edited.city, "Warwick");
    assert.equal(edited.zip, "02888");
    assert.equal(edited.businessphone, start.businessphone);
    assert.equal(validateStep("P1", edited, "standard").city, undefined);
  });
});

describe("intake wiring (source regression)", () => {
  it("keeps Company address keys and leaves phone/website outside the parser", () => {
    const form = src("components/form/IntakeForm.tsx");
    const address = src("components/form/AddressIntake.tsx");
    const parser = src("lib/parse-address.ts");
    assert.ok(form.includes("AddressIntake"));
    assert.ok(form.includes('label="Address"'));
    assert.ok(form.includes('label="Business phone"'));
    assert.ok(form.includes('label="Website"'));
    assert.ok(address.includes("Paste address"));
    assert.ok(address.includes("Paste or type the full mailing address"));
    assert.ok(address.includes("Address line 1"));
    assert.ok(address.includes("Address line 2"));
    assert.ok(address.includes('fieldKey="address1"'));
    assert.ok(address.includes('fieldKey="address2"'));
    assert.ok(address.includes('fieldKey="city"'));
    assert.ok(address.includes('fieldKey="state"'));
    assert.ok(address.includes('fieldKey="zip"'));
    assert.ok(address.includes('fieldKey="country"'));
    assert.equal(address.includes("address3"), false);
    assert.equal(address.includes("businessphone"), false);
    assert.equal(parser.includes("googleapis"), false);
    assert.equal(parser.includes("fetch("), false);
    assert.ok(parser.includes("No Places API"));
  });
});
