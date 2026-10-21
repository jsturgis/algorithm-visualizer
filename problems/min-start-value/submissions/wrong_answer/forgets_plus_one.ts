// Bug: lifts the lowest point to 0 instead of 1.
export function minStartValue(nums: number[]): number {
  let total = 0, minVal = 0;
  for (const num of nums) minVal = Math.min(minVal, (total += num));
  return Math.max(1, -minVal);
}
