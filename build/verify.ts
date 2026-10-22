// Verifies a problem package the way a problem-package checker (ICPC, Kattis, Polygon) would:
// the inputs are valid, the accepted solutions are right and fast enough, the tests are strong
// enough to reject every known-wrong solution, and the visualization agrees with the solution.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import fc from "fast-check";
import { createChecker } from "../src/editor/checker.ts";
import { sameAnswer } from "../src/runtime/answers.ts";
import { checkInput, withLimits } from "../src/runtime/constraints.ts";
import { contractOf, signatureOf, type Input, type Step } from "../src/runtime/types.ts";
import { ROOT, type Package } from "./package.ts";
import { largeTests, loadGenerators, SEED, smallTests, type TestCase } from "./testset.ts";
import { loadTsLibs } from "./ts-libs.ts";

let tsLibs: Record<string, string> | undefined;

export { RANDOM_TESTS, SEED } from "./testset.ts";
export const PROPERTY_RUNS = 1000;

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface Submission { name: string; run(input: Input): unknown }

const short = (v: unknown, max = 160) => {
  const s = JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…" : s;
};

/** Everything the checks need, loaded once per package. */
export async function loadSuite(pkg: Package) {
  const load = (file: string) => import(pathToFileURL(file).href);
  const { meta } = pkg;
  const submission = async (file: string): Promise<Submission> => {
    const mod = await load(file);
    const fn = mod[meta.entry];
    if (typeof fn !== "function") throw new Error(`${path.relative(ROOT, file)} does not export ${meta.entry}()`);
    // Each run gets its own copy of the input, so a submission that mutates it can't affect the others.
    return { name: path.relative(path.join(pkg.dir, "submissions"), file), run: input => fn(...meta.input.map(p => structuredClone(input[p.name]))) };
  };

  const gen = await loadGenerators(pkg);
  const custom: ((input: Input) => string[]) | undefined = pkg.paths.validator ? (await load(pkg.paths.validator)).validate : undefined;
  const trace: { buildTrace(input: Input): Step[] } = await load(pkg.paths.trace);

  const accepted = await Promise.all(pkg.paths.accepted.map(submission));
  const solution = accepted.find(s => s.name === "accepted/solution.ts")!;
  const corpus = smallTests(pkg, gen);
  // Reference answers: the samples' .ans files, otherwise the displayed solution's output.
  const answers = new Map<string, unknown>();
  const expected = (t: TestCase) => {
    if (t.answer !== undefined) return t.answer;
    if (!answers.has(t.name)) answers.set(t.name, solution.run(t.input));
    return answers.get(t.name);
  };

  return {
    pkg,
    gen,
    validate: (input: Input, params = meta.input) => [...checkInput(input, params), ...(custom?.(input) ?? [])],
    buildTrace: trace.buildTrace,
    accepted,
    solution,
    expected,
    timeLimitExceeded: await Promise.all(pkg.paths.timeLimitExceeded.map(submission)),
    wrongAnswer: await Promise.all(pkg.paths.wrongAnswer.map(submission)),
    /** Samples, edge cases and seeded random tests: small enough for the brute force. */
    corpus,
    large: largeTests(gen),
  };
}

export type Suite = Awaited<ReturnType<typeof loadSuite>>;

export type Failure = { test: TestCase; expected: unknown } & ({ kind: "throws"; error: string } | { kind: "wrong"; got: unknown });

/** The first test, in test-set order, that a submission gets wrong or throws on. null if it passes them all. */
export function firstFailure(suite: Suite, s: Submission): Failure | null {
  for (const test of suite.corpus) {
    const expected = suite.expected(test);
    let got: unknown;
    try { got = s.run(test.input); }
    catch (e) { return { test, expected, kind: "throws", error: (e as Error).message }; }
    if (!sameAnswer(expected, got)) return { test, expected, kind: "wrong", got };
  }
  return null;
}

