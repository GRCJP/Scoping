/**
 * Node resolves `import "exceljs"` from src/lib/emass-xlsx.ts against the
 * repo root, not this Worker package. Prefer the Worker node_modules, then root.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fromWorker = join(here, "..", "package.json");
const fromRepo = join(here, "..", "..", "..", "package.json");

function resolveExceljs(fromPkg) {
  try {
    return createRequire(fromPkg).resolve("exceljs");
  } catch {
    return null;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "exceljs") {
    const resolved = resolveExceljs(fromWorker) || resolveExceljs(fromRepo);
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
