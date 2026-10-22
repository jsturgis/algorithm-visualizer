import type { Step } from "../../../src/runtime/types.ts";
import type { WindowState } from "../../../src/runtime/window.ts";

export interface Input { nums: number[]; k: number }
export type SumWindowStep = Step & WindowState;

export function buildTrace({ nums, k }: Input): SumWindowStep[] {
  const T: SumWindowStep[] = [];
  let left = 0, sum = 0, best = 0, right: number | null = null;
  let bestRange: [number, number] | null = null;
  const snap = (o: Partial<SumWindowStep> & Pick<Step, "line" | "note">) => T.push({
    left, right, best: bestRange, ...o,
    vars: { k, left, right, sum, "window length": right === null ? 0 : Math.max(0, right - left + 1), best },
  });

  snap({ line: "init", note: `Start with an empty window: <b>left = 0</b>, <b>sum = 0</b>, <b>best = 0</b>.` });
  for (right = 0; right < nums.length; right++) {
    snap({ line: "expand", entered: right, note: `Extend the window to the right: <b>right = ${right}</b>.` });
    sum += nums[right];
    snap({ line: "add", entered: right, flash: "sum", note: `Add <b>nums[${right}] = ${nums[right]}</b>: <b>sum = ${sum}</b>.` });
    while (true) {
      if (!(sum > k)) {
        snap({ line: "too-big", note: `<b>${sum} ≤ ${k}</b>: the window fits.` });
        break;
      }
      snap({ line: "too-big", note: `<b>${sum} > ${k}</b>: too big, shrink from the left.` });
      const gone = left;
      sum -= nums[left];
      left++;
      snap({ line: "shrink", left_out: gone, flash: "sum", note: `Remove <b>nums[${gone}] = ${nums[gone]}</b>: <b>sum = ${sum}</b>, <b>left = ${left}</b>.` });
    }
    const len = right - left + 1;
    if (len > best) {
      best = len; bestRange = [left, right];
      snap({ line: "best", newBest: true, flash: "best", note: `This window (indices ${left}–${right}) has length <b>${len}</b>, the longest so far: <b>best = ${best}</b>.` });
    } else {
      snap({ line: "best", note: len > 0 ? `This window has length ${len}; best stays <b>${best}</b>.` : `The window is empty; best stays <b>${best}</b>.` });
    }
  }
  right = nums.length - 1;
  snap({ line: "return", done: true, result: best, note: best ? `Every right end has been tried. The longest subarray with sum ≤ ${k} has length <b>${best}</b>.` : `No single element is ≤ ${k}, so the answer is <b>0</b>.` });
  return T;
}