export async function verifyPackage(pkg: Package): Promise<Check[]> {
  const checks: Check[] = [];
  const check = async (name: string, fn: () => string | void | Promise<string | void>) => {
    try { checks.push({ name, ok: true, detail: (await fn()) || undefined }); }
    catch (e) { checks.push({ name, ok: false, detail: (e as Error).message }); }
  };

  let suite: Suite;
  try { suite = await loadSuite(pkg); }
  catch (e) { return [{ name: "package loads", ok: false, detail: (e as Error).message }]; }
  const { meta } = pkg;
  const { solution } = suite;
  const oracle = suite.timeLimitExceeded[0];

  await check("accepted solution type-checks against the problem contract", () => {
    // Exactly what the page's editor opens with, checked by the same checker the editor uses.
    const contract = contractOf(meta);
    const found = createChecker(contract, (tsLibs ??= loadTsLibs())).diagnostics(pkg.code.lines.join("\n"));
    if (found.length) throw new Error(found.map(d => `line ${d.line}:${d.column} ${d.category}: ${d.message}`).join("\n"));
    return signatureOf(contract);
  });

  await check("every line of the solution can be highlighted", () => {
    // A line with no @line label is never highlighted, so the animation skips it silently.
    // Only the signature, braces, `} else {`, comments and blank lines may go unlabeled.
    const labelled = new Set(Object.values(pkg.code.labels).flat());
    const structural = /^\s*(\{|\}|\}\s*else\s*\{|\/\/.*)?\s*$/;
    const missing = pkg.code.lines
      .map((text, i) => ({ n: i + 1, text }))
      .filter(l => l.n > 1 && !labelled.has(l.n) && !structural.test(l.text));
    if (missing.length) throw new Error(missing.map(l => `line ${l.n} has no @line label: ${l.text.trim()}`).join("\n"));
  });

  await check("input validator accepts every test input", () => {
    const large = suite.large.map(t => ({ name: t.name, input: t.make() }));
    for (const t of [...suite.corpus, ...large]) {
      const errors = suite.validate(t.input);
      if (errors.length) throw new Error(`${t.name}: ${errors.join(" ")}`);
    }
    return `${suite.corpus.length + large.length} inputs`;
  });

  await check("input validator rejects every invalid_input", () => {
    if (!pkg.invalid.length) throw new Error("data/invalid_input has no tests");
    for (const t of pkg.invalid) {
      if (!suite.validate(t.input).length) throw new Error(`${t.name} was accepted: ${short(t.input)}`);
    }
    return `${pkg.invalid.length} inputs`;
  });

  for (const s of suite.accepted) {
    await check(`${s.name} matches every sample answer`, () => {
      for (const t of pkg.samples) {
        const got = s.run(t.input);
        if (!sameAnswer(got, t.answer)) throw new Error(`${t.name}: expected ${short(t.answer)}, got ${short(got)}`);
      }
    });
  }

  await check("accepted and time_limit_exceeded submissions agree on every test", () => {
    if (!oracle) throw new Error("No brute-force oracle in submissions/time_limit_exceeded");
    const others = [...suite.accepted.filter(s => s !== solution), ...suite.timeLimitExceeded];
    for (const t of suite.corpus) {
      const expected = suite.expected(t);
      for (const s of [solution, ...others]) {
        const got = s.run(t.input);
        if (!sameAnswer(got, expected)) throw new Error(`${s.name} on ${t.name} ${short(t.input)}: expected ${short(expected)}, got ${short(got)}`);
      }
    }
    return `${suite.corpus.length} tests × ${others.length + 1} submissions`;
  });

  await check(`property: solution equals brute force on ${PROPERTY_RUNS} random inputs`, () => {
    if (!oracle) throw new Error("No brute-force oracle in submissions/time_limit_exceeded");
    fc.assert(fc.property(suite.gen.random, input => sameAnswer(solution.run(input), oracle.run(input))),
      { numRuns: PROPERTY_RUNS, seed: SEED + 1 });
  });

  for (const s of suite.accepted) {
    await check(`${s.name} runs the large tests within ${meta.limits.time_ms} ms`, () => {
      if (!suite.large.length) throw new Error("generators.ts has no large tests");
      return suite.large.map(({ name, make }) => {
        const input = make();
        const start = performance.now();
        s.run(input);
        const ms = performance.now() - start;
        if (ms > meta.limits.time_ms) throw new Error(`${name} took ${ms.toFixed(0)} ms`);
        return `${name.slice("large/".length)} ${ms.toFixed(1)} ms`;
      }).join(", ");
    });
  }

  if (!suite.wrongAnswer.length) checks.push({ name: "wrong_answer submissions exist", ok: false, detail: "submissions/wrong_answer is empty" });
  for (const s of suite.wrongAnswer) {
    await check(`${s.name} is rejected`, () => {
      const f = firstFailure(suite, s);
      if (!f) throw new Error(`passes all ${suite.corpus.length} tests, so the tests are too weak to catch it`);
      return f.kind === "throws" ? `throws on ${f.test.name}` : `fails ${f.test.name}: expected ${short(f.expected, 60)}, got ${short(f.got, 60)}`;
    });
  }

  const visual = withLimits(meta.input, meta.visualization.limits);
  await check("visualization default input is valid", () => {
    const errors = suite.validate(meta.visualization.default, visual);
    if (errors.length) throw new Error(errors.join(" "));
  });

  await check("trace highlights real lines and ends with the solution's answer", () => {
    const tests = [{ name: "visualization/default", input: meta.visualization.default }, ...suite.corpus]
      .filter(t => !suite.validate(t.input, visual).length);
    if (tests.length < 10) throw new Error(`only ${tests.length} tests fit the visualization limits`);
    for (const t of tests) {
      const steps = suite.buildTrace(structuredClone(t.input));
      if (steps.length < 2) throw new Error(`${t.name}: trace has ${steps.length} step`);
      const bad = steps.find(s => !(s.line in pkg.code.labels));
      if (bad) throw new Error(`${t.name}: step uses unknown @line label "${bad.line}"`);
      const empty = steps.findIndex(s => !s.note);
      if (empty >= 0) throw new Error(`${t.name}: step ${empty + 1} has no note`);
      const expected = solution.run(t.input), got = steps.at(-1)!.result;
      if (!sameAnswer(got, expected)) throw new Error(`${t.name} ${short(t.input)}: trace ends with ${short(got)}, solution returns ${short(expected)}`);
    }
    return `${tests.length} tests`;
  });

  return checks;
}

/** Write the generated tests to data/secret/ so they can be reviewed like a checked-in ICPC package. */
export async function writeSecretData(pkg: Package) {
  const suite = await loadSuite(pkg);
  const dir = path.join(pkg.dir, "data", "secret");
  rmSync(dir, { recursive: true, force: true });
  for (const t of suite.corpus.filter(t => !t.name.startsWith("sample/"))) {
    const base = path.join(dir, t.name);
    mkdirSync(path.dirname(base), { recursive: true });
    writeFileSync(base + ".in", JSON.stringify(t.input) + "\n");
    writeFileSync(base + ".ans", JSON.stringify(suite.expected(t)) + "\n");
  }
}
