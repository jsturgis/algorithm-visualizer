import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[] }
export interface SplitStep extends Step { split: number | null; valid: boolean | null; validSplits: number[]; calc: string }

export function buildTrace({ nums }: Input): SplitStep[] {
  const T: SplitStep[] = [];
  const total = nums.reduce((a, b) => a + b, 0);
  const validSplits: number[] = [];
  let left = 0, right: number | null = null, ways = 0, split: number | null = null;
  const snap = (o: Partial<SplitStep> & Pick<Step, "line" | "note">) => T.push({
    split, valid: null, validSplits: validSplits.slice(), calc: "", ...o,
    vars: { total, i: split, left, right, ways },
  });

  snap({ line: "total", flash: "total", note: `Add everything once: <b>total = ${total}</b>.` });
  snap({ line: "init", note: `<b>left = 0</b> will hold the sum of the left part; <b>ways = 0</b>.` });
  for (let i = 0; i < nums.length - 1; i++) {
    split = i;
    snap({ line: "loop", note: `Try splitting after index <b>${i}</b>: left is nums[0..${i}], right is nums[${i + 1}..${nums.length - 1}].` });
    left += nums[i];
    snap({ line: "add", flash: "left", note: `nums[${i}] joins the left part: <b>left = ${left}</b>.` });
    right = total - left;
    const calc = `left ${left}  |  right ${total} − ${left} = ${right}`;
    snap({ line: "right", flash: "right", calc, note: `The right part is everything else: <b>right = ${total} − ${left} = ${right}</b>, with no extra loop.` });
    const ok = left >= right;
    if (ok) { ways++; validSplits.push(i); }
    snap({ line: "compare", valid: ok, calc, flash: ok ? "ways" : null, note: ok ? `<b>${left} ≥ ${right}</b>: a valid split. <b>ways = ${ways}</b>.` : `<b>${left} < ${right}</b>: not valid.` });
  }
  split = null; right = null;
  snap({ line: "return", result: ways, note: `<b>${ways}</b> valid split${ways === 1 ? "" : "s"}${validSplits.length ? ` (after index ${validSplits.join(", ")})` : ""}.` });
  return T;
}
