// A package's ordered test set, shared by `npm run verify` and the in-browser judge so both use
// exactly the same tests in the same order: samples, edge cases, seeded random tests, large tests.
import path from "node:path";
import { pathToFileURL } from "node:url";
import fc from "fast-check";
import type { Input } from "../src/runtime/types.ts";
import type { Package } from "./package.ts";

export const SEED = 20261021;
export const RANDOM_TESTS = 200;

export type TestCategory = "sample" | "edge" | "random" | "large";

export interface TestCase {
  /** e.g. "sample/1", "edge/window_one_too_big", "random/17", "large/max_n_small_k" */
  name: string;
  category: TestCategory;
  input: Input;
  /** Samples: the .ans file. Others: filled in from the accepted solution by withAnswers(). */
  answer?: unknown;
}

export interface Generators {
  random: fc.Arbitrary<Input>;
  edge?: Record<string, Input>;
  large?: Record<string, () => Input>;
}

export const importTs = (file: string) => import(pathToFileURL(file).href);
export const loadGenerators = (pkg: Package): Promise<Generators> => importTs(pkg.paths.generators);

/** Samples, edge cases and seeded random tests: small enough for the brute force. */
export function smallTests(pkg: Package, gen: Generators): TestCase[] {
  const samples = pkg.samples.map(t => ({ ...t, category: "sample" as const }));
  const edge = Object.entries(gen.edge ?? {}).map(([name, input]) => ({ name: `edge/${name}`, category: "edge" as const, input }));
  const random = fc.sample(gen.random, { numRuns: RANDOM_TESTS, seed: SEED })
    .map((input, i) => ({ name: `random/${i + 1}`, category: "random" as const, input }));
  return [...samples, ...edge, ...random];
}

/** Maximum-size tests, generated on demand: their inputs are too big to keep around. */
export const largeTests = (gen: Generators) =>
  Object.entries(gen.large ?? {}).map(([name, make]) => ({ name: `large/${name}`, category: "large" as const, make }));

/** Run the package's displayed accepted solution on one input. */
export async function acceptedSolution(pkg: Package): Promise<(input: Input) => unknown> {
  const fn = (await importTs(path.join(pkg.dir, "submissions/accepted/solution.ts")))[pkg.meta.entry];
  if (typeof fn !== "function") throw new Error(`${pkg.slug}: accepted/solution.ts does not export ${pkg.meta.entry}()`);
  return input => fn(...pkg.meta.input.map(p => structuredClone(input[p.name])));
}

/** The whole ordered test set with every answer, for the judge. Large inputs are generated here. */
export async function buildTestSet(pkg: Package): Promise<TestCase[]> {
  const gen = await loadGenerators(pkg);
  const solve = await acceptedSolution(pkg);
  const all: TestCase[] = [...smallTests(pkg, gen), ...largeTests(gen).map(({ make, ...t }) => ({ ...t, input: make() }))];
  return all.map(t => ({ ...t, answer: t.answer !== undefined ? t.answer : solve(t.input) }));
}
