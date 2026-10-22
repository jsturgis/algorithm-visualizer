// Importing a LeetCode problem, on responses recorded from leetcode.com's GraphQL API (tests/fixtures/leetcode/).
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { fromLeetCode, parseLeetCodeUrl, type LeetCodeData } from "../build/leetcode.ts";
import { loadPackage, ROOT } from "../build/package.ts";
import { newPackage } from "../build/scaffold.ts";
import { verifyPackage } from "../build/verify.ts";

const TMP = path.join(ROOT, "tests/.tmp/leetcode");
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const fixture = (slug: string): LeetCodeData =>
  JSON.parse(readFileSync(path.join(ROOT, "tests/fixtures/leetcode", `${slug}.json`), "utf8"));

describe("parseLeetCodeUrl", () => {
  test.each([
    ["https://leetcode.com/problems/binary-search/description/", { kind: "problem", slug: "binary-search" }],
    ["binary-search", { kind: "problem", slug: "binary-search" }],
    ["https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4658/",
      { kind: "explore", card: "leetcodes-interview-crash-course-data-structures-and-algorithms", chapter: "703", item: "4658" }],
    ["https://leetcode.com/playground/WwAPE46B/shared", { kind: "playground", uuid: "WwAPE46B" }],
  ])("%s", (url, expected) => {
    expect(parseLeetCodeUrl(url)).toEqual(expected);
  });

  test("rejects other links", () => {
    expect(() => parseLeetCodeUrl("https://example.com/problems/binary-search")).toThrow(/isn't a LeetCode/);
  });
});

describe("fromLeetCode", () => {
  test("reads the contract, constraints and examples", () => {
    const { spec } = fromLeetCode(fixture("binary-search"));
    expect(spec).toMatchObject({
      slug: "binary-search",
      title: "Binary Search",
      source: "LeetCode 704",
      tags: ["Array", "Binary Search"],
      entry: "search",
      input: [
        { name: "nums", type: "int[]", length: [1, 10000], value: [-9999, 9999] },
        { name: "target", type: "int", value: [-9999, 9999] },
      ],
      returns: "int",
      samples: [
        { input: { nums: [-1, 0, 3, 5, 9, 12], target: 9 }, answer: 4 },
        { input: { nums: [-1, 0, 3, 5, 9, 12], target: 2 }, answer: -1 },
      ],
    });
  });

  test("keeps the statement up to the examples, as Markdown, and the constraints it can't read as notes", () => {
    const { spec } = fromLeetCode(fixture("binary-search"));
    expect(spec.statement).toMatch(/^Given an array of integers `nums` which is sorted in ascending order, and an integer `target`/);
    expect(spec.statement).not.toMatch(/Example|Constraints|<\w+>/);
    expect(spec.constraints_note).toEqual(["All the integers in nums are unique.", "nums is sorted in ascending order."]);
  });

  test("reads string parameters, their character set and a bool answer", () => {
    const { spec } = fromLeetCode(fixture("is-subsequence"));
    expect(spec.input).toEqual([
      { name: "s", type: "string", length: [0, 100], chars: "[a-z]" },
      { name: "t", type: "string", length: [0, 10000], chars: "[a-z]" },
    ]);
    expect(spec.returns).toBe("bool");
    expect(spec.samples).toEqual([{ input: { s: "abc", t: "ahbgdc" }, answer: true }, { input: { s: "axc", t: "ahbgdc" }, answer: false }]);
    expect(spec.constraints_note).toEqual([]);
  });

  test("follows `n == nums.length` and constraints shared by several parameters", () => {
    const { spec } = fromLeetCode(fixture("k-radius-subarray-averages"));
    expect(spec.input).toEqual([
      { name: "nums", type: "int[]", length: [1, 100000], value: [0, 100000] },
      { name: "k", type: "int", value: [0, 100000] },
    ]);
    expect(spec.samples).toHaveLength(3);
    expect(spec.samples![0]).toEqual({ input: { nums: [7, 4, 3, 9, 1, 8, 5, 2, 6], k: 3 }, answer: [-1, -1, -1, 5, 4, 4, -1, -1, -1] });
  });

  test("lists the editorial's approaches, with their complexity and code to port", () => {
    const { solutions } = fromLeetCode(fixture("binary-search"));
    expect(solutions.map(s => s.title)).toEqual([
      "Approach 1: Find the Exact Value", "Approach 2: Find Upper bound", "Approach 3: Find Lower bound", "Approach 4: Use built-in tools.",
    ]);
    expect(solutions[0]).toMatchObject({ language: "python3", complexity: { time: "O(log n)", space: "O(1)" } });
    expect(solutions[0].code).toMatch(/def search\(self, nums: List\[int\], target: int\) -> int:/);
    expect(solutions[0].explanation).toMatch(/Initialize the boundaries of the search space/);
    expect(solutions[0].typescript).toBeUndefined();
  });

  test("turns JavaScript playground code into solutions that pass the package checks", async () => {
    const { spec, solutions } = fromLeetCode(fixture("number-of-ways-to-split-array"));
    const js = solutions.filter(s => s.typescript);
    expect(js.map(s => s.title)).toEqual(["Playground e6iUcQZi", "Playground WwAPE46B"]);
    expect(js[0].typescript).toMatch(/^export function waysToSplitArray\(nums: number\[\]\): number \{/);

    const root = path.join(TMP, "split-array");
    newPackage({ ...spec, solution: js[1].typescript, bruteForce: js[0].typescript }, { root });
    const failed = (await verifyPackage(loadPackage(path.join(root, spec.slug)))).filter(c => !c.ok);
    expect(failed.map(c => c.name)).toEqual(["trace highlights real lines and ends with the solution's answer"]);
  });

  test("takes the solutions in explore articles that solve this problem, named after the article", () => {
    // Explore articles need a login, so this one is made up rather than recorded: it teaches two problems.
    const data = fixture("number-of-ways-to-split-array");
    const otherProblem = "var answerQueries = function(nums, queries, limit) {\n    return [];\n};";
    data.playgrounds = { ...data.playgrounds, Other123: [{ langSlug: "javascript", code: otherProblem }] };
    data.articles = [{ title: "Prefix sum", playgrounds: ["Other123", "e6iUcQZi", "WwAPE46B"] }];
    const { solutions } = fromLeetCode(data);
    expect(solutions.map(s => s.title)).toEqual([
      "Approach 1: Prefix Sum Array", "Approach 2: Optimized Prefix and Suffix Sums", "Prefix sum (1)", "Prefix sum (2)",
    ]);
    expect(solutions.filter(s => s.typescript).map(s => s.title)).toEqual(["Prefix sum (1)", "Prefix sum (2)"]);
  });

  test("says how to unlock a premium editorial it couldn't read", () => {
    expect(fromLeetCode(fixture("running-sum-of-1d-array")).notes).toEqual([expect.stringMatching(/editorial is premium.*LEETCODE_SESSION/)]);
    expect(fromLeetCode(fixture("binary-search")).notes).toEqual([]);
  });

  test("refuses a problem that changes its input in place", () => {
    expect(() => fromLeetCode(fixture("reverse-string"))).toThrow(/in place/);
  });
});
