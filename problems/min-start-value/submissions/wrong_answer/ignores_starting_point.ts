// Bug: starts minVal at Infinity, so when every running sum is positive it returns 1 - (smallest sum), which can be 0 or less.
export function minStartValue(nums: number[]): number {
  let total = 0, minVal = Infinity;
  for (const num of nums) minVal = Math.min(minVal, (total += num));
  return 1 - minVal;
}
