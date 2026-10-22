// npm run verify [slug...]: check every problem package and write its generated tests to data/secret/ for review.
import path from "node:path";
import { loadPackage, packageDirs } from "../build/package.ts";
import { color, printChecks } from "../build/report.ts";
import { verifyPackage, writeSecretData } from "../build/verify.ts";

const only = process.argv.slice(2);
const dirs = packageDirs({ templates: true }).filter(d => !only.length || only.includes(path.basename(d)));

let failed = 0;
for (const dir of dirs) {
  console.log(`\n${color(1, path.basename(dir))}`);
  let pkg;
  try { pkg = loadPackage(dir); }
  catch (e) { failed++; console.log(`  ${color(31, "✗")} package loads\n      ${(e as Error).message}`); continue; }
  failed += printChecks(await verifyPackage(pkg));
  await writeSecretData(pkg).catch(() => {});
}

console.log(failed ? color(31, `\n${failed} check(s) failed`) : color(32, `\nAll ${dirs.length} packages verified`));
process.exit(failed ? 1 : 0);
