// Bug: also counts the "split" after the last element, where the right part is empty.
export function waysToSplitArray(nums: number[]): number {
  const total = nums.reduce((a, b) => a + b, 0);
  let left = 0, ways = 0;
  for (let i = 0; i < nums.length; i++) {
    left += nums[i];
    if (left >= total - left) ways++;
  }
  return ways;
}
