# Power Pages intake

`osc-discovery.html` is the whole public questionnaire as a single Power Pages
web page. Paste it into the Intake page's `.webpage.copy.html` and save.

It exists because Power Pages cannot run the Next.js app — no Node runtime, no
build step. This is a port, not a second product. Orchestration on this host
stays **Power Automate F1–F2b**. The Cloudflare Worker wire is the Next.js
`/intake` path only (`docs/cloudflare/README.md`).

## What owns what

| Concern | Source of truth |
|---|---|
| Look | `docs/design/intake.css` — inlined here **verbatim**, marked do-not-edit |
| Steps and blurbs | `src/lib/path.ts` |
| Beats (intra-step chunks) | `src/lib/beats.ts` |
| Field list, types, conditionals | `src/components/form/IntakeForm.tsx` |
| Validation rules | `src/lib/validate.ts` |
| Columns | `docs/maker/01-dataverse.md` |

When any of those change, re-port. This file does not update itself.

## Switching vendor

The whole brand lives in one block at the top of the script in
`osc-discovery.html`, mirroring `org-logos/<id>/brand.json`:

```js
var BRAND = {
  name: "Scoping",
  logo: "",
  contactEmail: "assessors@example.com"
};
```

1. Upload the client logo under **web-files** (Portal Management > Web Files,
   or the `web-files` folder in the Power Pages VS Code editor).
2. Point `logo` at its partial URL. Set `name`.

`logo: ""` renders a plain wordmark instead. A logo that 404s falls back to
the wordmark too — it never shows a broken image. Same fail-soft behaviour as
`load-brand.ts`, which keeps Scoping when a pack is missing.

Colours and type do not change per client. Navy/gold chrome is the product,
per `docs/design/DESIGN.md` and `brands/README.md`.

## Setup

Portal Management → Site Settings:

```
Webapi/psc_oscdiscovery/enabled      true
Webapi/psc_oscdiscovery/fields       *
Webapi/psc_oscdiscovery_sp/enabled   true
Webapi/psc_oscdiscovery_sp/fields    *
```

Table permissions, web role **Anonymous**: **Create** only on `psc_oscdiscovery`;
**Create** on `psc_oscdiscovery_sp` plus **Append To** the parent. Never grant
Read of OSC answers — an OSC must not enumerate other submissions. The parent
POST uses `Prefer: return=representation` (and reads `OData-EntityId` /
`Location` if the portal still returns minimal) so the id comes back without a GET.

## Known differences from the app

- Provider rows post to `psc_oscdiscovery_sp` after the parent is created,
  bound via `psc_OSCDiscovery@odata.bind`. The parent create sends
  `Prefer: return=representation` so the new row id comes back without a GET.
  A failed child POST is surfaced — do not silently thank-you. Columns match
  `docs/maker/01-dataverse.md` §3 (`psc_name`, `psc_email`, text labels for
  job / service_desc / cui_or_spd / fedramp / offering_name, `psc_yesnona` ints for
  own_cmmc / admin_access / crm_inherited / vendor_srm, `psc_spcmmcstatus` int,
  optional `psc_spsector`). The tenant table
  still has to be created in Maker (GitHub cannot). Harborline `?demo=1` on
  Pages defaults Providers to **No** until those columns exist; encodeProvider
  still posts Yes when selected. The Next.js in-memory harness keeps Yes.
- Conditional reveals use `display`, not `visibility: hidden`. `DESIGN.md`
  specifies the latter so the layout does not jump.
- Fields absent from `beats.ts` (`dba`) are appended to their step's last beat
  rather than dropped. Company address, CISA sector, and employee total sit on
  the one Company beat with HQ/UEI/CAGE. Device classes, CUI-flow essay,
  specialized kinds, and inventory/POA&M essays stay off the OSC form
  (LCCA trim).
- Submit uses `shell.getTokenDeferred` → `withToken(cb)` → fetch header `tok`.
  Do not regress that path (401). Logo is centered in the sticky header
  (`.psc-chrome-row` `justify-content: center`; `padding: 1.5rem 1.5rem 1rem`
  — 24px top / 16px bottom). Do not put N of 8 in the header.
- Submit recovery (not an email-only bug): persist the entire `A` object
  plus `SPS` in `sessionStorage` key `psc:osc-draft`. Submit jumps to
  `firstIncomplete` step+beat and focuses that field — CAGE, MFA, CUI
  host, consent, and email use the same path. After a gap-jump, **Back
  to Review** stays in the footer until the last Review beat; the rail
  Review chip always lands on that last beat (consents + Submit), same
  as Back to Review. Checking the missing consent focuses that control
  and clears the footer “Still required…” note. Next never blocks.
  Officials / provider emails are
  `type=text` `inputmode=email` with a loose `@` + dot-after check.

## Live site must re-paste this HTML

The live Power Pages page may still be an older paste. `psc_sector` is a
Choice (`psc_cisasector`) — POST `100000000+index`, never the label string.
**Re-paste `osc-discovery.html` into the Intake page.** Do not change Choice
columns to Text.

This file maps kit Choice labels to integers (`100000000 + index` in
`docs/maker/01-dataverse.md` order). Pills / single Choice POST a number;
multi-select Choices POST comma-separated integers. A kit label that is
not in the map is omitted and surfaces a submit-time error — never a
guessed int. If a pills field has **no kit Choice set**, POST the label
string or omit — never `100000000+index`. That includes
`psc_cui_backup_where` (text 100; "GCC High" ships as the string) and
provider job / CUI-vs-SPD / FedRAMP. The user-facing stop message does
not fire for backup class. If a 400 remains after the re-paste, the
tenant option values were created differently; do not invent a second
sequence. Do not convert existing Choice columns to Text.

### Already fixed on the way to this

- 401 `90040107` — the template read the anti-forgery token from a hidden input,
  which Power Pages only renders on pages carrying a Dataverse form. Now uses
  `shell.getTokenDeferred()` with fallbacks.
- 404 `9004010C` — missing `Webapi/psc_oscdiscovery/enabled` and `.../fields`
  site settings. Site needs a restart after adding them.
- `Webapi/error/innererror = true` surfaces the real Dataverse message. **Turn it
  off before go-live** — it exposes internals.
