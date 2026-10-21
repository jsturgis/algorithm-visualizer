// The answer comparison and the test-set builder that the verifier and the judge share.
import { describe, expect, test } from "vitest";
import { loadPackages } from "../build/package.ts";
import { buildTestSet } from "../build/testset.ts";
import { loadSuite } from "../build/verify.ts";
import { answerFingerprint, canonical, firstDifference, sameAnswer } from "../src/runtime/answers.ts";

describe("answer comparison", () => {
  test("-0 and 0 are the same answer", () => {
    expect(sameAnswer(0, -0)).toBe(true);
    expect(sameAnswer([0, 1], [-0, 1])).toBe(true);
  });

  test("object key order doesn't matter", () => {
    expect(sameAnswer({ a: 1, b: [2] }, { b: [2], a: 1 })).toBe(true);
    expect(canonical({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  test("array order and values do", () => {
    expect(sameAnswer([1, 2], [2, 1])).toBe(false);
    expect(sameAnswer([1, 2], [1, 2, 3])).toBe(false);
    expect(sameAnswer(1, "1")).toBe(false);
    expect(sameAnswer(1, undefined)).toBe(false);
  });

  test.each([
    [[1, 2, 3], [1, 2, 4], [2]],
    [[1, 2, 3], [1, 2], [2]],
    [[1, 2], [1, 2, 3], [2]],
    [[[1], [2, 3]], [[1], [2, 4]], [1, 1]],
    [{ a: 1, b: 2 }, { a: 1, b: 3 }, ["b"]],
    [5, 6, []],
    [[1], [1], null],
  ])("firstDifference(%j, %j) is %j", (expected, actual, path) => {
    expect(firstDifference(expected, actual)).toEqual(path);
  });

  test("fingerprints depend only on the canonical answer", async () => {
    expect(await answerFingerprint({ a: 1, b: -0 })).toBe(await answerFingerprint({ b: 0, a: 1 }));
    expect(await answerFingerprint([1, 2])).not.toBe(await answerFingerprint([2, 1]));
    expect(await answerFingerprint([1, 2])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe.each(loadPackages({ templates: true }))("test set for problems/$slug", pkg => {
  test("is the verifier's test set: same tests, same order, same answers", async () => {
    const [built, suite] = await Promise.all([buildTestSet(pkg), loadSuite(pkg)]);
    expect(built.map(t => t.name)).toEqual([...suite.corpus.map(t => t.name), ...suite.large.map(t => t.name)]);
    for (const t of suite.corpus) expect(built.find(b => b.name === t.name)!.answer).toEqual(suite.expected(t));
    for (const t of suite.large) expect(built.find(b => b.name === t.name)!.answer).toEqual(suite.solution.run(t.make()));
  });

  test("runs samples, then edge cases, then random tests, then large tests", async () => {
    const order = ["sample", "edge", "random", "large"];
    const cats = (await buildTestSet(pkg)).map(t => order.indexOf(t.category));
    expect(cats).toEqual([...cats].sort((a, b) => a - b));
    expect(new Set(cats).size).toBe(4);
  });
});
