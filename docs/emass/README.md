# eMASS blank templates (v3.9)

UNCLASSIFIED blanks from eMASS. Filled outputs are **CUI (When Filled In)** — Box `00 Internal` only. **Never email the filled xlsx.**

- `CMMC-L2-Pre-Assessment-Form-v3.9.xlsx` — full Pre-Assessment
- `Required-Data-OSC.xlsx` — OSC subset of the same fields
- `CMMC_Level2_AssessmentResults_Template.xlsx` — expected **Box TEMPLATE filename** only. Official CAC / eMASS blank is **not** committed (gitignored). A file at this path has been the **Cover stub** (same sheets as Harborline/Meridian filled AR). Live must not treat that file as official. Official v3.9 tabs: **Assessment, Requirements, Requirement Objectives, Example, OSC SSP(s), Instructions, Glossary, Version History, Lookup Values** (no Cover). Set `BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID` to the official ~163KB blank in your Templates folder. Empty file id + folder name-match of a Cover stub is rejected. Fill writes cells only. Mock/dev may still use `allowAssessmentResultsStub`.

## After Submit → Box

1. OSC submits Discovery answers.
2. Code fills these templates from answers (`src/lib/emass-xlsx.ts` → `fillEmassXlsxPack` — three workbooks).
3. **Those filled files** are what go to the Track B Box drop (or Track A `00 Internal`) — not the blanks.

The Cloudflare Worker (`workers/prescope-submit/`) calls the same fill and uploads the filled bytes to Box `00 Internal`. This repo does not email the xlsx. See `docs/cloudflare/README.md`.

## Run on demo answers now

```
npm run emass:fill
```

Writes Harborline (`?demo=1`) filled workbooks under `tmp/emass-demo/`. Assessor demo route: `GET /api/assessor/emass?demo=1` (assessor-gated).

## Exporter rules

C3PAO-only cells stay blank (contract date, planning dates, assessment standard, fee, C3PAO UID/name, lead assessor, team, **and on Assessment Results: Score, MET/NOT MET, hash, CPN, CMMC UID, assessment dates**). Requirement Objectives **Overall Comments (H)** and **Findings (P)** get the same assessor boilerplate on every objective/control data row — not per-control scores. Address Line 3 and Sector (Other) stay blank — do not put free-text there. Country defaults to United States when empty.

Box TEMPLATE lookup names for Assessment Results: `CMMC_Level2_AssessmentResults_Template.xlsx` or `CMMC_Level2_AssessmentResults_Template`.

CMMC Status and sector label translation lives in `src/lib/emass.ts` (`translateCmmcStatus`, `translateSector`). Do not change OSC questions. Do not convert Dataverse Choice → Text. ESP sheet is filled only when providers is Yes.

Keep the banner `***** CUI (When Filled In) *****`. Do not delete sheets or columns.
