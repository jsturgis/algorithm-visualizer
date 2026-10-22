// Runs the accepted solution's steps and records a snapshot for each. `line` values are @line labels in solution.ts.
import type { Step } from "../../../src/runtime/types.ts";

export interface Input { s: string[] }
export interface ReverseStep extends Step { s: string[]; left: number | null; right: number | null; swapped: [number, number] | null; done: number }

export function buildTrace({ s: input }: Input): ReverseStep[] {
  const T: ReverseStep[] = [];
  const s = input.slice();
  let left = 0, right = s.length - 1;
  const snap = (o: Partial<ReverseStep> & Pick<Step, "line" | "note">) => T.push({
    s: s.slice(), left, right, swapped: null, done: left, ...o,
    vars: { left, right, "s[left]": s[left] ?? null, "s[right]": s[right] ?? null },
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
    const a = s[left], b = s[right];
    const temp = s[left]; s[left] = s[right]; s[right] = temp;
    snap({ line: "swap", swapped: [left, right], note: `Swap <b>s[${left}] = "${a}"</b> and <b>s[${right}] = "${b}"</b>.` });
    left++; right--;
    snap({ line: "move", note: `Move both pointers toward the middle: <b>left = ${left}</b>, <b>right = ${right}</b>.` });
  }
  snap({ line: "return", left: null, right: null, done: s.length, result: s.slice(), note: `Done: <b>${JSON.stringify(s.join(""))}</b>, reversed with ${Math.floor(s.length / 2)} swap${Math.floor(s.length / 2) === 1 ? "" : "s"} and no extra array.` });
  return T;
}
