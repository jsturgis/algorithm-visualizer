import { frac } from "../../../src/runtime/format.ts";
import { fixedWindowTrace, type FixedWindowStep, type Input } from "../../max-sum-subarray-length-k/visualization/trace.ts";

export type { FixedWindowStep, Input };

// Same window as the largest-sum problem; the only difference is the division at the end.
export function buildTrace(input: Input): FixedWindowStep[] {
  return fixedWindowTrace(input, best => ({
    result: best / input.k,
    note: `The best window sums to <b>${best}</b>, so the largest average is <b>${best} / ${input.k} = ${frac(best, input.k)}</b>.`,
  }));
}
