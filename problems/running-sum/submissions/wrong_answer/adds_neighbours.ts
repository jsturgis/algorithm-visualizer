// Bug: adds nums[i - 1] + nums[i] (two neighbours) instead of the running total so far.
export function runningSum(nums: number[]): number[] {
  return nums.map((x, i) => (i === 0 ? x : nums[i - 1] + x));
}
