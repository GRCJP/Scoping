/** Local US-first mailing address parse. No Places API, no network. */

export type ParsedMailingAddress = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type AddressFieldKey = keyof ParsedMailingAddress;

export const ADDRESS_FIELD_KEYS: readonly AddressFieldKey[] = [
  "address1",
  "address2",
  "city",
  "state",
  "zip",
  "country",
];

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  "washington dc": "DC",
  "washington d.c": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "puerto rico": "PR",
  "virgin islands": "VI",
  guam: "GU",
  "american samoa": "AS",
  "northern mariana islands": "MP",
};

const STATE_ABBRS = new Set<string>([
  ...Object.values(STATE_NAME_TO_ABBR),
  "DC",
  "PR",
  "VI",
  "GU",
  "AS",
  "MP",
]);

const STATE_NAMES_LONGEST = Object.keys(STATE_NAME_TO_ABBR).sort((a, b) => b.length - a.length);

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "United States",
  "united states of america": "United States",
  usa: "United States",
  us: "United States",
  "u.s": "United States",
  "u.s.": "United States",
  "u.s.a": "United States",
  "u.s.a.": "United States",
  america: "United States",
  canada: "Canada",
  mexico: "Mexico",
  "united kingdom": "United Kingdom",
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  australia: "Australia",
};

