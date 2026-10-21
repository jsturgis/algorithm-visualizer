// Runs the accepted solution's steps and records a snapshot for each. `line` values are @line labels in solution.ts.
import { frac } from "../../../src/runtime/format.ts";
import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[]; k: number }

export interface KRadiusStep extends Step {
  win: [number, number] | null;   // nums indices in the current window
  center: number | null;
  read: number | null;            // nums index being added into prefix
  add: number | null;             // prefix index added (window end)
  sub: number | null;             // prefix index subtracted (before window start)
  wroteP: number | null;
  wroteA: number | null;
  sumText: string;
  avgs: (number | null)[];        // null = not created yet
  prefix: (number | null)[];
}

export function buildTrace({ nums, k }: Input): KRadiusStep[] {
  const T: KRadiusStep[] = [];
  const n = nums.length, size = 2 * k + 1;
  const avgs: (number | null)[] = new Array(n).fill(null);
  const prefix: (number | null)[] = new Array(n + 1).fill(null);
  let i: number | null = null, sum: number | null = null, avg: number | null = null, windowText: string | null = null;
  const snap = (o: Partial<KRadiusStep> & Pick<Step, "line" | "note">) => T.push({
    win: null, center: null, read: null, add: null, sub: null, wroteP: null, wroteA: null, sumText: "", ...o,
    avgs: avgs.slice(), prefix: prefix.slice(), vars: { k, size, i, window: windowText, sum, avg },
  });

  snap({ line: "sizes", note: `Each window holds <b>size = 2·${k} + 1 = ${size}</b> numbers: the center plus ${k} on each side.` });
  avgs.fill(-1);
  if (size > n) {
    snap({ line: "fill", note: `Start every answer at <b>-1</b>.` });
    snap({ line: "too-big", result: avgs.slice(), note: `<b>${size} > ${n}</b>: no window fits in the array, so every answer stays <b>-1</b>.` });
    return T;
  }
  snap({ line: "fill", note: `Start every answer at <b>-1</b>. The first ${k} and last ${k} indices will keep it, because their window would run off the end.` });
  prefix.fill(0);
  snap({ line: "prefix", wroteP: 0, note: `Make <b>prefix</b> one longer than nums. <b>prefix[0] = 0</b> is the sum of no numbers, and it sits in the empty column before nums[0].` });

  const P = prefix as number[];
  for (i = 0; i < n; i++) {
    P[i + 1] = P[i] + nums[i];
    snap({ line: "build", read: i, add: i, wroteP: i + 1,
      sumText: `prefix[${i + 1}] = prefix[${i}] + nums[${i}] = ${P[i]} + ${nums[i]} = ${P[i + 1]}`,
      note: `<b>prefix[${i + 1}] = ${P[i + 1]}</b>, the sum of nums[0..${i}]. Each entry is the one before it plus one more number.` });
  }

  for (i = k; i < n - k; i++) {
    const lo = i - k, hi = i + k;
    windowText = `${lo}–${hi}`; avg = null;
    sum = P[hi + 1] - P[lo];
    snap({ line: "window", win: [lo, hi], center: i, add: hi + 1, sub: lo, flash: "sum",
      sumText: `<span class="plus">prefix[${hi + 1}]</span> <span class="minus">− prefix[${lo}]</span> = ${P[hi + 1]} − ${P[lo]} = ${sum}`,
      note: `Window for center <b>${i}</b> is nums[${lo}..${hi}]. <b>prefix[${hi + 1}] = ${P[hi + 1]}</b> is everything through nums[${hi}]; <b>prefix[${lo}] = ${P[lo]}</b> is everything before nums[${lo}]. The difference is the window: <b>sum = ${sum}</b>` });
    avg = Math.floor(sum / size);
    avgs[i] = avg;
    snap({ line: "average", win: [lo, hi], center: i, wroteA: i, flash: "avg",
      sumText: `${sum} / ${size} = ${frac(sum, size)} → ${avg}`,
      note: `<b>avgs[${i}] = ⌊${sum} / ${size}⌋ = ${avg}</b>` });
  }
  i = null; sum = null; avg = null; windowText = null;
  snap({ line: "return", result: avgs.slice(), note: `Done. Building prefix took one pass, and each average took one subtraction, so this is <b>O(n)</b> no matter how big k is.` });
  return T;
}
