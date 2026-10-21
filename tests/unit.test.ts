import { describe, expect, test } from "vitest";
import { toDisplayCode } from "../build/code.ts";
import { checkInput, formatField, parseField, withLimits } from "../src/runtime/constraints.ts";
import type { Param } from "../src/runtime/types.ts";

describe("toDisplayCode", () => {
  const src = [
    "export function f(nums: number[]): number {",
    "    let total = 0; // @line init",
    "    for (const n of nums) total += n;   //   @line add  ",
    "    return total; // a normal comment",
    "}",
    "",
  ].join("\n");

  test("removes @line markers and export, keeps everything else", () => {
    expect(toDisplayCode(src).lines).toEqual([
      "function f(nums: number[]): number {",
      "    let total = 0;",
      "    for (const n of nums) total += n;",
      "    return total; // a normal comment",
      "}",
    ]);
  });

  test("maps each label to its 1-based line number", () => {
    expect(toDisplayCode(src).labels).toEqual({ init: 2, add: 3 });
  });

  test("rejects duplicate labels", () => {
    expect(() => toDisplayCode("a // @line x\nb // @line x")).toThrow(/Duplicate @line label "x"/);
  });
});

describe("constraints", () => {
  const params: Param[] = [
    { name: "nums", type: "int[]", length: [1, 3], value: [0, 9] },
    { name: "k", type: "int", value: [0, 5] },
  ];

  test("accepts a valid input", () => {
    expect(checkInput({ nums: [0, 9], k: 5 }, params)).toEqual([]);
  });

  test.each([
    [{ nums: [], k: 1 }, "nums must have between 1 and 3 numbers."],
    [{ nums: [1, 2, 3, 4], k: 1 }, "nums must have between 1 and 3 numbers."],
    [{ nums: [10], k: 1 }, "Every number in nums must be between 0 and 9."],
    [{ nums: [1.5], k: 1 }, "nums must be a list of whole numbers."],
    [{ nums: "1", k: 1 }, "nums must be a list of whole numbers."],
    [{ nums: [1], k: 6 }, "k must be between 0 and 5."],
    [{ nums: [1] }, "k must be a whole number."],
    [{ nums: [1], k: 1, extra: 2 }, "Unexpected input: extra."],
  ])("%j → %s", (input, message) => {
    expect(checkInput(input, params)).toContain(message);
  });

  test("withLimits tightens only the listed params", () => {
    expect(withLimits(params, { nums: { length: [1, 2] } })).toEqual([
      { name: "nums", type: "int[]", length: [1, 2], value: [0, 9] },
      { name: "k", type: "int", value: [0, 5] },
    ]);
  });

  test("parseField and formatField round-trip", () => {
    expect(parseField(" 1, 2  3,", params[0])).toEqual([1, 2, 3]);
    expect(formatField([1, 2, 3], params[0])).toBe("1, 2, 3");
    expect(parseField(" 4 ", params[1])).toBe(4);
    expect(() => parseField("1, x", params[0])).toThrow(/whole numbers/);
    expect(() => parseField("", params[1])).toThrow(/whole number/);
  });
});
