// npm run new [-- options]: a wizard that creates problems/<slug>/ from a problem's contract, optionally starting from
// a LeetCode problem, then verifies the new package and lists what's left to write.
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { fetchLeetCode } from "../build/leetcode.ts";
import { loadPackage, PROBLEMS, ROOT } from "../build/package.ts";
import { color, printChecks } from "../build/report.ts";
import { newPackage, type PackageSpec } from "../build/scaffold.ts";
import { verifyPackage } from "../build/verify.ts";
import { defaultsOnly, runWizard, type Prompter } from "../build/wizard.ts";

const HELP = `Usage: npm run new [-- options]

Asks for the new package's slug, entry function, parameters and return type, then writes problems/<slug>/
with every file matching that contract, and runs the verifier on it.

Options:
  --leetcode <url>     start from a LeetCode problem: https://leetcode.com/problems/<slug>/, or the problem's page
                       in an explore card, which also brings in the solutions from that chapter's articles
  --playground <url>   more solutions: a playground (https://leetcode.com/playground/<id>/shared) or an explore
                       article; repeat for several
  --yes, -y            don't ask: take every default (needs --leetcode, or there's no slug)
  --dry-run            list the files without writing them
  --no-verify          skip running the verifier afterwards
  --template           allow a slug starting with "_" (verified, but left off the site)
  --help, -h           show this

Premium editorials and explore cards need a login. Copy the LEETCODE_SESSION cookie from a signed-in browser
(DevTools → Application → Cookies → leetcode.com) into a .env file at the repo root, which git ignores:
  LEETCODE_SESSION=<the cookie's value>

Example:
  npm run new -- --leetcode https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4658/`;

// LEETCODE_SESSION can live in .env (git ignores it).
try { process.loadEnvFile(path.join(ROOT, ".env")); } catch { /* no .env */ }

const { values: flags } = parseArgs({
  options: {
    leetcode: { type: "string" },
    playground: { type: "string", multiple: true },
    yes: { type: "boolean", short: "y" },
    "dry-run": { type: "boolean" },
    "no-verify": { type: "boolean" },
    template: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});
if (flags.help) {
  console.log(HELP);
  process.exit(0);
}

const presets: Record<string, string> = {
  ...(flags.leetcode ? { leetcode: flags.leetcode } : {}),
  ...(flags.leetcode || flags.playground ? { playgrounds: (flags.playground ?? []).join(" ") } : {}),
};

/** Asks in the terminal. Questions answered by flags aren't asked. */
function terminal(): Prompter & { close(): void } {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const hint = (d: string | undefined) => (d ? color(2, ` (${d})`) : "");
  const line = async (message: string, def?: string) => (await rl.question(`${color(36, "?")} ${message}${hint(def)} `)).trim();
  return {
    async text(q) {
      if (q.id && q.id in presets) return presets[q.id];
      return (await line(q.message, q.default)) || (q.default ?? "");
    },
    async select(q) {
      console.log(`${color(36, "?")} ${q.message}`);
      q.choices.forEach((c, i) => console.log(`  ${i + 1}. ${c.label}${c.value === q.default ? color(2, " (default)") : ""}`));
      for (;;) {
        const a = await line("Choose", q.default !== undefined ? String(q.choices.findIndex(c => c.value === q.default) + 1) : undefined);
        if (!a && q.default !== undefined) return q.default;
        const picked = q.choices[Number(a) - 1] ?? q.choices.find(c => c.value === a);
        if (picked) return picked.value;
        console.log(`  Pick 1 to ${q.choices.length}.`);
      }
    },
    async confirm(q) {
      for (;;) {
        const a = (await line(q.message, q.default === undefined ? "y/n" : q.default ? "Y/n" : "y/N")).toLowerCase();
        if (!a && q.default !== undefined) return q.default;
        if (["y", "yes"].includes(a)) return true;
        if (["n", "no"].includes(a)) return false;
      }
    },
    say: text => console.log(text),
    close: () => rl.close(),
  };
}

/** The README's "Add an algorithm" steps this package still needs. */
function todo(spec: PackageSpec): string[] {
  const steps = [
    !spec.statement && "problem_statement/statement.md: the problem statement",
    "problem.yaml: the summary and explanation, then check the constraints",
    !spec.solution && "submissions/accepted/solution.ts: the solution, with `// @line <label>` on each line the trace highlights",
    !spec.bruteForce && "submissions/time_limit_exceeded/brute_force.ts: a correct but slow solution",
    "submissions/wrong_answer/: a few realistic bugs (replace todo.ts)",
    "generators/generators.ts: edge cases, and a random arbitrary that matches the constraints",
    spec.validator && "input_validators/validate.ts: the constraints that aren't ranges",
    "visualization/trace.ts and view.ts: the steps and the picture; the last step sets `result`",
  ];
  return steps.filter((s): s is string => !!s);
}

const prompt = flags.yes ? defaultsOnly(t => console.log(t), presets) : terminal();
let spec: PackageSpec;
try {
  const session = process.env.LEETCODE_SESSION || undefined;
  ({ spec } = await runWizard(prompt, { fetchLeetCode: (url, more) => fetchLeetCode(url, more, { session }) }));
} catch (e) {
  console.error(color(31, (e as Error).message));
  process.exit(1);
} finally {
  if ("close" in prompt) (prompt as { close(): void }).close();
}

let files: string[];
try {
  files = newPackage(spec, { template: flags.template, dryRun: flags["dry-run"] });
} catch (e) {
  console.error(color(31, (e as Error).message));
  process.exit(1);
}

const dir = path.join(PROBLEMS, spec.slug);
console.log(`\n${flags["dry-run"] ? "Would write" : "Wrote"} ${path.relative(ROOT, dir)}/`);
for (const f of files) console.log(`  ${path.relative(dir, f)}`);
if (flags["dry-run"]) process.exit(0);

if (!flags["no-verify"]) {
  console.log(`\n${color(1, spec.slug)}`);
  printChecks(await verifyPackage(loadPackage(dir)));
  console.log(color(2, "  (A new package fails until its stubs are written.)"));
}

console.log(`\n${color(1, "Still to write")}`);
for (const step of todo(spec)) console.log(`  - ${step}`);
console.log(`\nThen run ${color(1, `npm run verify -- ${spec.slug}`)} until everything passes, and ${color(1, "npm run dev")} to see the page.`);
