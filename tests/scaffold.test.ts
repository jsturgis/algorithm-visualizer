// `npm run new` scaffolds a package from its contract. Each test scaffolds into a temp folder and judges the result
// with the real loader and verifier, so the scaffold is held to the same checks as a hand-written package.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { loadPackage, PROBLEMS, ROOT } from "../build/package.ts";
import { newPackage, type PackageSpec } from "../build/scaffold.ts";
import { verifyPackage } from "../build/verify.ts";
import { PARAM_TYPES, RETURN_TYPES } from "../src/runtime/types.ts";

// Inside the repo so the scaffolded files can import fast-check and the runtime.
const TMP = path.join(ROOT, "tests/.tmp/scaffold");
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

let n = 0;
const freshRoot = () => path.join(TMP, `case-${++n}`);

const findMax: PackageSpec = {
  slug: "find-max",
  title: "Find the Maximum",
  entry: "findMax",
  input: [{ name: "nums", type: "int[]", length: [1, 100000], value: [-1000000, 1000000] }],
  returns: "int",
};

/** Scaffold `spec`, verify it, and return the checks by outcome. */
async function scaffold(spec: PackageSpec) {
  const root = freshRoot();
  newPackage(spec, { root });
  const pkg = loadPackage(path.join(root, spec.slug));
  const checks = await verifyPackage(pkg);
  return {
    pkg,
    passed: checks.filter(c => c.ok).map(c => c.name),
    failed: Object.fromEntries(checks.filter(c => !c.ok).map(c => [c.name, c.detail ?? ""])),
  };
}

// The checks a fresh scaffold must already pass: everything that doesn't need the algorithm itself.
const STRUCTURAL = [
  "accepted solution type-checks against the problem contract",
  "every line of the solution can be highlighted",
  "input validator accepts every test input",
  "input validator rejects every invalid_input",
  "visualization default input is valid",
];

describe("newPackage", () => {
  test("a fresh scaffold passes the structural checks and fails until the solution is written", async () => {
    const { passed, failed } = await scaffold(findMax);
    expect(passed).toEqual(expect.arrayContaining(STRUCTURAL));
    expect(failed["accepted/solution.ts matches every sample answer"]).toContain("submissions/accepted/solution.ts");
  });

  test("given samples, a solution and a brute force, only the trace is left to write", async () => {
    const { pkg, failed } = await scaffold({
      ...findMax,
      statement: "Given a non-empty array of integers `nums`, return its largest element.",
      explanation: "Walk the array once, remembering the largest value seen so far.",
      samples: [{ input: { nums: [4, 9, 2] }, answer: 9 }, { input: { nums: [-3, -1] }, answer: -1 }],
      solution: [
        "function findMax(nums: number[]): number {",
        "  let best = nums[0];",
        "  for (let i = 1; i < nums.length; i++) {",
        "    if (nums[i] > best) best = nums[i];",
        "  }",
        "  return best;",
        "}",
      ].join("\n"),
      bruteForce: "function findMax(nums: number[]): number {\n  return [...nums].sort((a, b) => a - b).at(-1)!;\n}",
    });
    expect(Object.keys(failed)).toEqual(["trace highlights real lines and ends with the solution's answer"]);
    expect(pkg.statement).toContain("return its largest element");
    expect(pkg.meta.explanation).toBe("Walk the array once, remembering the largest value seen so far.");
    expect(pkg.samples.map(s => s.answer)).toEqual([9, -1]);
    expect(pkg.meta.visualization.default).toEqual({ nums: [4, 9, 2] });
  });

  test("writes constraints that aren't ranges as notes, with a validator stub to enforce them", async () => {
    const { pkg, passed } = await scaffold({ ...findMax, constraints_note: ["nums is sorted in ascending order."], validator: true });
    expect(pkg.meta.constraints_note).toEqual(["nums is sorted in ascending order."]);
    expect(pkg.paths.validator).toBeDefined();
    expect(passed).toEqual(expect.arrayContaining(STRUCTURAL));
  });

  test("the stubs are all that stand between a scaffold and a finished package", async () => {
    const root = freshRoot();
    newPackage(findMax, { root });
    const dir = path.join(root, findMax.slug), template = path.join(PROBLEMS, "_template");
    rmSync(path.join(dir, "submissions"), { recursive: true });
    cpSync(path.join(template, "submissions"), path.join(dir, "submissions"), { recursive: true });
    cpSync(path.join(template, "data/sample"), path.join(dir, "data/sample"), { recursive: true });
    for (const f of ["visualization/trace.ts", "visualization/view.ts"]) {
      const to = path.join(dir, f);
      writeFileSync(to, readFileSync(path.join(template, f), "utf8")
        .replaceAll("../../../src/", path.relative(path.dirname(to), path.join(ROOT, "src")) + "/"));
    }
    const checks = await verifyPackage(loadPackage(dir));
    expect(checks.filter(c => !c.ok)).toEqual([]);
  });

  test.each(PARAM_TYPES)("scaffolds a %s parameter, with default constraints", async type => {
    const { passed } = await scaffold({ ...findMax, slug: `param-${type.replaceAll("[]", "-list")}`, input: [{ name: "x", type }] });
    expect(passed).toEqual(expect.arrayContaining(STRUCTURAL));
  });

  test.each<[string, Partial<PackageSpec>, RegExp]>([
    ["a slug that isn't kebab-case", { slug: "Find_Max" }, /slug/],
    ["a slug starting with _", { slug: "_find-max" }, /slug/],
    ["an entry that isn't an identifier", { entry: "find-max" }, /entry/],
    ["chars on an int[]", { input: [{ name: "nums", type: "int[]", chars: "[01]" }] }, /chars is only for string/],
    ["a reversed range", { input: [{ name: "nums", type: "int[]", length: [10, 1] }] }, /range must be \[min, max\]/],
    ["no parameters", { input: [] }, /input/],
  ])("rejects %s and writes nothing", (_, change, message) => {
    const root = freshRoot();
    expect(() => newPackage({ ...findMax, ...change }, { root })).toThrow(message);
    expect(existsSync(root)).toBe(false);
  });

  test("a dry run lists the files it would write, and writes nothing", () => {
    const root = freshRoot();
    const files = newPackage(findMax, { root, dryRun: true });
    expect(files.map(f => path.relative(path.join(root, "find-max"), f))).toEqual(expect.arrayContaining([
      "problem.yaml", "submissions/accepted/solution.ts", "generators/generators.ts", "visualization/trace.ts",
    ]));
    expect(existsSync(root)).toBe(false);
  });

  test("refuses to overwrite an existing package", () => {
    const root = freshRoot();
    newPackage(findMax, { root });
    expect(() => newPackage(findMax, { root })).toThrow(/already exists/);
  });

  test("can scaffold a template folder (starting with _) when asked", () => {
    const root = freshRoot();
    newPackage({ ...findMax, slug: "_find-max" }, { root, template: true });
    expect(readdirSync(root)).toEqual(["_find-max"]);
  });

  test.each(RETURN_TYPES)("scaffolds a %s return type", async returns => {
    const { passed } = await scaffold({ ...findMax, slug: `returns-${returns.replaceAll("[]", "-list")}`, returns });
    expect(passed).toContain("accepted solution type-checks against the problem contract");
  });
});
