// Run the algorithm once and record a snapshot per step.
// `line` is a `// @line` label from submissions/accepted/solution.ts; the last step must set `result`.
// `vars` fills the variable cards, `flash` highlights one; any other fields are yours to use in view.ts.
import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[] }
export interface MaxStep extends Step { cursor: number | null; bestIdx: number }

export function buildTrace({ nums }: Input): MaxStep[] {
  const T: MaxStep[] = [];
  let best = nums[0], bestIdx = 0;
  const snap = (o: Partial<MaxStep> & Pick<Step, "line" | "note">) => T.push({
    cursor: null, bestIdx, ...o,
    vars: { i: o.cursor ?? null, "nums[i]": o.cursor == null ? null : nums[o.cursor], best },
  });

  snap({ line: "init", note: `Start with <b>best = nums[0] = ${best}</b>.` });
  for (let i = 1; i < nums.length; i++) {
    snap({ line: "read", cursor: i, note: `Look at <b>nums[${i}] = ${nums[i]}</b>.` });
    if (nums[i] > best) {
      best = nums[i]; bestIdx = i;
      snap({ line: "compare", cursor: i, flash: "best", note: `<b>${nums[i]} is bigger</b>, so <b>best = ${best}</b>.` });
    } else {
      snap({ line: "compare", cursor: i, note: `<b>${nums[i]} ≤ ${best}</b>: best stays <b>${best}</b>.` });
    }
  }
  snap({ line: "return", flash: "best", result: best, note: `Every number checked. The maximum is <b>${best}</b>.` });
  return T;
}
