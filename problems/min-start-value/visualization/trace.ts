// Runs the accepted solution's steps and records a snapshot for each. `line` values are @line labels in solution.ts.
import { fmt } from "../../../src/runtime/format.ts";
import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[] }

export interface MinStartStep extends Step {
  minVal: number;
  minIdx: number;         // chart point (0 = start) of the lowest running sum
  cursor: number | null;  // nums index being read
  done: number;           // nums indices ≤ this have been added
  shown: number;          // chart points visible
  lift: number;           // how far the chart is lifted (the answer, on the last step)
  ans: number | null;
}

export function buildTrace({ nums }: Input): MinStartStep[] {
  const T: MinStartStep[] = [];
  let total = 0, minVal = 0, minIdx = 0;
  const snap = (o: Partial<MinStartStep> & Pick<Step, "line" | "note">, vars: Record<string, unknown> = {}) => T.push({
    minVal, minIdx, cursor: null, done: -1, shown: 1, lift: 0, ans: null, ...o,
    vars: { num: null, total, minVal, startValue: null, ...vars },
  });

  snap({ line: "init", note: "Start with <b>total = 0</b> and <b>minVal = 0</b>. Point 0 on the chart is the start, before any number is added." });
  nums.forEach((num, k) => {
    snap({ line: "read", shown: k + 1, cursor: k, done: k - 1, note: `Read <b>num = ${num}</b> (index ${k}).` }, { num });
    const before = total;
    total += num;
    snap({ line: "add", shown: k + 2, cursor: k, done: k - 1, flash: "total", note: `<b>total = ${before} + ${fmt(num)} = ${total}</b>` }, { num });
    const prev = minVal;
    if (total < minVal) { minVal = total; minIdx = k + 1; }
    snap({ line: "min", shown: k + 2, cursor: k, done: k, flash: minVal !== prev ? "minVal" : null,
      note: minVal !== prev
        ? `<b>${total} < ${prev}</b>: a new lowest point. <b>minVal = ${minVal}</b>`
        : `<b>${total} ≥ ${minVal}</b>: not a new low. minVal stays <b>${minVal}</b>.` }, { num });
  });
  const ans = 1 - minVal, n = nums.length;
  snap({ line: "return", shown: n + 1, done: n - 1, ans, flash: "startValue",
    note: `The lowest running sum is <b>${minVal}</b>. To lift it to 1, start at <b>1 − ${fmt(minVal)} = ${ans}</b>.` }, { startValue: ans });
  snap({ line: "return", shown: n + 1, done: n - 1, ans, lift: ans, result: ans,
    note: `Check: with <b>startValue = ${ans}</b> every running total is at least 1, and the lowest one is exactly 1. Starting at ${ans - 1} would put that point at 0, so ${ans} is the smallest valid start.` }, { startValue: ans });
  return T;
}
