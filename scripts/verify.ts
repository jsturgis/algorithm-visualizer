// npm run verify [slug...]: check every problem package and write its generated tests to data/secret/ for review.
import path from "node:path";
import { loadPackage, packageDirs } from "../build/package.ts";
import { verifyPackage, writeSecretData } from "../build/verify.ts";

const only = process.argv.slice(2);
const dirs = packageDirs({ templates: true }).filter(d => !only.length || only.includes(path.basename(d)));
const color = (code: number, s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);

let failed = 0;
for (const dir of dirs) {
  console.log(`\n${color(1, path.basename(dir))}`);
  let pkg;
  try { pkg = loadPackage(dir); }
  catch (e) { failed++; console.log(`  ${color(31, "✗")} package loads\n      ${(e as Error).message}`); continue; }
  for (const c of await verifyPackage(pkg)) {
    if (!c.ok) failed++;
    console.log(`  ${c.ok ? color(32, "✓") : color(31, "✗")} ${c.name}${c.detail ? color(2, `\n      ${c.detail}`) : ""}`);
  }
  await writeSecretData(pkg).catch(() => {});
}

console.log(failed ? color(31, `\n${failed} check(s) failed`) : color(32, `\nAll ${dirs.length} packages verified`));
process.exit(failed ? 1 : 0);
