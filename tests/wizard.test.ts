// The `npm run new` wizard, driven by a scripted prompter: each answer is checked against the question it answers,
// so the script also pins down the order of the questions.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { LeetCodeData } from "../build/leetcode.ts";
import { ROOT } from "../build/package.ts";
import { defaultsOnly, runWizard, type Prompter, type Question } from "../build/wizard.ts";

type Answer = string | boolean | undefined;   // undefined: take the default

/** A prompter that answers from `script`, in order. Each entry is [a pattern the question must match, the answer]. */
function scripted(script: [RegExp, Answer][]) {
  const said: string[] = [];
  const asked: Question[] = [];
  const next = (q: Question) => {
    asked.push(q);
    const entry = script.shift();
    if (!entry) throw new Error(`unscripted question: ${q.message}`);
    const [pattern, answer] = entry;
    if (!pattern.test(q.message)) throw new Error(`expected a question matching ${pattern}, got: ${q.message}`);
    if (answer === undefined) {
      if (q.default === undefined) throw new Error(`no default for: ${q.message}`);
      return q.default;
    }
    return answer;
  };
  const prompter: Prompter = {
    text: async q => next(q) as string,
    select: async q => next(q) as never,
    confirm: async q => next(q) as boolean,
    say: text => { said.push(text); },
  };
  return { prompter, said, asked, left: () => script.map(([p]) => p) };
}

const fixture = (slug: string): LeetCodeData =>
  JSON.parse(readFileSync(path.join(ROOT, "tests/fixtures/leetcode", `${slug}.json`), "utf8"));
const noFetch = async (): Promise<LeetCodeData> => { throw new Error("no network in tests"); };

