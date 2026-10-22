// Bug: drops nums[i - k + 1] instead of nums[i - k], so the window's sum drifts.
export function maxSumOfLengthK(nums: number[], k: number): number {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += nums[i];
  let best = sum;
  for (let i = k; i < nums.length; i++) {
    sum += nums[i] - nums[i - k + 1];
    best = Math.max(best, sum);
  }
  return best;
}
