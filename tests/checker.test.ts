// The code checker behind the editor: diagnostics, completions and hover for a learner's solution.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { toDisplayCode } from "../build/code.ts";
import { loadPackages } from "../build/package.ts";
import { loadTsLibs } from "../build/ts-libs.ts";
import { createChecker } from "../src/editor/checker.ts";
import { contractOf } from "../src/runtime/types.ts";

const libs = loadTsLibs();
const packages = loadPackages({ templates: true });
const kRadius = packages.find(p => p.slug === "k-radius-averages")!;
const checker = createChecker(contractOf(kRadius.meta), libs);
const reference = kRadius.code.lines.join("\n");

/** The reference with `from` replaced by `to` (which must exist). */
const edit = (from: string, to: string) => {
  if (!reference.includes(from)) throw new Error(`"${from}" not in reference`);
  return reference.replace(from, to);
};
const lineOf = (src: string, needle: string) => src.slice(0, src.indexOf(needle)).split("\n").length;

describe.each(packages)("problems/$slug", pkg => {
  const c = createChecker(contractOf(pkg.meta), libs);

  test("the displayed accepted solution has no problems", () => {
    expect(c.diagnostics(pkg.code.lines.join("\n"))).toEqual([]);
  });

  test.each(pkg.paths.wrongAnswer)("wrong answer %s still type-checks (wrong isn't the same as not compiling)", file => {
    expect(c.diagnostics(toDisplayCode(readFileSync(file, "utf8")).lines.join("\n"))).toEqual([]);
  });
});

describe("diagnostics", () => {
  test("a syntax error is reported as syntax at its line and column", () => {
    const src = edit("for (let i = k;", "for (let i = k");
    const [first] = checker.diagnostics(src);
    expect(first).toMatchObject({ category: "syntax", line: lineOf(src, "for (let i = k i"), severity: "error" });
    expect(first.column).toBeGreaterThan(1);
  });

  test("only syntax errors are reported until the code parses", () => {
    expect(checker.diagnostics(edit("for (let i = k;", "for (let i = k")).every(d => d.category === "syntax")).toBe(true);
  });

  test("a type error is reported as type on its line", () => {
    const src = edit("prefix[i + 1] = prefix[i] + nums[i]", 'prefix[i + 1] = "x"');
    expect(checker.diagnostics(src)).toEqual([
      expect.objectContaining({ category: "type", line: lineOf(src, '"x"'), message: "Type 'string' is not assignable to type 'number'." }),
    ]);
  });

  test("a renamed entry function is a contract error on line 1", () => {
    const [d, ...rest] = checker.diagnostics(edit("function getAverages", "function averages"));
    expect(rest).toEqual([]);
    expect(d).toMatchObject({ category: "contract", line: 1, column: 1 });
    expect(d.message).toBe("Define a function named getAverages: getAverages(nums: number[], k: number): number[].");
  });

  test.each([
    ["a wrong parameter type", "k: number)", "k: string)"],
    ["an extra required parameter", "k: number)", "k: number, extra: number)"],
    ["a wrong return type", "): number[] {", "): number {"],
  ])("%s is a contract error on the function's name", (_, from, to) => {
    const src = edit(from, to);
    const contract = checker.diagnostics(src).filter(d => d.category === "contract");
    expect(contract).toHaveLength(1);
    expect(contract[0]).toMatchObject({ line: 1, column: src.indexOf("getAverages") + 1, to: src.indexOf("getAverages") + "getAverages".length });
    expect(contract[0].message).toMatch(/^getAverages must accept \(nums: number\[\], k: number\) and return number\[\]\./);
  });

  test("dropping a trailing parameter still fits the contract", () => {
    // TypeScript allows a function with fewer parameters wherever more are passed.
    const src = "function getAverages(nums: number[]): number[] { return nums.map(() => -1); }";
    expect(checker.diagnostics(src)).toEqual([]);
  });

  test("the entry can be an arrow function in a const", () => {
    expect(checker.diagnostics("const getAverages = (nums: number[], k: number): number[] => nums.map(n => n + k);")).toEqual([]);
  });

  test("non-erasable TypeScript like enum is rejected as syntax, as in the repo", () => {
    const src = reference + "\nenum E { A }";
    expect(checker.diagnostics(src)).toEqual([expect.objectContaining({ category: "syntax", line: lineOf(src, "enum") })]);
  });

  test("grammar errors found while type checking are labelled syntax", () => {
    const src = reference.replace("return avgs; // ", "return avgs; // ").replace(/return avgs;\n}$/, "if (n) const s = 1;\n    return avgs;\n}");
    expect(checker.diagnostics(src)).toEqual([expect.objectContaining({ category: "syntax", line: lineOf(src, "if (n) const") })]);
  });

  test("there is no DOM, and no hint to change compiler options", () => {
    const [d] = checker.diagnostics(reference + "\ndocument.title;");
    expect(d.message).toBe("Cannot find name 'document'.");
  });

  test("strict mode is on", () => {
    const [d] = checker.diagnostics(edit("const n = nums.length", "const n = (nums as any).foo ?? nums.length").replace("(nums: number[]", "(nums"));
    expect(d.message).toMatch(/implicitly has an 'any' type/);
  });

  test("no diagnostic points past the learner's code", () => {
    for (const src of [edit("getAverages", "x"), edit("): number[] {", "): string {"), "", "function getAverages("]) {
      for (const d of checker.diagnostics(src)) expect(d.to).toBeLessThanOrEqual(src.length);
    }
  });

  test("an empty editor asks for the function", () => {
    expect(checker.diagnostics("")).toEqual([expect.objectContaining({ category: "contract", line: 1, from: 0, to: 0 })]);
  });
});

