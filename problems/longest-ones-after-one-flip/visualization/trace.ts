import type { Step } from "../../../src/runtime/types.ts";
import type { WindowState } from "../../../src/runtime/window.ts";

export interface Input { s: string }
export type FlipStep = Step & WindowState;

export function buildTrace({ s }: Input): FlipStep[] {
  const T: FlipStep[] = [];
  let left = 0, zeros = 0, best = 0, right: number | null = null;
  let bestRange: [number, number] | null = null;
  const snap = (o: Partial<FlipStep> & Pick<Step, "line" | "note">) => T.push({
    left, right, best: bestRange, ...o,
    vars: { left, right, zeros, "window length": right === null ? 0 : right - left + 1, best },
  });

  snap({ line: "init", note: `Start with an empty window: <b>zeros = 0</b>, <b>best = 0</b>. The window may hold at most one 0, the one we'd flip.` });
  for (right = 0; right < s.length; right++) {
    snap({ line: "expand", entered: right, note: `Extend the window to <b>right = ${right}</b> (<b>"${s[right]}"</b>).` });
    if (s[right] === "0") {
      zeros++;
      snap({ line: "add", entered: right, flash: "zeros", note: `It's a 0: <b>zeros = ${zeros}</b>.` });
    } else {
      snap({ line: "add", entered: right, note: `It's a 1: zeros stays <b>${zeros}</b>.` });
    }
    while (true) {
      if (!(zeros > 1)) {
        snap({ line: "too-many", note: `<b>zeros = ${zeros}</b>: at most one 0, so the window is fine.` });
        break;
      }
      snap({ line: "too-many", note: `<b>zeros = ${zeros}</b>: two 0s, but we can only flip one. Shrink from the left.` });
      const gone = left;
      if (s[left] === "0") zeros--;
      left++;
      snap({ line: "shrink", left_out: gone, note: s[gone] === "0" ? `Drop <b>s[${gone}] = "0"</b>: <b>zeros = ${zeros}</b>, <b>left = ${left}</b>.` : `Drop <b>s[${gone}] = "1"</b>: <b>left = ${left}</b>.` });
    }
    const len = right - left + 1;
    if (len > best) {
      best = len; bestRange = [left, right];
      snap({ line: "best", newBest: true, flash: "best", note: `Window ${left}–${right} has length <b>${len}</b>${zeros ? " (flipping its 0)" : ""}: the longest so far, <b>best = ${best}</b>.` });
    } else {
      snap({ line: "best", note: `Window length ${len}; best stays <b>${best}</b>.` });
    }
  }
  right = s.length - 1;
  snap({ line: "return", done: true, result: best, note: `The longest run of 1s after at most one flip has length <b>${best}</b>.` });
  return T;
}
