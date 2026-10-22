import type { Step } from "../../../src/runtime/types.ts";
import type { WindowState } from "../../../src/runtime/window.ts";

export interface Input { nums: number[]; k: number }
export type ProductStep = Step & WindowState & { added: number | null };

export function buildTrace({ nums, k }: Input): ProductStep[] {
  const T: ProductStep[] = [];
  let left = 0, product = 1, count = 0, right: number | null = null;
  const snap = (o: Partial<ProductStep> & Pick<Step, "line" | "note">) => T.push({
    left, right, added: null, ...o,
    vars: { k, left, right, product, count },
  });

  if (k <= 1) {
    snap({ line: "guard", note: `Check <b>k = ${k}</b> first: every number is at least 1, so every product is at least 1.` });
    snap({ line: "guard", result: 0, note: `No product can be less than ${k}. Return <b>0</b> without scanning.` });
    return T;
  }
  snap({ line: "guard", note: `<b>k = ${k} > 1</b>, so some subarrays may qualify.` });
  snap({ line: "init", note: `Start with an empty window: <b>product = 1</b>, <b>count = 0</b>.` });
  for (right = 0; right < nums.length; right++) {
    snap({ line: "expand", entered: right, note: `Extend the window to <b>right = ${right}</b>.` });
    product *= nums[right];
    snap({ line: "multiply", entered: right, flash: "product", note: `Multiply in <b>nums[${right}] = ${nums[right]}</b>: <b>product = ${product}</b>.` });
    while (true) {
      if (!(product >= k)) {
        snap({ line: "too-big", note: `<b>${product} < ${k}</b>: the window qualifies.` });
        break;
      }
      snap({ line: "too-big", note: `<b>${product} ≥ ${k}</b>: too big, shrink from the left.` });
      const gone = left;
      product /= nums[left];
      left++;
      snap({ line: "shrink", left_out: gone, flash: "product", note: `Divide out <b>nums[${gone}] = ${nums[gone]}</b>: <b>product = ${product}</b>, <b>left = ${left}</b>.` });
    }
    const add = right - left + 1;
    count += add;
    const starts = add === 0 ? "none" : add === 1 ? `[${right}]` : `starting at ${left}…${right}`;
    snap({ line: "count", flash: "count", added: add, note: `Subarrays ending at ${right} with product < ${k}: ${starts}. <b>count += ${right} − ${left} + 1 = ${add}</b> → <b>${count}</b>.` });
  }
  right = nums.length - 1;
  snap({ line: "return", done: true, result: count, note: `<b>${count}</b> subarray${count === 1 ? "" : "s"} have a product below ${k}.` });
  return T;
}
