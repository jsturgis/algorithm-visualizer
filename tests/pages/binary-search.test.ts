// @vitest-environment jsdom
// What the Binary Search page shows. Answers are checked against the linear scan by tests/packages.test.ts.
import { beforeEach, describe, expect, test } from "vitest";
import mod from "virtual:algorithm/binary-search";
import { buildTrace } from "../../problems/binary-search/visualization/trace.ts";
import { mountPage, type Page } from "./helpers.ts";

let p: Page;
beforeEach(() => { p = mountPage(mod); });
const nums = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];

describe("Binary Search: the trace", () => {
  test("checks indices 4, 7, 5 to find 23", () => {
    expect(buildTrace({ nums, target: 23 }).filter(s => s.line === "mid").map(s => s.mid)).toEqual([4, 7, 5]);
  });

  test("the range only ever shrinks", () => {
    const steps = buildTrace({ nums, target: 91 });
    for (let k = 1; k < steps.length; k++) {
      expect(steps[k].lo).toBeGreaterThanOrEqual(steps[k - 1].lo);
      expect(steps[k].hi).toBeLessThanOrEqual(steps[k - 1].hi);
    }
  });
});

describe("Binary Search: the page", () => {
  test("default example finds 23 at index 5", () => {
    p.toEnd();
    expect(p.varValue("result")).toBe("5");
    expect(p.has("#b5", "found")).toBe(true);
    expect(p.highlightedCode()).toBe("if (nums[mid] === target) return mid;");
  });

  test("labels lo, mid and hi under the boxes", () => {
    p.until(() => p.highlightedCode()!.startsWith("const mid"));
    expect(p.$("#p0").textContent).toBe("lo");
    expect(p.$("#p4").textContent).toBe("mid");
    expect(p.$("#p9").textContent).toBe("hi");
  });

  test("fades out the half that's ruled out", () => {
    p.until(() => p.note().includes("lo = 5"));
    // The old mid stays highlighted on the step that moves lo past it...
    expect([0, 1, 2, 3].every(k => p.has("#b" + k, "out"))).toBe(true);
    expect(p.has("#b4", "cursor")).toBe(true);
    // ...then fades with the rest of the ruled-out half.
    p.click("next");
    expect([0, 1, 2, 3, 4].every(k => p.has("#b" + k, "out"))).toBe(true);
    expect(p.has("#b5", "out")).toBe(false);
  });

  test("sorts and de-duplicates a custom array before searching", () => {
    p.run({ nums: "9, 1, 5, 3, 5", target: "5" });
    expect(p.texts("#strip .box")).toEqual(["1", "3", "5", "9"]);
    p.toEnd();
    expect(p.varValue("result")).toBe("2");
  });

  test("reports a missing target", () => {
    p.run({ nums: "1, 3, 5", target: "4" });
    p.toEnd();
    expect(p.varValue("result")).toBe("-1");
    expect(p.$("#range").textContent).toBe("nothing left to search");
    expect(p.highlightedCode()).toBe("return -1;");
  });

  test.each([
    [{ target: "x" }, "target must be a whole number"],
    [{ target: "10000" }, "target must be between -9,999 and 9,999"],
    [{ nums: "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17" }, "between 1 and 16"],
  ])("rejects %j", (input, message) => {
    p.run(input);
    expect(p.error()).toContain(message);
  });
});
