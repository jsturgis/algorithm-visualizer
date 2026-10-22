import type { Step } from "../../../src/runtime/types.ts";
import type { WindowState } from "../../../src/runtime/window.ts";

export interface Input { nums: number[]; k: number }
export type FixedWindowStep = Step & WindowState & { calc: string };

/** Shared with Maximum Average Subarray, which divides by k at the end. */
export function fixedWindowTrace({ nums, k }: Input, finish: (best: number) => { result: number; note: string }): FixedWindowStep[] {
  const T: FixedWindowStep[] = [];
  let sum = 0, best: number | null = null, i: number | null = null;
  let left = 0, right: number | null = null, bestRange: [number, number] | null = null;
  const snap = (o: Partial<FixedWindowStep> & Pick<Step, "line" | "note">) => T.push({
    left, right, best: bestRange, calc: "", ...o,
    vars: { k, i, sum, best },
  });

  snap({ line: "init", note: `Every window has exactly <b>k = ${k}</b> elements. Start with <b>sum = 0</b>.` });
  for (i = 0; i < k; i++) {
    sum += nums[i];
    right = i;
    snap({ line: "first", entered: i, flash: "sum", note: `Build the first window: add <b>nums[${i}] = ${nums[i]}</b>, <b>sum = ${sum}</b>.` });
  }
  best = sum; bestRange = [0, k - 1];
  snap({ line: "best-first", newBest: true, flash: "best", note: `The first window (0–${k - 1}) sums to <b>${sum}</b>: <b>best = ${best}</b>.` });
  for (i = k; i < nums.length; i++) {
    snap({ line: "slide", note: `Slide the window one step: <b>${nums[i]}</b> (index ${i}) enters, <b>${nums[i - k]}</b> (index ${i - k}) leaves.` });
    const before = sum;
    sum += nums[i] - nums[i - k];
    left = i - k + 1; right = i;
    snap({ line: "move", entered: i, left_out: i - k, flash: "sum", calc: `${before} + ${nums[i]} − ${nums[i - k]} = ${sum}`, note: `<b>sum = ${before} + ${nums[i]} − ${nums[i - k]} = ${sum}</b>, without re-adding the other ${k - 1}.` });
    if (sum > best) {
      const previous = best;
      best = sum; bestRange = [left, right];
      snap({ line: "best", newBest: true, flash: "best", note: `<b>${sum} > ${previous}</b>: window ${left}–${right} is the best so far, <b>best = ${best}</b>.` });
    } else {
      snap({ line: "best", note: `<b>${sum} ≤ ${best}</b>: best stays <b>${best}</b>.` });
    }
  }
  const end = finish(best);
  snap({ line: "return", done: true, result: end.result, note: end.note });
  return T;
}

export function buildTrace(input: Input): FixedWindowStep[] {
  return fixedWindowTrace(input, best => ({ result: best, note: `Every length-${input.k} window has been checked. The largest sum is <b>${best}</b>.` }));
}