const UNIT_WORD = /^(?:apt|apartment|suite|ste|unit|fl|floor|bldg|building|rm|room|dept|department|#)$/i;
const UNIT_PREFIX =
  /^(?:apt\.?|apartment|suite|ste\.?|unit|fl\.?|floor|bldg\.?|building|rm\.?|room|dept\.?|department|#)\b/i;
const ZIP_RE = /^(\d{5})(?:[-\s](\d{4}))?$/;
const PHONE_LINE = /^(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}$/;
const URL_LINE = /^(?:https?:\/\/|www\.)/i;
const STREET_START = /^(?:\d+|p\.?\s*o\.?\s*box\b|po\s*box\b|rr\b|rural\s+route\b)/i;

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function countryKey(s: string): string {
  return s.trim().toLowerCase().replace(/\.+$/g, "");
}

export function countryFromToken(s: string): string | null {
  const raw = s.trim();
  if (!raw) return null;
  const exact = COUNTRY_ALIASES[raw.toLowerCase()];
  if (exact) return exact;
  const stripped = COUNTRY_ALIASES[countryKey(raw)];
  return stripped ?? null;
}

export function stateFromToken(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (t.length === 2 && STATE_ABBRS.has(t.toUpperCase())) return t.toUpperCase();
  const key = t.toLowerCase().replace(/\./g, "");
  return STATE_NAME_TO_ABBR[key] ?? STATE_NAME_TO_ABBR[t.toLowerCase()] ?? null;
}

function zipFromToken(s: string): string | null {
  const m = s.trim().match(ZIP_RE);
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2]}` : m[1];
}

/** Light international postal codes (e.g. SW1A 2AA). Not a street or unit. */
function postalFromToken(s: string): string | null {
  const us = zipFromToken(s);
  if (us) return us;
  const t = s.trim();
  if (looksLikeUnit(t) || STREET_START.test(t)) return null;
  if (/^[A-Z0-9][A-Z0-9 -]{1,10}$/i.test(t) && /\d/.test(t) && /[A-Za-z]/.test(t)) return t;
  return null;
}

function isPhoneLine(s: string): boolean {
  const t = s.trim();
  if (PHONE_LINE.test(t)) return true;
  const compact = t.replace(/[^\d+]/g, "");
  return /^\+?1?\d{10}$/.test(compact) && !/[a-z]/i.test(t);
}

function isIgnorableLine(s: string): boolean {
  return !s || URL_LINE.test(s) || isPhoneLine(s);
}

function looksLikeUnit(s: string): boolean {
  const t = s.trim();
  return UNIT_PREFIX.test(t) || /^#\s*\w+/.test(t);
}

/** Split "18 Thames St Suite 12" into line 1 / line 2. */
export function splitStreetAndUnit(street: string): { address1: string; address2: string } {
  const trimmed = street.trim();
  if (!trimmed) return { address1: "", address2: "" };
  const inline = trimmed.match(
    /^(.*?)\s+((?:apt\.?|apartment|suite|ste\.?|unit|fl\.?|floor|bldg\.?|building|#)\s*[\w.#/-]+)$/i,
  );
  if (inline && STREET_START.test(inline[1].trim())) {
    return { address1: inline[1].trim(), address2: inline[2].trim() };
  }
  return { address1: trimmed, address2: "" };
}

function peelZipAndState(token: string): string[] {
  let rest = norm(token);
  const tail: string[] = [];

  const zipMatch = rest.match(/^(.*?)\s+(\d{5}(?:[-\s]\d{4})?)$/);
  if (zipMatch) {
    tail.unshift(zipMatch[2]);
    rest = zipMatch[1];
  }

  const abbr = rest.match(/^(.*?)\s+([A-Za-z]{2})$/);
  if (abbr && stateFromToken(abbr[2])) {
    tail.unshift(abbr[2].toUpperCase());
    rest = abbr[1];
    return rest ? [rest, ...tail] : tail;
  }

  const lower = rest.toLowerCase();
  for (const name of STATE_NAMES_LONGEST) {
    // Only collapse a bare state name when this token also carried a ZIP
    // ("Rhode Island 02840"). Leave "Washington" alone — it is a city before DC.
    if (zipMatch && lower === name) {
      tail.unshift(STATE_NAME_TO_ABBR[name]);
      return tail;
    }
    if (lower.endsWith(` ${name}`)) {
      tail.unshift(STATE_NAME_TO_ABBR[name]);
      const head = rest.slice(0, rest.length - name.length).trim();
      return head ? [head, ...tail] : tail;
    }
  }

  return rest ? [rest, ...tail] : tail;
}

function peelCityFromStreetBlob(blob: string): { street: string; city: string } {
  const words = blob.split(/\s+/).filter(Boolean);
  if (words.length < 3) return { street: blob, city: "" };
  const last = words[words.length - 1];
  if (UNIT_WORD.test(last) || /^\d+[A-Za-z]?$/.test(last) || looksLikeUnit(last)) {
    return { street: blob, city: "" };
  }
  return { street: words.slice(0, -1).join(" "), city: last };
}

export function parseUsMailingAddress(
  raw: string,
  opts?: { defaultCountry?: string },
): ParsedMailingAddress | null {
  const defaultCountry = opts?.defaultCountry ?? "";
  if (!raw || !raw.trim()) return null;

  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(norm)
    .filter((line) => !isIgnorableLine(line));

  if (!lines.length) return null;

  const hasLaterStreet = lines.some((line, i) => i > 0 && STREET_START.test(line));
  if (lines.length >= 2 && !STREET_START.test(lines[0]) && !looksLikeUnit(lines[0]) && hasLaterStreet) {
    lines.shift();
  }

  let tokens = lines
    .flatMap((line) => line.split(/[,·|]/).map(norm).filter(Boolean))
    .flatMap(peelZipAndState);

  if (!tokens.length) return null;

  let country = "";
  const lastCountry = countryFromToken(tokens[tokens.length - 1]);
  if (lastCountry) {
    country = lastCountry;
    tokens.pop();
  }

  let zip = "";
  if (tokens.length) {
    const z = postalFromToken(tokens[tokens.length - 1]);
    if (z) {
      zip = z;
      tokens.pop();
    }
  }

  let state = "";
  if (tokens.length) {
    const st = stateFromToken(tokens[tokens.length - 1]);
    if (st) {
      state = st;
      tokens.pop();
    }
  }

  let city = "";
  if (tokens.length >= 2) {
    const maybeCity = tokens[tokens.length - 1];
    if (!looksLikeUnit(maybeCity) && !STREET_START.test(maybeCity)) {
      city = tokens.pop() ?? "";
    }
  } else if (tokens.length === 1 && (state || zip) && !STREET_START.test(tokens[0]) && !looksLikeUnit(tokens[0])) {
    city = tokens.pop() ?? "";
  }

  let address1 = "";
  let address2 = "";

  if (tokens.length >= 2 && looksLikeUnit(tokens[tokens.length - 1])) {
    address2 = tokens.pop() ?? "";
    address1 = tokens.join(", ");
  } else if (tokens.length >= 3 && UNIT_WORD.test(tokens[tokens.length - 2])) {
    const num = tokens.pop() ?? "";
    const word = tokens.pop() ?? "";
    address2 = `${word} ${num}`.trim();
    address1 = tokens.join(", ");
  } else if (tokens.length === 1 && (state || zip) && STREET_START.test(tokens[0]) && !city) {
    const peeled = peelCityFromStreetBlob(tokens[0]);
    city = peeled.city;
    const split = splitStreetAndUnit(peeled.street);
    address1 = split.address1;
    address2 = split.address2;
  } else if (tokens.length) {
    const joined = tokens.length === 1 ? tokens[0] : tokens.join(" ");
    const split = splitStreetAndUnit(joined);
    address1 = split.address1;
    address2 = split.address2;
  }

  if (!address1 && !city && !state && !zip) return null;
  const confident = Boolean((state || zip) && (address1 || city)) || Boolean(address1 && city);
  if (!confident) return null;

  return {
    address1,
    address2,
    city,
    state,
    zip,
    country: country || defaultCountry,
  };
}

export function applyParsedAddress(
  current: ParsedMailingAddress,
  parsed: ParsedMailingAddress,
): ParsedMailingAddress {
  return {
    address1: parsed.address1,
    address2: parsed.address2,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    country: parsed.country.trim() || current.country || "United States",
  };
}

export function hasStructuredAddress(a: ParsedMailingAddress): boolean {
  return Boolean(a.address1.trim() || a.address2.trim() || a.city.trim() || a.state.trim() || a.zip.trim());
}

export function formatAddressSummary(a: ParsedMailingAddress): string {
  const parts = [a.address1, a.address2, a.city].map((x) => x.trim()).filter(Boolean);
  const stateZip = [a.state, a.zip].map((x) => x.trim()).filter(Boolean).join(" ");
  const line = [...parts, stateZip].filter(Boolean).join(", ");
  const country = a.country.trim();
  if (country && country !== "United States") {
    return line ? `${line}, ${country}` : country;
  }
  return line;
}
