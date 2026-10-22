import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[] }
export interface SquaresStep extends Step { left: number; right: number; k: number | null; out: (number | null)[]; took: "left" | "right" | null; wrote: number | null }

export function buildTrace({ nums }: Input): SquaresStep[] {
  const T: SquaresStep[] = [];
  const n = nums.length;
  const out: (number | null)[] = new Array(n).fill(null);
  let left = 0, right = n - 1, k: number | null = null;
  const snap = (o: Partial<SquaresStep> & Pick<Step, "line" | "note">) => T.push({
    left, right, k, out: out.slice(), took: null, wrote: null, ...o,
    vars: { left, right, k, "|nums[left]|": Math.abs(nums[left] ?? 0), "|nums[right]|": Math.abs(nums[right] ?? 0) },
  });

  snap({ line: "init", note: `The biggest square is at one of the ends, so start with <b>left = 0</b>, <b>right = ${n - 1}</b>, and fill <b>result</b> from the back.` });
  for (k = n - 1; k >= 0; k--) {
    snap({ line: "fill", note: `Fill <b>result[${k}]</b>, the largest square not placed yet.` });
    const a = Math.abs(nums[left]), b = Math.abs(nums[right]);
    snap({ line: "compare", note: `Compare <b>|${nums[left]}| = ${a}</b> on the left with <b>|${nums[right]}| = ${b}</b> on the right.` });
    if (a > b) {
      out[k] = nums[left] * nums[left];
      snap({ line: "take-left", took: "left", wrote: k, note: `<b>${a} > ${b}</b>: the left square is bigger. <b>result[${k}] = ${nums[left]}² = ${out[k]}</b>, and left moves in.` });
      left++;
    } else {
      out[k] = nums[right] * nums[right];
      snap({ line: "take-right", took: "right", wrote: k, note: `<b>${a} ≤ ${b}</b>: the right square is at least as big. <b>result[${k}] = ${nums[right]}² = ${out[k]}</b>, and right moves in.` });
      right--;
    }
  }
  k = null;
  snap({ line: "return", result: out.slice(), note: `Every slot is filled, largest first from the back, so <b>result</b> is sorted. One pass, no sort.` });
  return T;
}
