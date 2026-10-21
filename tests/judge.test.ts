// The judge, through its public entry point, with the real worker-thread runner (so time limits are real)
// and the real code checker. The key test: it reaches the same verdicts as `npm run verify`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { toDisplayCode } from "../build/code.ts";
import { loadPackages, type Package } from "../build/package.ts";
import { buildTestSet, loadGenerators } from "../build/testset.ts";
import { loadTsLibs } from "../build/ts-libs.ts";
import { firstFailure, loadSuite } from "../build/verify.ts";
import { createChecker } from "../src/editor/checker.ts";
import { inProcess } from "../src/editor/transport.ts";
import { judge, type JudgeTest, type Verdict } from "../src/judge/judge.ts";
import { nodeRunner } from "../src/judge/node-runner.ts";
import { WATCHDOG_GRACE_MS } from "../src/judge/runner.ts";
import { answerFingerprint } from "../src/runtime/answers.ts";
import { BROWSER_TIME_MULTIPLIER, contractOf } from "../src/runtime/types.ts";

const libs = loadTsLibs();
const packages = loadPackages({ templates: true });

/** The test set exactly as the site ships it: large tests as generator + answer fingerprint. */
async function shippedTests(pkg: Package): Promise<JudgeTest[]> {
  const gen = await loadGenerators(pkg);
  return Promise.all((await buildTestSet(pkg)).map(async (t): Promise<JudgeTest> => t.category === "large"
    ? { name: t.name, category: t.category, make: gen.large![t.name.slice("large/".length)], answerHash: await answerFingerprint(t.answer) }
    : { name: t.name, category: t.category, input: t.input, answer: t.answer }));
}

const displayed = (file: string) => toDisplayCode(readFileSync(file, "utf8")).lines.join("\n");

async function judgeSource(pkg: Package, source: string, extra: Partial<Parameters<typeof judge>[0]> = {}) {
  const contract = contractOf(pkg.meta);
  const runner = nodeRunner();
  try {
    return await judge({
      source, contract, runner,
      tests: await shippedTests(pkg),
      checker: inProcess(createChecker(contract, libs)),
      timeLimitMs: pkg.meta.limits.time_ms * BROWSER_TIME_MULTIPLIER,
      ...extra,
    });
  } finally {
    runner.dispose();
  }
}

describe.each(packages)("agrees with npm run verify: problems/$slug", pkg => {
  test("the accepted solution is Accepted on every test", async () => {
    const v = await judgeSource(pkg, pkg.code.lines.join("\n"));
    expect(v).toMatchObject({ kind: "Accepted", typeErrors: 0 });
    if (v.kind === "Accepted") expect(v.passed).toBe(v.total);
  });

  test.each(pkg.paths.wrongAnswer.map(f => [path.basename(f), f]))("wrong_answer/%s gets Wrong Answer on the verifier's first failing test", async (_, file) => {
    const suite = await loadSuite(pkg);
    const failure = firstFailure(suite, suite.wrongAnswer.find(s => s.name.endsWith(path.basename(file)))!);
    expect(failure?.kind).toBe("wrong");
    const v = await judgeSource(pkg, displayed(file));
    expect(v.kind).toBe("WrongAnswer");
    if (v.kind === "WrongAnswer") {
      expect(v.test.name).toBe(failure!.test.name);
      expect(v.expected).toEqual(failure!.expected);
      if (failure!.kind === "wrong") expect(v.actual).toEqual(failure!.got);
    }
  });
});