describe("completions", () => {
  test("after Math. they include floor and trunc", () => {
    const src = edit("Math.floor(sum / size)", "Math.(sum / size)");
    const result = checker.completions(src, src.indexOf("Math.") + 5)!;
    expect(result.from).toBe(src.indexOf("Math.") + 5);
    expect(result.items.map(i => i.label)).toEqual(expect.arrayContaining(["floor", "trunc", "max", "min"]));
  });

  test("inside the function they include its parameters and locals, but never the hidden contract", () => {
    const at = reference.indexOf("return avgs");
    const labels = checker.completions(reference, at)!.items.map(i => i.label);
    expect(labels).toEqual(expect.arrayContaining(["nums", "k", "avgs", "prefix", "size"]));
    expect(labels.some(l => l.includes("contract"))).toBe(false);
  });

  test("a partly typed word starts the completion at the word", () => {
    const src = edit("return avgs;", "return av");
    const result = checker.completions(src, src.indexOf("return av") + 9)!;
    expect(result.from).toBe(src.indexOf("return av") + 7);
    expect(result.items.map(i => i.label)).toContain("avgs");
  });

  test("array methods are offered on nums", () => {
    const src = edit("const n = nums.length", "const n = nums.");
    const labels = checker.completions(src, src.indexOf("nums.") + 5)!.items.map(i => i.label);
    expect(labels).toEqual(expect.arrayContaining(["length", "map", "fill", "slice", "toSorted"]));
  });
});

describe("hover", () => {
  test("a parameter shows its declared type", () => {
    const at = reference.indexOf("nums.length");
    expect(checker.hover(reference, at)).toMatchObject({ text: "(parameter) nums: number[]", from: at, to: at + 4 });
  });

  test("a local shows its inferred type", () => {
    expect(checker.hover(reference, reference.indexOf("size"))!.text).toBe("const size: number");
  });

  test("a library method shows its signature and documentation", () => {
    const info = checker.hover(reference, reference.indexOf("floor"))!;
    expect(info.text).toMatch(/floor\(x: number\): number/);
    expect(info.docs).toMatch(/greatest integer/i);
  });

  test("whitespace has nothing to show", () => {
    expect(checker.hover(reference, reference.indexOf("\n") + 1)).toBeNull();
  });
});
