// Tries startValue = 1, 2, 3, ... until every running total stays at least 1: O(n · answer).
export function minStartValue(nums: number[]): number {
  for (let start = 1; ; start++) {
    let total = start, ok = true;
    for (const n of nums) if ((total += n) < 1) { ok = false; break; }
    if (ok) return start;
  }
}
