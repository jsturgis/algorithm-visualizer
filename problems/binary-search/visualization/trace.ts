// Runs the accepted solution's steps and records a snapshot for each. `line` values are @line labels in solution.ts.
import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[]; target: number }

export interface SearchStep extends Step {
  lo: number;
  hi: number;
  mid: number | null;
  found: boolean;
}

export function buildTrace({ nums, target }: Input): SearchStep[] {
  const T: SearchStep[] = [];
  let lo = 0, hi = nums.length - 1, mid: number | null = null, result: number | null = null;
  const snap = (o: Partial<SearchStep> & Pick<Step, "line" | "note">) => T.push({
    lo, hi, mid, found: false, ...o,
    vars: { target, lo, hi, mid: o.mid !== undefined ? o.mid : mid, "nums[mid]": mid == null ? null : nums[mid], result },
  });

  snap({ line: "init", note: `Search the whole array: <b>lo = 0</b>, <b>hi = ${hi}</b>. Looking for <b>${target}</b>.` });
  while (true) {
    if (lo > hi) {
      snap({ line: "loop", mid: null, note: `<b>lo = ${lo} > hi = ${hi}</b>: the range is empty, so ${target} isn't in the array.` });
      result = -1;
      snap({ line: "not-found", mid: null, flash: "result", result, note: `Return <b>-1</b>.` });
      break;
    }
    snap({ line: "loop", note: `<b>${lo} ≤ ${hi}</b>: ${hi - lo + 1} candidate${hi === lo ? "" : "s"} left, keep going.` });
    mid = Math.floor((lo + hi) / 2);
    snap({ line: "mid", flash: "mid", note: `<b>mid = ⌊(${lo} + ${hi}) / 2⌋ = ${mid}</b>, and nums[${mid}] is <b>${nums[mid]}</b>.` });
    if (nums[mid] === target) {
      result = mid;
      snap({ line: "found", found: true, flash: "result", result, note: `<b>nums[${mid}] = ${target}</b>: found it. Return <b>${mid}</b>.` });
      break;
    }
    snap({ line: "found", note: `<b>${nums[mid]} ≠ ${target}</b>, so not here.` });
    if (nums[mid] < target) {
      lo = mid + 1;
      snap({ line: "go-right", flash: "lo", note: `<b>${nums[mid]} < ${target}</b>: the target must be to the right. Everything up to index ${mid} is out. <b>lo = ${lo}</b>` });
    } else {
      hi = mid - 1;
      snap({ line: "go-left", flash: "hi", note: `<b>${nums[mid]} > ${target}</b>: the target must be to the left. Everything from index ${mid} on is out. <b>hi = ${hi}</b>` });
    }
    mid = null;
  }
  return T;
}
