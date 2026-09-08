# Assessment Results test fixtures

Official CAC / eMASS `CMMC_Level2_AssessmentResults_Template` is **not** committed
(`docs/emass/` stays policy-clean). Live Box must download that blank from
your Templates folder and set `BOX_ASSESSMENT_RESULTS_TEMPLATE_FILE_ID`.

| File | What it is |
|------|------------|
| `assessment-results-official-v39.xlsx` | Minimal **official-like** v3.9 sheet set: Assessment, Requirements, Requirement Objectives, Example, OSC SSP(s), Instructions, Glossary, Version History, Lookup Values. Requirement Objectives headers match the official blank: **H = Overall Comments**, **P = Findings**, plus objective data rows (and a title row that must stay unfilled). Used to prove fill writes cells only, never adds Cover, and prefills H/P on every objective row. |
| `assessment-results-blank.xlsx` | **Stub / bad product output** (Cover, Assessment, Objectives, Record of Assessment, …). Live and container paths must **reject** these bytes — that workbook must not land in Box drops. |

`createAssessmentResultsStubWorkbook()` is a second mock/dev stub (Cover + Assessment Information). It is only built when `allowAssessmentResultsStub: true`.