describe("verdicts", () => {
  const kRadius = packages.find(p => p.slug === "k-radius-averages")!;
  const reference = kRadius.code.lines.join("\n");
  const limit = kRadius.meta.limits.time_ms * BROWSER_TIME_MULTIPLIER;
  /** The reference with the last `from` replaced. */
  const edit = (from: string, to: string) => {
    const i = reference.lastIndexOf(from);
    if (i < 0) throw new Error(`"${from}" not in reference`);
    return reference.slice(0, i) + to + reference.slice(i + from.length);
  };

  test("an infinite loop is stopped and reported as Time Limit Exceeded on the first test", async () => {
    const start = performance.now();
    const v = await judgeSource(kRadius, edit("const n = nums.length", "while (k >= 0) {}\n    const n = nums.length"));
    expect(v).toMatchObject({ kind: "TimeLimitExceeded", test: { name: "sample/1", index: 0 }, passed: 0, limitMs: limit });
    expect(performance.now() - start).toBeLessThan(limit + WATCHDOG_GRACE_MS + 1500);
  });

  test("a correct but quadratic solution passes the small tests and times out on the first large one", async () => {
    const v = await judgeSource(kRadius, edit("prefix[i + 1] = prefix[i] + nums[i];", "{ prefix[i + 1] = 0; for (let j = 0; j <= i; j++) prefix[i + 1] += nums[j]; }"));
    expect(v.kind).toBe("TimeLimitExceeded");
    if (v.kind === "TimeLimitExceeded") {
      expect(v.test.category).toBe("large");
      const tests = await shippedTests(kRadius);
      expect(v.passed).toBe(tests.findIndex(t => t.category === "large"));
    }
  });

  test("a thrown error is a Runtime Error with its message and input", async () => {
    const v = await judgeSource(kRadius, edit("return avgs;", "if (nums.length > 5) throw new RangeError('too long');\n    return avgs;"));
    expect(v).toMatchObject({ kind: "RuntimeError", test: { name: "sample/1" }, message: "RangeError: too long", input: { nums: [7, 4, 3, 9, 1, 8, 5, 2, 6], k: 3 } });
  });

  test("an error while loading the code is a Runtime Error before any test", async () => {
    const v = await judgeSource(kRadius, reference + "\nthrow new Error('at load');");
    expect(v).toMatchObject({ kind: "RuntimeError", test: null, input: null, message: "Error: at load", passed: 0 });
  });

  test("returning a value that can't be compared is a Runtime Error", async () => {
    const v = await judgeSource(kRadius, edit("return avgs;", "return (() => avgs) as unknown as number[];"));
    expect(v.kind).toBe("RuntimeError");
    if (v.kind === "RuntimeError") expect(v.message).toMatch(/can't be compared/);
  });

  test("a contract violation is a Compile Error with the checker's diagnostics", async () => {
    const v = await judgeSource(kRadius, reference.replace("function getAverages", "function averages"));
    expect(v.kind).toBe("CompileError");
    if (v.kind === "CompileError") expect(v.diagnostics).toEqual([expect.objectContaining({ category: "contract" })]);
  });

  test("a syntax error is a Compile Error", async () => {
    expect((await judgeSource(kRadius, edit("for (let i = k;", "for (let i = k"))).kind).toBe("CompileError");
  });

  test("type errors alone don't stop the run, and are counted", async () => {
    const v = await judgeSource(kRadius, edit("return avgs;", "const label: string = n;\n    return avgs;"));
    expect(v).toMatchObject({ kind: "Accepted", typeErrors: 1 });
  });

  test("an input mutated by the code doesn't affect later tests or the test set", async () => {
    const tests = await shippedTests(kRadius);
    const before = JSON.stringify(tests.filter(t => "input" in t).map(t => "input" in t && t.input));
    const v = await judgeSource(kRadius, edit("return avgs;", "nums.fill(0); k = 0;\n    return avgs;"), { tests });
    expect(v.kind).toBe("Accepted");
    expect(JSON.stringify(tests.filter(t => "input" in t).map(t => "input" in t && t.input))).toBe(before);
  });

  test("a Wrong Answer reports the first differing index", async () => {
    const v = await judgeSource(kRadius, edit("Math.floor(sum / size)", "Math.round(sum / size)"));
    expect(v).toMatchObject({ kind: "WrongAnswer", test: { name: "sample/1" }, difference: [4] });
  });

  test("a Wrong Answer on a large test has no expected value, only the learner's output", async () => {
    // Wrong only on inputs longer than any small test.
    const v = await judgeSource(kRadius, edit("return avgs;", "if (n > 1000) avgs[0] = 7;\n    return avgs;"));
    expect(v).toMatchObject({ kind: "WrongAnswer", test: { category: "large" }, difference: null });
    if (v.kind === "WrongAnswer") {
      expect("expected" in v).toBe(false);
      expect((v.actual as number[])[0]).toBe(7);
    }
  });

  test("progress is reported for every test, in order", async () => {
    const seen: string[] = [];
    const v = await judgeSource(kRadius, reference, { onProgress: p => seen.push(p.test) });
    const tests = await shippedTests(kRadius);
    expect(v.kind).toBe("Accepted");
    expect(seen).toEqual([...tests.map(t => t.name), ""]);
  });

  test("cancelling mid-run stops it and reports Cancelled", async () => {
    const controller = new AbortController();
    const v = await judgeSource(kRadius, reference, {
      signal: controller.signal,
      onProgress: p => { if (p.done === 5) controller.abort(); },
    });
    expect(v).toMatchObject({ kind: "Cancelled", passed: 5 });
  });

  test("the same code gets the same verdict every time", async () => {
    const source = edit("Math.floor(sum / size)", "Math.ceil(sum / size)");
    const strip = (v: Verdict) => JSON.stringify(v, (k, x) => (k === "ms" ? undefined : x));
    expect(strip(await judgeSource(kRadius, source))).toBe(strip(await judgeSource(kRadius, source)));
  });
});
