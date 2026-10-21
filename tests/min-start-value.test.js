import { describe, test, expect, beforeEach } from "vitest";
import { loadPage, rng, randInt } from "./helpers.js";

// Reference answer: the smallest positive start that keeps every running total ≥ 1.
function bruteForce(nums) {
  for (let start = 1; ; start++) {
    let total = start, ok = true;
    for (const n of nums) if ((total += n) < 1) { ok = false; break; }
    if (ok) return start;
  }
}

let p;
beforeEach(async () => { p = await loadPage("algorithms/min-start-value/index.html"); });
const answer = nums => p.window.buildTrace(nums).at(-1).vars.startValue;

describe("Minimum Start Value: the trace", () => {
  test.each([
    [[-3, 2, -3, 4, 2], 5],
    [[1, 2], 1],
    [[1, -2, -3], 5],
    [[0], 1],
    [[-5], 6],
  ])("%j needs startValue %i", (nums, expected) => {
    expect(answer(nums)).toBe(expected);
  });

  test("matches brute force on 300 random arrays", () => {
    const rand = rng(1);
    for (let t = 0; t < 300; t++) {
      const nums = Array.from({ length: randInt(rand, 1, 12) }, () => randInt(rand, -20, 20));
      expect(answer(nums), JSON.stringify(nums)).toBe(bruteForce(nums));
    }
  });

  test("tracks the running total and the lowest point", () => {
    const steps = p.window.buildTrace([-3, 2, -3, 4, 2]);
    const afterLine5 = steps.filter(s => s.line === 5).map(s => [s.vars.total, s.vars.minVal]);
    expect(afterLine5).toEqual([[-3, -3], [-1, -3], [-4, -4], [0, -4], [2, -4]]);
  });

  test("the last step lifts the chart by the answer", () => {
    const last = p.window.buildTrace([-3, 2, -3, 4, 2]).at(-1);
    expect(last.lift).toBe(5);
    expect(last.minIdx).toBe(3);
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
    expect(p.$$("#strip .box").map(b => b.textContent)).toEqual(["-3", "2", "-3", "4", "2"]);
    expect(p.$$("#chart circle")).toHaveLength(6);
  });

  test("marks the number being read", () => {
    p.click("next");
    expect(p.$("#b0").classList.contains("cursor")).toBe(true);
  });

  test("runs a custom array", () => {
    p.run({ arr: "1, -2, -3" });
    p.toEnd();
    expect(p.varValue("startValue")).toBe("5");
    expect(p.$$("#strip .box")).toHaveLength(3);
  });

  test.each([
    ["1, 2.5", "whole numbers"],
    ["", "between 1 and 12"],
    ["1,2,3,4,5,6,7,8,9,10,11,12,13", "between 1 and 12"],
  ])("rejects %j", (arr, message) => {
    p.run({ arr });
    expect(p.error()).toContain(message);
  });
});
