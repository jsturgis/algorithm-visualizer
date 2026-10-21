// The verifier must catch broken packages. Each test copies the template, plants one mistake, and expects a failed check.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { loadPackage, PROBLEMS, ROOT } from "../build/package.ts";
import { verifyPackage } from "../build/verify.ts";

// Inside the repo so the copies can still import fast-check from node_modules.
const TMP = path.join(ROOT, "tests/.tmp/verifier");
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

let n = 0;
/** Copy the template, apply `edit(dir)`, and return the failed checks' names. */
async function failures(edit: (dir: string) => void): Promise<string[]> {
  const dir = path.join(TMP, `case-${++n}`, "_template");
  mkdirSync(path.dirname(dir), { recursive: true });
  cpSync(path.join(PROBLEMS, "_template"), dir, { recursive: true });
  // The copy is two folders deeper, so point its type imports at the real runtime.
  for (const f of ["visualization/trace.ts", "visualization/view.ts"]) {
    const file = path.join(dir, f);
    writeFileSync(file, readFileSync(file, "utf8").replaceAll("../../../src/", path.relative(path.dirname(file), path.join(ROOT, "src")) + "/"));
  }
  edit(dir);
  return (await verifyPackage(loadPackage(dir))).filter(c => !c.ok).map(c => c.name);
}

const replaceIn = (file: string, from: string, to: string) => {
  const text = readFileSync(file, "utf8");
  if (!text.includes(from)) throw new Error(`"${from}" not found in ${file}`);
  writeFileSync(file, text.replace(from, to));
};

describe("verifier", () => {
  test("passes the untouched template", async () => {
    expect(await failures(() => {})).toEqual([]);
  });

  test("catches an accepted solution with a bug", async () => {
    const failed = await failures(dir => replaceIn(path.join(dir, "submissions/accepted/solution.ts"), "nums[i] > best", "nums[i] < best"));
    expect(failed).toContain("accepted/solution.ts matches every sample answer");
    expect(failed).toContain("accepted and time_limit_exceeded submissions agree on every test");
    expect(failed.some(f => f.startsWith("property:"))).toBe(true);
  });

  test("catches a bug the samples miss, using random tests", async () => {
    // Wrong only when the maximum is the last element of an array of 4 or more.
    const failed = await failures(dir => replaceIn(path.join(dir, "submissions/accepted/solution.ts"),
      "for (let i = 1; i < nums.length; i++)", "for (let i = 1; i < (nums.length > 3 ? nums.length - 1 : nums.length); i++)"));
    expect(failed).not.toContain("accepted/solution.ts matches every sample answer");
    expect(failed).toContain("accepted and time_limit_exceeded submissions agree on every test");
  });

  test("catches a wrong_answer submission that the tests don't reject", async () => {
    const failed = await failures(dir => writeFileSync(path.join(dir, "submissions/wrong_answer/actually_right.ts"),
      "export function findMax(nums: number[]): number { return Math.max(...nums); }\n"));
    expect(failed).toEqual(["wrong_answer/actually_right.ts is rejected"]);
  });

  test("catches an invalid_input the validator accepts", async () => {
    const failed = await failures(dir => writeFileSync(path.join(dir, "data/invalid_input/looks_fine.in"), '{"nums":[1,2,3]}\n'));
    expect(failed).toEqual(["input validator rejects every invalid_input"]);
  });

  test("catches a generator producing inputs outside the constraints", async () => {
    const failed = await failures(dir => replaceIn(path.join(dir, "generators/generators.ts"), "single: { nums: [3] }", "single: { nums: [] }"));
    expect(failed).toContain("input validator accepts every test input");
  });

  test("catches a solution that is too slow", async () => {
    const failed = await failures(dir => replaceIn(path.join(dir, "submissions/accepted/solution.ts"),
      "return best; // @line return", "if (nums.length > 50000) { const end = performance.now() + 300; while (performance.now() < end); }\n    return best; // @line return"));
    expect(failed).toContain("accepted/solution.ts runs the large tests within 100 ms");
  });

  test("catches a trace that disagrees with the solution", async () => {
    const failed = await failures(dir => replaceIn(path.join(dir, "visualization/trace.ts"), "result: best", "result: best + 1"));
    expect(failed).toEqual(["trace highlights real lines and ends with the solution's answer"]);
  });

  test("catches a trace that points at a line label the solution doesn't have", async () => {
    const failed = await failures(dir => replaceIn(path.join(dir, "submissions/accepted/solution.ts"), "// @line compare", ""));
    expect(failed).toEqual(["trace highlights real lines and ends with the solution's answer"]);
  });

  test("rejects a problem.yaml that doesn't match the schema", async () => {
    await expect(failures(dir => replaceIn(path.join(dir, "problem.yaml"), "type: \"int[]\"", "type: float"))).rejects.toThrow(/input\.0\.type/);
  });
});
