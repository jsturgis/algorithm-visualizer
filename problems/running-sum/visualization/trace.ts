import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[] }
export interface RunningStep extends Step { i: number | null; prefix: (number | null)[]; wrote: number | null }

export function buildTrace({ nums }: Input): RunningStep[] {
  const T: RunningStep[] = [];
  const prefix: (number | null)[] = new Array(nums.length).fill(null);
  let i: number | null = null;
  const snap = (o: Partial<RunningStep> & Pick<Step, "line" | "note">) => T.push({
    i, prefix: prefix.slice(), wrote: null, ...o,
    vars: { i, "nums[i]": i === null ? null : nums[i], "prefix[i - 1]": i === null || i === 0 ? null : prefix[i - 1] },
  });

  prefix[0] = nums[0];
  snap({ line: "init", wrote: 0, note: `The first running sum is just <b>nums[0] = ${nums[0]}</b>.` });
  for (i = 1; i < nums.length; i++) {
    snap({ line: "loop", note: `Next: <b>i = ${i}</b>.` });
    prefix[i] = (prefix[i - 1] as number) + nums[i];
    snap({ line: "add", wrote: i, note: `<b>prefix[${i}] = prefix[${i - 1}] + nums[${i}] = ${prefix[i - 1]} + ${nums[i]} = ${prefix[i]}</b>: everything up to index ${i}.` });
  }
  i = null;
  snap({ line: "return", result: prefix.slice(), note: `Done in one pass. Now the sum of any range nums[a..b] is <b>prefix[b] − prefix[a − 1]</b>, a single subtraction.` });
  return T;
}
