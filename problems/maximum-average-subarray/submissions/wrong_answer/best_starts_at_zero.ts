// Bug: starting best at 0 is wrong when every window's average is negative.
export function findMaxAverage(nums: number[], k: number): number {
  let sum = 0, best = 0;
  for (let i = 0; i < k; i++) sum += nums[i];
  best = Math.max(best, sum);
  for (let i = k; i < nums.length; i++) {
    sum += nums[i] - nums[i - k];
    best = Math.max(best, sum);
  }
  return best / k;
}
