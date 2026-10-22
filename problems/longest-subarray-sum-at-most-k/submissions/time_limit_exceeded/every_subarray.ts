// Tries every start and extends while the sum fits: O(n²). Correct, so it's the oracle.
export function longestSubarray(nums: number[], k: number): number {
  let best = 0;
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length && sum + nums[j] <= k; j++) {
      sum += nums[j];
      best = Math.max(best, j - i + 1);
    }
  }
  return best;
}
