// Bug: `>` misses splits where both parts have the same sum.
export function waysToSplitArray(nums: number[]): number {
  const total = nums.reduce((a, b) => a + b, 0);
  let left = 0, ways = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    left += nums[i];
    if (left > total - left) ways++;
  }
  return ways;
}
