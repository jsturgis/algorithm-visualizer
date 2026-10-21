// Verifies a problem package the way a problem-package checker (ICPC, Kattis, Polygon) would:
// the inputs are valid, the accepted solutions are right and fast enough, the tests are strong
// enough to reject every known-wrong solution, and the visualization agrees with the solution.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import fc from "fast-check";
import { createChecker } from "../src/editor/checker.ts";
import { checkInput, withLimits } from "../src/runtime/constraints.ts";
import { contractOf, signatureOf, type Input, type Step } from "../src/runtime/types.ts";
import { ROOT, type Package, type TestCase } from "./package.ts";
import { loadTsLibs } from "./ts-libs.ts";

let tsLibs: Record<string, string> | undefined;

export const SEED = 20261021;
export const RANDOM_TESTS = 200;
export const PROPERTY_RUNS = 1000;

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

interface Submission { name: string; run(input: Input): unknown }
interface Generators {
  random: fc.Arbitrary<Input>;
  edge?: Record<string, Input>;
  large?: Record<string, () => Input>;
}

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

  const gen: Generators = await load(pkg.paths.generators);
  const custom: ((input: Input) => string[]) | undefined = pkg.paths.validator ? (await load(pkg.paths.validator)).validate : undefined;
  const trace: { buildTrace(input: Input): Step[] } = await load(pkg.paths.trace);

  const random = fc.sample(gen.random, { numRuns: RANDOM_TESTS, seed: SEED }).map((input, i) => ({ name: `random/${i + 1}`, input }));
  const edge = Object.entries(gen.edge ?? {}).map(([name, input]) => ({ name: `edge/${name}`, input }));

  return {
    pkg,
    gen,
    validate: (input: Input, params = meta.input) => [...checkInput(input, params), ...(custom?.(input) ?? [])],
    buildTrace: trace.buildTrace,
    accepted: await Promise.all(pkg.paths.accepted.map(submission)),
    timeLimitExceeded: await Promise.all(pkg.paths.timeLimitExceeded.map(submission)),
    wrongAnswer: await Promise.all(pkg.paths.wrongAnswer.map(submission)),
    /** Samples, edge cases and seeded random tests: small enough for the brute force. */
    corpus: [...pkg.samples, ...edge, ...random] as TestCase[],
  };
}

export type Suite = Awaited<ReturnType<typeof loadSuite>>;

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
  const solution = suite.accepted.find(s => s.name === "accepted/solution.ts")!;
  const oracle = suite.timeLimitExceeded[0];

  // Reference answers: the samples' .ans files, otherwise the displayed solution's output.
  const answers = new Map<string, unknown>();

  await check("accepted solution type-checks against the problem contract", () => {
    // Exactly what the page's editor opens with, checked by the same checker the editor uses.
    const contract = contractOf(meta);
    const found = createChecker(contract, (tsLibs ??= loadTsLibs())).diagnostics(pkg.code.lines.join("\n"));
    if (found.length) throw new Error(found.map(d => `line ${d.line}:${d.column} ${d.category}: ${d.message}`).join("\n"));
    return signatureOf(contract);
  });

  await check("input validator accepts every test input", () => {
    const large = Object.entries(suite.gen.large ?? {}).map(([name, make]) => ({ name: `large/${name}`, input: make() }));
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
        if (!isDeepStrictEqual(got, t.answer)) throw new Error(`${t.name}: expected ${short(t.answer)}, got ${short(got)}`);
      }
    });
  }

  await check("accepted and time_limit_exceeded submissions agree on every test", () => {
    if (!oracle) throw new Error("No brute-force oracle in submissions/time_limit_exceeded");
    const others = [...suite.accepted.filter(s => s !== solution), ...suite.timeLimitExceeded];
    for (const t of suite.corpus) {
      const expected = t.answer !== undefined ? t.answer : solution.run(t.input);
      answers.set(t.name, expected);
      for (const s of [solution, ...others]) {
        const got = s.run(t.input);
        if (!isDeepStrictEqual(got, expected)) throw new Error(`${s.name} on ${t.name} ${short(t.input)}: expected ${short(expected)}, got ${short(got)}`);
      }
    }
    return `${suite.corpus.length} tests × ${others.length + 1} submissions`;
  });

  await check(`property: solution equals brute force on ${PROPERTY_RUNS} random inputs`, () => {
    if (!oracle) throw new Error("No brute-force oracle in submissions/time_limit_exceeded");
    fc.assert(fc.property(suite.gen.random, input => isDeepStrictEqual(solution.run(input), oracle.run(input))),
      { numRuns: PROPERTY_RUNS, seed: SEED + 1 });
  });

  for (const s of suite.accepted) {
    await check(`${s.name} runs the large tests within ${meta.limits.time_ms} ms`, () => {
      const large = Object.entries(suite.gen.large ?? {});
      if (!large.length) throw new Error("generators.ts has no large tests");
      return large.map(([name, make]) => {
        const input = make();
        const start = performance.now();
        s.run(input);
        const ms = performance.now() - start;
        if (ms > meta.limits.time_ms) throw new Error(`large/${name} took ${ms.toFixed(0)} ms`);
        return `${name} ${ms.toFixed(1)} ms`;
      }).join(", ");
    });
  }

  if (!suite.wrongAnswer.length) checks.push({ name: "wrong_answer submissions exist", ok: false, detail: "submissions/wrong_answer is empty" });
  for (const s of suite.wrongAnswer) {
    await check(`${s.name} is rejected`, () => {
      for (const t of suite.corpus) {
        const expected = answers.has(t.name) ? answers.get(t.name) : solution.run(t.input);
        let got: unknown;
        try { got = s.run(t.input); } catch (e) { return `throws on ${t.name}`; }
        if (!isDeepStrictEqual(got, expected)) return `fails ${t.name}: expected ${short(expected, 60)}, got ${short(got, 60)}`;
      }
      throw new Error(`passes all ${suite.corpus.length} tests, so the tests are too weak to catch it`);
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
      if (!isDeepStrictEqual(got, expected)) throw new Error(`${t.name} ${short(t.input)}: trace ends with ${short(got)}, solution returns ${short(expected)}`);
    }
    return `${tests.length} tests`;
  });

  return checks;
}

/** Write the generated tests to data/secret/ so they can be reviewed like a checked-in ICPC package. */
export async function writeSecretData(pkg: Package) {
  const suite = await loadSuite(pkg);
  const solution = suite.accepted.find(s => s.name === "accepted/solution.ts")!;
  const dir = path.join(pkg.dir, "data", "secret");
  rmSync(dir, { recursive: true, force: true });
  for (const t of suite.corpus.filter(t => !t.name.startsWith("sample/"))) {
    const base = path.join(dir, t.name);
    mkdirSync(path.dirname(base), { recursive: true });
    writeFileSync(base + ".in", JSON.stringify(t.input) + "\n");
    writeFileSync(base + ".ans", JSON.stringify(solution.run(t.input)) + "\n");
  }
}
