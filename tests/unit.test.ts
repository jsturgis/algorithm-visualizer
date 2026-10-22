import { describe, expect, test } from "vitest";
import { toDisplayCode } from "../build/code.ts";
import { checkInput, formatField, parseField, withLimits } from "../src/runtime/constraints.ts";
import type { Param } from "../src/runtime/types.ts";
import { isOutdatedBuild } from "../src/runtime/editing.ts";

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

  test("maps each label to its 1-based line numbers", () => {
    expect(toDisplayCode(src).labels).toEqual({ init: [2], add: [3] });
  });

  test("a label on several lines makes a block highlighted together", () => {
    expect(toDisplayCode("left++; // @line move\nright--; // @line move\nreturn x; // @line done").labels).toEqual({ move: [1, 2], done: [3] });
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

describe("isOutdatedBuild", () => {
  test.each([
    "Failed to fetch dynamically imported module: https://x.test/assets/panel-A1.js",   // Chrome
    "Importing a module script failed.",                                                 // Safari
    "error loading dynamically imported module: https://x.test/assets/editor-B2.js",   // Firefox
    "Unable to preload CSS for /assets/panel-C3.css",                                   // Vite
  ])("recognizes %s", message => {
    expect(isOutdatedBuild(new TypeError(message))).toBe(true);
  });

  test("ignores other errors", () => {
    expect(isOutdatedBuild(new Error("The type checker stopped."))).toBe(false);
  });
});

describe("constraints for string, string[] and int[][] inputs", () => {
  const s: Param = { name: "s", type: "string", length: [1, 5], chars: "[01]" };
  const chars: Param = { name: "letters", type: "string[]", length: [1, 4], inner_length: [1, 1], chars: "[a-z]" };
  const queries: Param = { name: "queries", type: "int[][]", length: [1, 3], inner_length: [2, 2], value: [0, 9] };

  test("accept valid values", () => {
    expect(checkInput({ s: "0110", letters: ["a", "b"], queries: [[0, 1], [2, 9]] }, [s, chars, queries])).toEqual([]);
  });

  test.each([
    [{ s: 5 }, [s], "s must be text."],
    [{ s: "" }, [s], "s must have between 1 and 5 characters."],
    [{ s: "012" }, [s], 's can\'t contain "2".'],
    [{ letters: "ab" }, [chars], "letters must be a list of text items."],
    [{ letters: ["a", "bc"] }, [chars], "Every item of letters must be a single character."],
    [{ letters: ["a", "B"] }, [chars], 'letters can\'t contain "B".'],
    [{ letters: ["a", "b", "c", "d", "e"] }, [chars], "letters must have between 1 and 4 items."],
    [{ queries: [1, 2] }, [queries], "queries must be a list of lists of whole numbers."],
    [{ queries: [[1, 2, 3]] }, [queries], "Every entry of queries must have between 2 and 2 numbers."],
    [{ queries: [[1, 10]] }, [queries], "Every number in queries must be between 0 and 9."],
    [{ queries: [] }, [queries], "queries must have between 1 and 3 entries."],
  ])("%j → %s", (input, params, message) => {
    expect(checkInput(input, params as Param[])).toContain(message);
  });

  test("parse and format round-trip", () => {
    expect(parseField(" a b ", s)).toBe(" a b ");          // strings are kept as typed
    expect(parseField("h, e , l", chars)).toEqual(["h", "e", "l"]);
    expect(formatField(["h", "e", "l"], chars)).toBe("h, e, l");
    expect(parseField("[0, 1], [2, 3]", queries)).toEqual([[0, 1], [2, 3]]);
    expect(parseField("[[0, 1]]", queries)).toEqual([[0, 1]]);
    expect(formatField([[0, 1], [2, 3]], queries)).toBe("[0, 1], [2, 3]");
    expect(() => parseField("[0, 1", queries)).toThrow(/like \[0, 1\], \[2, 3\]/);
    expect(() => parseField("[0, x]", queries)).toThrow(/like \[0, 1\], \[2, 3\]/);
  });
});
