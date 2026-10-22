import type { Step } from "../../../src/runtime/types.ts";
import type { WindowState } from "../../../src/runtime/window.ts";

export interface Input { nums: number[]; k: number }
export type OnesStep = Step & WindowState;

export function buildTrace({ nums, k }: Input): OnesStep[] {
  const T: OnesStep[] = [];
  let left = 0, zeros = 0, best = 0, right: number | null = null;
  let bestRange: [number, number] | null = null;
  const snap = (o: Partial<OnesStep> & Pick<Step, "line" | "note">) => T.push({
    left, right, best: bestRange, ...o,
    vars: { k, left, right, zeros, best },
  });

  snap({ line: "init", note: `The window may hold at most <b>k = ${k}</b> zero${k === 1 ? "" : "s"} (the ones we'd flip). Start empty: <b>zeros = 0</b>.` });
  for (right = 0; right < nums.length; right++) {
    snap({ line: "expand", entered: right, note: `Extend the window to <b>right = ${right}</b>.` });
    if (nums[right] === 0) {
      zeros++;
      snap({ line: "add", entered: right, flash: "zeros", note: `nums[${right}] is 0: <b>zeros = ${zeros}</b>.` });
    } else {
      snap({ line: "add", entered: right, note: `nums[${right}] is 1: zeros stays <b>${zeros}</b>.` });
    }
    while (true) {
      if (!(zeros > k)) {
        snap({ line: "too-many", note: `<b>${zeros} ≤ ${k}</b>: we can flip every 0 in this window.` });
        break;
      }
      snap({ line: "too-many", note: `<b>${zeros} > ${k}</b>: one zero too many. Shrink from the left.` });
      const gone = left;
      if (nums[left] === 0) zeros--;
      left++;
      snap({ line: "shrink", left_out: gone, note: nums[gone] === 0 ? `Drop a 0 at index ${gone}: <b>zeros = ${zeros}</b>, <b>left = ${left}</b>.` : `Drop a 1 at index ${gone}: <b>left = ${left}</b>.` });
    }
    const len = right - left + 1;
    if (len > best) {
      best = len; bestRange = len > 0 ? [left, right] : null;
      snap({ line: "best", newBest: true, flash: "best", note: `Window ${left}–${right} has length <b>${len}</b>: the longest so far, <b>best = ${best}</b>.` });
    } else {
      snap({ line: "best", note: `Window length ${len}; best stays <b>${best}</b>.` });
    }
  }
  right = nums.length - 1;
  snap({ line: "return", done: true, result: best, note: `With at most ${k} flip${k === 1 ? "" : "s"}, the longest run of 1s has length <b>${best}</b>.` });
  return T;
}
