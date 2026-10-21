import { describe, test, expect, beforeEach } from "vitest";
import { loadPage, rng, randInt } from "./helpers.js";

let p;
beforeEach(async () => { p = await loadPage("algorithms/binary-search/index.html"); });
const trace = (nums, target) => p.window.buildTrace({ nums, target });
const result = (nums, target) => trace(nums, target).at(-1).vars.result;

describe("Binary Search: the trace", () => {
  const nums = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];

  test.each(nums.map((v, i) => [v, i]))("finds %i at index %i", (target, index) => {
    expect(result(nums, target)).toBe(index);
  });

  test.each([1, 3, 40, 100])("returns -1 for missing %i", target => {
    expect(result(nums, target)).toBe(-1);
  });

  test("checks indices 4, 7, 5 to find 23", () => {
    const mids = trace(nums, 23).filter(s => s.line === 4).map(s => s.mid);
    expect(mids).toEqual([4, 7, 5]);
  });

  test("halves the range: never more than ⌊log2 n⌋ + 1 checks", () => {
    const rand = rng(2);
    for (let t = 0; t < 300; t++) {
      const arr = [...new Set(Array.from({ length: randInt(rand, 1, 16) }, () => randInt(rand, -50, 50)))].sort((a, b) => a - b);
      const target = randInt(rand, -55, 55);
      const steps = trace(arr, target);
      const expected = arr.indexOf(target);
      expect(steps.at(-1).vars.result, `${target} in ${arr}`).toBe(expected);
      expect(steps.filter(s => s.line === 4).length).toBeLessThanOrEqual(Math.floor(Math.log2(arr.length)) + 1);
    }
  });

  test("the range only ever shrinks", () => {
    const steps = trace(nums, 91);
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
    expect(p.$("#b5").classList.contains("found")).toBe(true);
  });

  test("labels lo, mid and hi under the boxes", () => {
    p.click("next"); p.click("next"); p.click("next");   // mid computed
    expect(p.$("#p0").textContent).toBe("lo");
    expect(p.$("#p4").textContent).toBe("mid");
    expect(p.$("#p9").textContent).toBe("hi");
  });

  test("fades out the half that's ruled out", () => {
    while (!p.note().includes("lo = 5")) p.click("next");
    // The old mid stays highlighted on the step that moves lo past it...
    expect([0, 1, 2, 3].every(k => p.$("#b" + k).classList.contains("out"))).toBe(true);
    expect(p.$("#b4").classList.contains("cursor")).toBe(true);
    // ...then fades with the rest of the ruled-out half.
    p.click("next");
    expect([0, 1, 2, 3, 4].every(k => p.$("#b" + k).classList.contains("out"))).toBe(true);
    expect(p.$("#b5").classList.contains("out")).toBe(false);
  });

  test("sorts a custom array before searching", () => {
    p.run({ arr: "9, 1, 5, 3", target: "5" });
    expect(p.$$("#strip .box").map(b => b.textContent)).toEqual(["1", "3", "5", "9"]);
    p.toEnd();
    expect(p.varValue("result")).toBe("2");
  });

  test("reports a missing target", () => {
    p.run({ arr: "1, 3, 5", target: "4" });
    p.toEnd();
    expect(p.varValue("result")).toBe("-1");
    expect(p.$("#range").textContent).toBe("nothing left to search");
  });

  test("rejects a non-integer target", () => {
    p.run({ arr: "1, 2, 3", target: "x" });
    expect(p.error()).toContain("Target");
  });
});
