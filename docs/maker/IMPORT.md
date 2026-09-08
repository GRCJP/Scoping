# Import OSC Discovery (unmanaged)

File: [`psc_OSCDiscovery_unmanaged.zip`](psc_OSCDiscovery_unmanaged.zip) — **version 1.0.0.1**

Unmanaged solution. Publisher display name **Acme Assessments / Scoping**, unique name **`_acme`** (must start with a letter or `_`; a leading digit is rejected by Dataverse), prefix **`psc`**. Tables: **OSC Discovery** (`psc_oscdiscovery`) and **OSC Discovery provider** (`psc_oscdiscovery_sp`, 1:N). All global choices and columns from `01-dataverse.md`. No CUID, SPRS score, or CUI excerpt columns. `pac` was not available on the machine that built this zip — it is a packed Dataverse solution (`solution.xml` + `customizations.xml` + `[Content_Types].xml`) authored to match a real Microsoft unmanaged export.

Static checks on this zip: well-formed XML (`xmllint` + Python), publisher unique name starts with `_`, schema names `[A-Za-z][A-Za-z0-9_]*`, LocalizedName / displayname languagecode **1033** on entities, attributes, and optionsets, option values in prefix range `100000000–100009999`, string `DefaultValue` SQL-quoted. **Not proven against a live Dataverse import** — there is no environment access from the build machine.

## 2026-08-29 import failure 1 (publisher unique name)

Log: `OSC Discovery_import (1).xml`. **Status: Failure** at 19.44% after 2.3s. Tables and choices were **Unprocessed**.

- **ErrorCode:** `0x8004F01C`
- **Message:** `Solution manifest import: FAILURE: Invalid character specified for publisher unique name: 9acme. Only characters within the ranges [A-Z], [a-z] or [0-9] or _ are allowed.  The first character may only be in the ranges [A-Z], [a-z] or _.`

Fix: publisher unique name must start with a letter or `_` (example `_acme`). Confirmed accepted on the second import.

## 2026-08-29 import failure 2 (SQL default on Country)

Log: `OSC Discovery_import (2).xml`. **Status: Failure** at **91.84%** after 43s. This was **not** a first-manifest check and **not** a leftover-table collision.

### Every error / warning in that log

**Solution-level (only failure):**

- **Status:** Failure
- **ErrorCode:** *(empty — no hex code)*
- **Message:** `Import failed: The name "United" is not permitted in this context. Valid expressions are constants, constant expressions, and (in some contexts) variables. Column names are not permitted.`

That message is repeated once on the Solution row. No other component has an ErrorCode or ErrorText.

**Not errors — Processed:** XSDValidationHandler; all 21 global choices (`psc_yesnodk` … `psc_redflag`); both entities (`psc_oscdiscovery`, `psc_oscdiscovery_sp`); system views; entity relationships; forms; messages; ribbons; charts.

**Unprocessed** (stopped after the SQL failure): Root Components Insertion, Dependencies Calculation.

**Publisher in the log:** Name `_acme` — accepted.

### Root cause

`DefaultValue` on a text column is a **SQL default expression**, not a display string. The zip had:

```xml
<DefaultValue>United States</DefaultValue>   <!-- psc_country -->
<DefaultValue>Box</DefaultValue>             <!-- psc_evidence_share; would have been the next identical failure -->
```

SQL Server treated `United` as a column name. Same class of error as `DEFAULT United States` without quotes.

### Fixes in 1.0.0.1

- `psc_country` default is now `'United States'` (SQL string literal).
- `psc_evidence_share` default is now `'Box'`.
- Solution version **1.0.0.1** so this is a distinct unmanaged package from the failed 1.0.0.0.

## Click Import (retry 1.0.0.1)

The second import **created** the `psc_*` choices and both tables. Re-import updates them. Do **not** delete `psc_oscdiscovery` / `psc_oscdiscovery_sp` from that pass.

1. Open [make.powerapps.com](https://make.powerapps.com).
2. Switch to the **123 Efficient CMMC LLC Dev** environment (top right). Do not import into Default or production.
3. **Tables** → look at every table whose **display** name is OSC Discovery (or OSC Discovery provider). Open **Properties** / the logical name:
   - **Keep** `psc_oscdiscovery` and `psc_oscdiscovery_sp` (created by the second zip).
   - **Delete only** a leftover **empty** table you made by hand whose logical name is **not** `psc_oscdiscovery` / `psc_oscdiscovery_sp`. That leftover was **not** the cause of the `"United"` error. If none exists, skip this step.
4. Left nav → **Solutions** → **Import solution** → **Browse** → select the rebuilt `docs/maker/psc_OSCDiscovery_unmanaged.zip` (version **1.0.0.1**, not the old download).
5. Leave settings as-is (unmanaged). Do not convert to managed.
6. **Import**. Wait until it finishes (should pass 91% this time). Then **Publish all customizations**.
7. **Tables** → **OSC Discovery**. Confirm columns exist (including lock-off system/SCOPE/Box columns). Confirm **Country** default is United States and **Evidence share** default is Box. Confirm the related **OSC Discovery provider** table and the lookup to OSC Discovery.
8. **Evidence share** (`psc_evidence_share`) is a system column. It is not a customer question. Leave it off the Power Pages form. If the default did not land, set Default value to `Box` on that column only.
9. **Orchestration status** default is **Submitted**.

Import as-is. If this environment already has a different default publisher, new *maker-created* columns later may get a `crXX` prefix. Schema names in this zip are already `psc_*` — do not recreate the tables by hand to “fix” the prefix.

## If import fails

Copy the import error (Solutions → the failed import → **See history** / download log).

Common fixes:

- Environment is not a Dataverse environment, or you are not a System Customizer / System Administrator there.
- A table or choice named `psc_oscdiscovery` / `psc_yesnodk` / etc. already exists from a half-built maker pass **with a conflicting schema**. Unmanaged re-import of this zip should update `psc_*` components. Only delete a leftover if the log names a collision and the leftover logical name is not `psc_*`.
- Publisher unique name `_acme` already exists with a different prefix. Import still as-is first. Only if the log says the publisher conflicts, ask an admin whether that publisher can stay; do not invent a new table. Do not change the unique name to one that starts with a digit (that is `0x8004F01C`).

Faster fallback if the zip is rejected:

1. Install [Power Platform CLI](https://aka.ms/PowerPlatformCLI) (`pac`), then `pac auth create` against this Dev environment and `pac solution import --path docs/maker/psc_OSCDiscovery_unmanaged.zip`. Same zip; better error text.
2. Or in the tenant, paste `01-dataverse.md` into Copilot / an in-tenant agent with: create **only** these global choices and **OSC Discovery** + **OSC Discovery provider**. Do **not** create OSC Device, CUID, SPRS, or anything from `scoping-field-map.md`.

Power Pages (step 3 in `00-walkthrough.md`) still comes after the tables exist. This zip only avoids clicking ~80 Dataverse columns.
