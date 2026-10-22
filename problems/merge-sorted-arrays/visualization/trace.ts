import type { Step } from "../../../src/runtime/types.ts";

export interface Input { arr1: number[]; arr2: number[] }
export interface MergeStep extends Step { i: number; j: number; merged: number[]; from: 1 | 2 | null; comparing: boolean }

export function buildTrace({ arr1, arr2 }: Input): MergeStep[] {
  const T: MergeStep[] = [];
  const merged: number[] = [];
  let i = 0, j = 0;
  const snap = (o: Partial<MergeStep> & Pick<Step, "line" | "note">) => T.push({
    i, j, merged: merged.slice(), from: null, comparing: false, ...o,
    vars: { i, j, "arr1[i]": arr1[i] ?? null, "arr2[j]": arr2[j] ?? null, "merged.length": merged.length },
  });

  snap({ line: "init", note: `Start with an empty <b>merged</b> and a pointer at the front of each array: <b>i = 0</b>, <b>j = 0</b>.` });
  while (true) {
    if (!(i < arr1.length && j < arr2.length)) {
      snap({ line: "loop", note: i >= arr1.length && j >= arr2.length ? `Both arrays are used up.` : i >= arr1.length ? `arr1 is used up; whatever is left in arr2 is already sorted.` : `arr2 is used up; whatever is left in arr1 is already sorted.` });
      break;
    }
    snap({ line: "loop", comparing: true, note: `Both arrays have elements left. Compare their fronts: <b>arr1[${i}] = ${arr1[i]}</b> and <b>arr2[${j}] = ${arr2[j]}</b>.` });
    if (arr1[i] <= arr2[j]) {
      merged.push(arr1[i++]);
      snap({ line: "take-1", from: 1, note: `<b>${arr1[i - 1]} ≤ ${arr2[j]}</b>: take it from arr1. <b>i = ${i}</b>.` });
    } else {
      merged.push(arr2[j++]);
      snap({ line: "take-2", from: 2, note: `<b>${arr1[i]} > ${arr2[j - 1]}</b>: take it from arr2. <b>j = ${j}</b>.` });
    }
  }
  while (i < arr1.length) {
    merged.push(arr1[i++]);
    snap({ line: "rest-1", from: 1, note: `Copy the rest of arr1: append <b>${arr1[i - 1]}</b>.` });
  }
  while (j < arr2.length) {
    merged.push(arr2[j++]);
    snap({ line: "rest-2", from: 2, note: `Copy the rest of arr2: append <b>${arr2[j - 1]}</b>.` });
  }
  snap({ line: "return", result: merged.slice(), note: `All ${merged.length} element${merged.length === 1 ? "" : "s"} merged in one pass, already in order.` });
  return T;
}
