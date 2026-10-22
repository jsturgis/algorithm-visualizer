// Terminal output shared by `npm run verify` and `npm run new`.
import type { Check } from "./verify.ts";

export const color = (code: number, s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);

/** Print each check as ✓/✗ with its detail. Returns the number that failed. */
export function printChecks(checks: Check[]): number {
  for (const c of checks) {
    console.log(`  ${c.ok ? color(32, "✓") : color(31, "✗")} ${c.name}${c.detail ? color(2, `\n      ${c.detail}`) : ""}`);
  }
  return checks.filter(c => !c.ok).length;
}
