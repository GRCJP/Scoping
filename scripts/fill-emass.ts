/**
 * Demo harness: fill eMASS Pre-Assessment + Required-Data + Assessment Results from Harborline (?demo=1) answers.
 *
 * CUI (When Filled In). Box 00 Internal only. Never email the filled xlsx.
 * Production F2 will call fillEmassXlsxPack(answers) and upload those bytes — not the blank.
 *
 *   npm run emass:fill
 *   npm run emass:fill -- --out /tmp/emass-demo
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { harborlineOscAnswers } from "../src/lib/demo-fill.ts";
import { EMASS_XLSX_BOX_NOTE, fillEmassXlsxPack } from "../src/lib/emass-xlsx.ts";

function outDir(argv: string[]): string {
  const i = argv.indexOf("--out");
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
  return path.resolve("tmp/emass-demo");
}

async function main() {
  const dir = outDir(process.argv.slice(2));
  await mkdir(dir, { recursive: true });
  const pack = await fillEmassXlsxPack(harborlineOscAnswers(), undefined, undefined, {
    allowAssessmentResultsStub: true,
  });
  const prePath = path.join(dir, pack.preAssessment.filename);
  const reqPath = path.join(dir, pack.requiredData.filename);
  await writeFile(prePath, pack.preAssessment.buffer);
  await writeFile(reqPath, pack.requiredData.buffer);
  console.log(EMASS_XLSX_BOX_NOTE);
  console.log(`Wrote ${prePath}`);
  console.log(`Wrote ${reqPath}`);
  if (pack.assessmentResults) {
    const resultsPath = path.join(dir, pack.assessmentResults.filename);
    await writeFile(resultsPath, pack.assessmentResults.buffer);
    console.log(`Wrote ${resultsPath}`);
    console.warn(
      "Assessment Results used the mock/dev mapping stub (official CAC blank is not in-repo). Live Box must download CMMC_Level2_AssessmentResults_Template.",
    );
  } else {
    console.warn(pack.assessmentResultsSkipped || "Assessment Results skipped.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
