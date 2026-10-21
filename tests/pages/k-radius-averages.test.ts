// @vitest-environment jsdom
// What the K Radius Subarray Averages page shows. Answers are checked against the brute force by tests/packages.test.ts.
import { beforeEach, describe, expect, test } from "vitest";
import mod from "virtual:algorithm/k-radius-averages";
import { buildTrace } from "../../problems/k-radius-averages/visualization/trace.ts";
import { mountPage, type Page } from "./helpers.ts";

let p: Page;
beforeEach(() => { p = mountPage(mod); });
const example = { nums: [7, 4, 3, 9, 1, 8, 5, 2, 6], k: 3 };

describe("K Radius Subarray Averages: the trace", () => {
  test("builds prefix so prefix[j] is the sum of the first j numbers", () => {
    expect(buildTrace(example).at(-1)!.prefix).toEqual([0, 7, 11, 14, 23, 24, 32, 37, 39, 45]);
  });

  test("each window sum is prefix[i + k + 1] − prefix[i − k]", () => {
    const steps = buildTrace(example).filter(s => s.line === "window");
    expect(steps.map(s => [s.center, s.add, s.sub, s.vars!.sum])).toEqual([[3, 7, 0, 37], [4, 8, 1, 32], [5, 9, 2, 34]]);
  });
});

describe("K Radius Subarray Averages: the page", () => {
  const row = (id: string) => p.texts(`#${id} .box`);

  test("default example ends with the expected avgs and prefix rows", () => {
    p.toEnd();
    expect(row("avgs")).toEqual(["-1", "-1", "-1", "5", "4", "4", "-1", "-1", "-1"]);
    expect(row("prefix")).toEqual(["0", "7", "11", "14", "23", "24", "32", "37", "39", "45"]);
  });

  test("prefix has one more cell than nums, and nums/avgs start with a spacer", () => {
    expect(p.$$("#prefix .box")).toHaveLength(10);
    expect(p.$$("#nums .box")).toHaveLength(9);
    expect(p.$("#nums .spacer")).not.toBeNull();
    expect(p.$("#avgs .spacer")).not.toBeNull();
  });

  test("highlights the window and the two prefix cells it subtracts", () => {
    p.until(() => p.highlightedCode()!.startsWith("const sum"));
    expect([0, 1, 2, 3, 4, 5, 6].every(j => p.has("#n" + j, "done"))).toBe(true);
    expect(p.has("#n7", "done")).toBe(false);
    expect(p.$("#pn3").textContent).toBe("center");
    expect(p.has("#p7", "cursor")).toBe(true);
    expect(p.$("#pp7").textContent).toBe("i+k+1");
    expect(p.has("#p0", "sub")).toBe(true);
    expect(p.$("#pp0").textContent).toBe("i−k");
    expect(p.$("#sum").textContent).toBe("prefix[7] − prefix[0] = 37 − 0 = 37");
  });

  test("runs custom input", () => {
    p.run({ nums: "2, 3, 1, 5, 9", k: "1" });
    p.toEnd();
    expect(row("avgs")).toEqual(["-1", "2", "3", "5", "-1"]);
  });

  test("stops early when the window doesn't fit", () => {
    p.run({ nums: "8", k: "9" });
    p.toEnd();
    expect(row("avgs")).toEqual(["-1"]);
    expect(p.highlightedCode()).toBe("if (size > n) return avgs;");
  });

  test.each([
    [{ nums: "1, -2, 3", k: "1" }, "between 0 and 100,000"],
    [{ k: "-1" }, "k must be between 0 and 9"],
    [{ k: "1.5" }, "k must be a whole number"],
    [{ k: "10" }, "k must be between 0 and 9"],
  ])("rejects %j", (input, message) => {
    p.run(input);
    expect(p.error()).toContain(message);
  });
});
