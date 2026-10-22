// Runs the accepted solution's steps and records a snapshot for each. `line` values are @line labels in solution.ts.
import type { Step } from "../../../src/runtime/types.ts";

export interface Input { s: string[] }
export interface ReverseStep extends Step { s: string[]; left: number | null; right: number | null; swapped: [number, number] | null; done: number; temp: string | null }

export function buildTrace({ s: input }: Input): ReverseStep[] {
  const T: ReverseStep[] = [];
  const s = input.slice();
  let left = 0, right = s.length - 1;
  const snap = (o: Partial<ReverseStep> & Pick<Step, "line" | "note">) => T.push({
    s: s.slice(), left, right, swapped: null, done: left, temp: null, ...o,
    vars: { left, right, "s[left]": s[left] ?? null, "s[right]": s[right] ?? null, temp: o.temp ?? null },
  });

  snap({ line: "init", note: `Start with <b>left = 0</b> and <b>right = ${right}</b>, one pointer at each end.` });
  while (true) {
    if (!(left < right)) {
      snap({ line: "loop", note: left === right
        ? `<b>left = right = ${left}</b>: the middle character stays where it is. Every pair has been swapped.`
        : `<b>left = ${left} > right = ${right}</b>: the pointers have crossed, so every pair has been swapped.` });
      break;
    }
    snap({ line: "loop", note: `<b>${left} < ${right}</b>: there's still a pair to swap.` });
    const temp = s[left];
    snap({ line: "save", swapped: [left, right], temp, note: `Save the left character: <b>temp = s[${left}] = "${temp}"</b>.` });
    s[left] = s[right];
    snap({ line: "put-right", swapped: [left, right], temp, note: `Copy the right character over it: <b>s[${left}] = s[${right}] = "${s[left]}"</b>. For a moment both slots hold "${s[left]}"; that's why we saved temp.` });
    s[right] = temp;
    snap({ line: "put-temp", swapped: [left, right], temp, note: `Put the saved character on the right: <b>s[${right}] = temp = "${temp}"</b>. The pair is swapped.` });
    left++; right--;
    snap({ line: "move", note: `Move both pointers toward the middle: <b>left = ${left}</b>, <b>right = ${right}</b>.` });
  }
  snap({ line: "return", left: null, right: null, done: s.length, result: s.slice(), note: `Done: <b>${JSON.stringify(s.join(""))}</b>, reversed with ${Math.floor(s.length / 2)} swap${Math.floor(s.length / 2) === 1 ? "" : "s"} and no extra array.` });
  return T;
}
