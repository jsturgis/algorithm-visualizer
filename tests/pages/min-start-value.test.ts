// @vitest-environment jsdom
// What the Minimum Start Value page shows. Answers are checked against the brute force by tests/packages.test.ts.
import { beforeEach, describe, expect, test } from "vitest";
import mod from "virtual:algorithm/min-start-value";
import { buildTrace } from "../../problems/min-start-value/visualization/trace.ts";
import { mountPage, type Page } from "./helpers.ts";

let p: Page;
beforeEach(() => { p = mountPage(mod); });

describe("Minimum Start Value: the trace", () => {
  test("tracks the running total and the lowest point", () => {
    const steps = buildTrace({ nums: [-3, 2, -3, 4, 2] }).filter(s => s.line === "min");
    expect(steps.map(s => [s.vars!.total, s.vars!.minVal])).toEqual([[-3, -3], [-1, -3], [-4, -4], [0, -4], [2, -4]]);
  });

  test("the last step lifts the chart by the answer", () => {
    const last = buildTrace({ nums: [-3, 2, -3, 4, 2] }).at(-1)!;
    expect(last).toMatchObject({ lift: 5, minIdx: 3, result: 5 });
  });
});

describe("Minimum Start Value: the page", () => {
  test("default example ends with startValue 5 and the chart lifted", () => {
    p.toEnd();
    expect(p.varValue("startValue")).toBe("5");
    expect(p.varValue("minVal")).toBe("-4");
    expect(p.$("#chart-label").textContent).toBe("Running total with startValue = 5");
  });

  test("shows one box per number and one chart point per prefix", () => {
    expect(p.texts("#strip .box")).toEqual(["-3", "2", "-3", "4", "2"]);
    expect(p.$$("#chart circle")).toHaveLength(6);
  });

  test("highlights the matching code as it steps", () => {
    p.click("next");
    expect(p.has("#b0", "cursor")).toBe(true);
    expect(p.highlightedCode()).toBe("for (const num of nums) {");
    p.click("next");
    expect(p.highlightedCode()).toBe("total += num;");
  });

  test("runs a custom array", () => {
    p.run({ nums: "1, -2, -3" });
    p.toEnd();
    expect(p.varValue("startValue")).toBe("5");
    expect(p.$$("#strip .box")).toHaveLength(3);
  });

  test.each([
    ["1, 2.5", "whole numbers"],
    ["", "between 1 and 12"],
    ["1,2,3,4,5,6,7,8,9,10,11,12,13", "between 1 and 12"],
    ["1, 101", "between -100 and 100"],
  ])("rejects %j", (nums, message) => {
    p.run({ nums });
    expect(p.error()).toContain(message);
  });
});
