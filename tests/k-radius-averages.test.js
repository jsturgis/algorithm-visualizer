import { describe, test, expect, beforeEach } from "vitest";
import { loadPage, rng, randInt } from "./helpers.js";

// Reference answer: add up every window from scratch.
function bruteForce(nums, k) {
  return nums.map((_, i) => {
    if (i - k < 0 || i + k >= nums.length) return -1;
    let sum = 0;
    for (let j = i - k; j <= i + k; j++) sum += nums[j];
    return Math.trunc(sum / (2 * k + 1));
  });
}

let p;
beforeEach(async () => { p = await loadPage("algorithms/k-radius-averages/index.html"); });
const trace = (nums, k) => p.window.buildTrace({ nums, k });
const avgs = (nums, k) => trace(nums, k).at(-1).avgs;

describe("K Radius Subarray Averages: the trace", () => {
  test("example 1", () => {
    expect(avgs([7, 4, 3, 9, 1, 8, 5, 2, 6], 3)).toEqual([-1, -1, -1, 5, 4, 4, -1, -1, -1]);
  });

  test("example 2: k = 0 averages each number with itself", () => {
    expect(avgs([100000], 0)).toEqual([100000]);
  });

  test("example 3: a window bigger than the array leaves everything -1", () => {
    expect(avgs([8], 100000)).toEqual([-1]);
  });

  test("matches brute force on 300 random inputs", () => {
    const rand = rng(3);
    for (let t = 0; t < 300; t++) {
      const nums = Array.from({ length: randInt(rand, 1, 12) }, () => randInt(rand, 0, 100));
      const k = randInt(rand, 0, 6);
      expect(avgs(nums, k), `${nums} k=${k}`).toEqual(bruteForce(nums, k));
    }
  });

  test("builds prefix so prefix[j] is the sum of the first j numbers", () => {
    const nums = [7, 4, 3, 9, 1, 8, 5, 2, 6];
    expect(trace(nums, 3).at(-1).prefix).toEqual([0, 7, 11, 14, 23, 24, 32, 37, 39, 45]);
  });

  test("each window sum is prefix[i + k + 1] − prefix[i − k]", () => {
    const steps = trace([7, 4, 3, 9, 1, 8, 5, 2, 6], 3).filter(s => s.line === 8);
    expect(steps.map(s => [s.center, s.add, s.sub, s.vars.sum])).toEqual([
      [3, 7, 0, 37],
      [4, 8, 1, 32],
      [5, 9, 2, 34],
    ]);
  });
});

describe("K Radius Subarray Averages: the page", () => {
  const row = id => p.$$(`#${id} .box`).map(b => b.textContent);

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
    while (p.highlightedLine() !== 8) p.click("next");
    expect([0, 1, 2, 3, 4, 5, 6].every(j => p.$("#n" + j).classList.contains("done"))).toBe(true);
    expect(p.$("#n7").classList.contains("done")).toBe(false);
    expect(p.$("#pn3").textContent).toBe("center");
    expect(p.$("#p7").classList.contains("cursor")).toBe(true);
    expect(p.$("#pp7").textContent).toBe("i+k+1");
    expect(p.$("#p0").classList.contains("sub")).toBe(true);
    expect(p.$("#pp0").textContent).toBe("i−k");
    expect(p.$("#sum").textContent).toBe("prefix[7] − prefix[0] = 37 − 0 = 37");
  });

  test("runs custom input", () => {
    p.run({ arr: "2, 3, 1, 5, 9", k: "1" });
    p.toEnd();
    expect(row("avgs")).toEqual(["-1", "2", "3", "5", "-1"]);
  });

  test("stops early when the window doesn't fit", () => {
    p.run({ arr: "8", k: "9" });
    p.toEnd();
    expect(row("avgs")).toEqual(["-1"]);
    expect(p.highlightedLine()).toBe(4);
  });

  test.each([
    [{ arr: "1, -2, 3", k: "1" }, "negative"],
    [{ arr: "1, 2, 3", k: "-1" }, "k must be"],
    [{ arr: "1, 2, 3", k: "1.5" }, "k must be"],
    [{ arr: "1, 2, 3", k: "10" }, "k must be"],
  ])("rejects %j", (input, message) => {
    p.run(input);
    expect(p.error()).toContain(message);
  });
});
