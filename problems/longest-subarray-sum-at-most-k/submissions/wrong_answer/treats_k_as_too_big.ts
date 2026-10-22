// Bug: `sum >= k` shrinks windows whose sum is exactly k, but "at most k" includes k.
// (Using `if` instead of `while` here would NOT be a bug: a window that never shrinks below its best
// length is a known correct variant, which the verifier confirmed by passing every test.)
export function longestSubarray(nums: number[], k: number): number {
  let left = 0, sum = 0, best = 0;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];
    while (sum >= k) sum -= nums[left++];
    best = Math.max(best, right - left + 1);
  }
  return best;
}