describe("runWizard", () => {
  test("builds a spec from answers, one parameter at a time", async () => {
    const s = scripted([
      [/LeetCode/i, ""],
      [/slug/i, "find-max"],
      [/title/i, undefined],
      [/entry function/i, undefined],
      [/parameter 1 name/i, "nums"],
      [/type of nums/i, "int[]"],
      [/length of nums/i, "1..1000"],
      [/each number in nums/i, undefined],
      [/parameter 2 name/i, ""],
      [/return/i, "int"],
      [/time complexity/i, "O(n)"],
      [/space complexity/i, "O(1)"],
      [/time limit/i, undefined],
      [/validator/i, false],
      [/create/i, true],
    ]);
    const result = await runWizard(s.prompter, { fetchLeetCode: noFetch });
    expect(s.left()).toEqual([]);
    expect(result).toEqual({
      spec: {
        slug: "find-max",
        title: "Find Max",
        entry: "findMax",
        input: [{ name: "nums", type: "int[]", length: [1, 1000], value: [-1000000, 1000000] }],
        returns: "int",
        complexity: { time: "O(n)", space: "O(1)" },
        time_ms: 1000,
        validator: false,
      },
    });
  });

  test("starts from a LeetCode problem and its JavaScript playgrounds", async () => {
    const fetched: unknown[][] = [];
    const fetchLeetCode = async (...args: unknown[]) => { fetched.push(args); return fixture("number-of-ways-to-split-array"); };
    const s = scripted([
      [/LeetCode/i, "https://leetcode.com/problems/number-of-ways-to-split-array/description/"],
      [/playground/i, "https://leetcode.com/playground/e6iUcQZi/shared https://leetcode.com/playground/WwAPE46B/shared"],
      [/slug/i, undefined],
      [/title/i, undefined],
      [/entry function/i, undefined],
      [/use these parameters/i, undefined],
      [/return/i, undefined],
      [/accepted solution/i, "Playground WwAPE46B"],
      [/brute force/i, "Playground e6iUcQZi"],
      [/time complexity/i, undefined],
      [/space complexity/i, undefined],
      [/time limit/i, undefined],
      [/validator/i, undefined],
      [/create/i, true],
    ]);
    const { spec } = await runWizard(s.prompter, { fetchLeetCode });
    expect(s.left()).toEqual([]);
    expect(fetched).toEqual([["https://leetcode.com/problems/number-of-ways-to-split-array/description/",
      ["https://leetcode.com/playground/e6iUcQZi/shared", "https://leetcode.com/playground/WwAPE46B/shared"]]]);
    expect(spec).toMatchObject({
      slug: "number-of-ways-to-split-array",
      title: "Number of Ways to Split Array",
      source: "LeetCode 2270",
      entry: "waysToSplitArray",
      input: [{ name: "nums", type: "int[]", length: [2, 100000], value: [-100000, 100000] }],
      returns: "int",
      validator: false,
    });
    expect(spec.samples).toHaveLength(2);
    expect(spec.statement).toMatch(/valid split/);
    expect(spec.solution).toMatch(/let ans = 0, leftSection = 0, total = 0;/);
    expect(spec.bruteForce).toMatch(/let prefix = \[nums\[0\]\];/);
  });

  test("offers an editorial approach to port when there's no JavaScript, with its complexity", async () => {
    const s = scripted([
      [/LeetCode/i, "https://leetcode.com/problems/binary-search/"],
      [/playground/i, ""],
      [/slug/i, undefined],
      [/title/i, undefined],
      [/entry function/i, undefined],
      [/use these parameters/i, undefined],
      [/return/i, undefined],
      [/port/i, "Approach 2: Find Upper bound"],
      [/time complexity/i, undefined],
      [/space complexity/i, undefined],
      [/time limit/i, undefined],
      [/validator/i, undefined],
      [/create/i, true],
    ]);
    const { spec } = await runWizard(s.prompter, { fetchLeetCode: async () => fixture("binary-search") });
    expect(s.left()).toEqual([]);
    expect(spec.solution).toBeUndefined();
    expect(spec.reference).toMatchObject({ language: "python3" });
    expect(spec.complexity).toEqual({ time: "O(log n)", space: "O(1)" });
    expect(spec.explanation).toMatch(/upper bound|insert position/i);
    expect(spec.validator).toBe(true);   // "nums is sorted" can't be a range
    expect(spec.constraints_note).toHaveLength(2);
  });

  test("explains a bad answer and asks again", async () => {
    const s = scripted([
      [/LeetCode/i, ""],
      [/slug/i, "Find_Max"],
      [/slug/i, "find-max"],
      [/title/i, undefined],
      [/entry function/i, "find-max"],
      [/entry function/i, "findMax"],
      [/parameter 1 name/i, "s"],
      [/type of s/i, "string"],
      [/length of s/i, "10..1"],
      [/length of s/i, "1..10"],
      [/characters allowed in s/i, "[a-z"],
      [/characters allowed in s/i, "[01]"],
      [/parameter 2 name/i, "s"],
      [/parameter 2 name/i, ""],
      [/return/i, "bool"],
      [/time complexity/i, undefined],
      [/space complexity/i, undefined],
      [/time limit/i, "fast"],
      [/time limit/i, "200"],
      [/validator/i, false],
      [/create/i, true],
    ]);
    const { spec } = await runWizard(s.prompter, { fetchLeetCode: noFetch });
    expect(spec.input).toEqual([{ name: "s", type: "string", length: [1, 10], chars: "[01]" }]);
    expect(spec.time_ms).toBe(200);
    expect(s.said.join("\n")).toMatch(/slug "Find_Max" must be lowercase/);
    expect(s.said.join("\n")).toMatch(/find-max isn't a valid function name/);
    expect(s.said.join("\n")).toMatch(/10 is bigger than 1/);
    expect(s.said.join("\n")).toMatch(/\[a-z isn't a regex character class/);
    expect(s.said.join("\n")).toMatch(/already a parameter called s/);
  });
});

describe("defaultsOnly (--yes)", () => {
  test("takes every default, so a LeetCode import needs no answers", async () => {
    const said: string[] = [];
    const { spec } = await runWizard(defaultsOnly(t => said.push(t), { leetcode: "binary-search" }), { fetchLeetCode: async () => fixture("binary-search") });
    expect(spec).toMatchObject({ slug: "binary-search", entry: "search", returns: "int", complexity: { time: "O(log n)", space: "O(1)" } });
    expect(spec.reference?.code).toMatch(/Find the Exact Value|def search/);
  });

  test("names the first question that has no default", async () => {
    await expect(runWizard(defaultsOnly(() => {}), { fetchLeetCode: noFetch })).rejects.toThrow(/--yes.*Package slug/);
  });
});
