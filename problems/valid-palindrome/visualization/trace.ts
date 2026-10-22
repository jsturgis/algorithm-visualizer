import type { Step } from "../../../src/runtime/types.ts";

export interface Input { s: string }
export interface PalindromeStep extends Step { left: number | null; right: number | null; matched: number; mismatch: boolean; comparing: boolean }

export function buildTrace({ s }: Input): PalindromeStep[] {
  const T: PalindromeStep[] = [];
  let left = 0, right = s.length - 1, matched = 0;
  const snap = (o: Partial<PalindromeStep> & Pick<Step, "line" | "note">) => T.push({
    left, right, matched, mismatch: false, comparing: false, ...o,
    vars: { left, right, "s[left]": s[left] ?? null, "s[right]": s[right] ?? null },
  });

  snap({ line: "init", note: `Start at both ends: <b>left = 0</b>, <b>right = ${right}</b>.` });
  while (true) {
    if (!(left < right)) {
      snap({ line: "loop", note: `<b>left = ${left}, right = ${right}</b>: the pointers have met, so every pair matched.` });
      break;
    }
    snap({ line: "loop", note: `<b>${left} < ${right}</b>: compare the next pair.` });
    if (s[left] !== s[right]) {
      snap({ line: "compare", comparing: true, mismatch: true, result: false, note: `<b>"${s[left]}" ≠ "${s[right]}"</b>: s[${left}] and s[${right}] differ, so it can't read the same both ways. Return <b>false</b>.` });
      return T;
    }
    snap({ line: "compare", comparing: true, note: `<b>"${s[left]}" = "${s[right]}"</b>: this pair matches.` });
    matched++;
    left++; right--;
    snap({ line: "move", note: `Move both pointers inward: <b>left = ${left}</b>, <b>right = ${right}</b>.` });
  }
  snap({ line: "return", left: null, right: null, result: true, note: `Every pair matched (${matched} comparison${matched === 1 ? "" : "s"}). <b>"${s}"</b> is a palindrome: return <b>true</b>.` });
  return T;
}
