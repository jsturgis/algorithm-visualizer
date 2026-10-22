import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[]; target: number }
export interface PairStep extends Step { left: number; right: number; found: boolean; comparing: boolean; sumText: string }

export function buildTrace({ nums, target }: Input): PairStep[] {
  const T: PairStep[] = [];
  let left = 0, right = nums.length - 1, sum: number | null = null;
  const snap = (o: Partial<PairStep> & Pick<Step, "line" | "note">) => T.push({
    left, right, found: false, comparing: false, sumText: "", ...o,
    vars: { target, left, right, sum },
  });

  snap({ line: "init", note: `Start with the smallest and largest numbers: <b>left = 0</b>, <b>right = ${right}</b>. Looking for a pair that adds up to <b>${target}</b>.` });
  while (true) {
    if (!(left < right)) {
      snap({ line: "loop", note: left === right
        ? `<b>left = right = ${left}</b>: only one number left, and a number can't pair with itself.`
        : `The pointers have crossed: no pairs left to try.` });
      break;
    }
    snap({ line: "loop", note: `<b>${left} < ${right}</b>: try the pair nums[${left}] + nums[${right}].` });
    sum = nums[left] + nums[right];
    const sumText = `${nums[left]} + ${nums[right]} = ${sum}`;
    snap({ line: "sum", comparing: true, flash: "sum", sumText, note: `<b>sum = ${sumText}</b>.` });
    if (sum === target) {
      snap({ line: "found", comparing: true, found: true, result: true, sumText: `${sumText} ✓`, note: `<b>${sum} = ${target}</b>: found a pair, <b>nums[${left}] = ${nums[left]}</b> and <b>nums[${right}] = ${nums[right]}</b>. Return <b>true</b>.` });
      return T;
    }
    snap({ line: "found", comparing: true, sumText, note: `<b>${sum} ≠ ${target}</b>.` });
    if (sum < target) {
      left++;
      snap({ line: "go-right", flash: "left", sumText, note: `<b>${sum} < ${target}</b>: too small. Every pair using nums[${left - 1}] is at most this sum (the right side only gets smaller), so drop it: <b>left = ${left}</b>.` });
    } else {
      right--;
      snap({ line: "go-left", flash: "right", sumText, note: `<b>${sum} > ${target}</b>: too big. Every pair using nums[${right + 1}] is at least this sum, so drop it: <b>right = ${right}</b>.` });
    }
  }
  snap({ line: "return", result: false, note: `Every number has been ruled out. No pair adds up to ${target}: return <b>false</b>.` });
  return T;
}
