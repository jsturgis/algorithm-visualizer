// Bug: records the window's length before shrinking it, so an oversized window can count.
export function longestSubarray(nums: number[], k: number): number {
  let left = 0, sum = 0, best = 0;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];
    best = Math.max(best, right - left + 1);
    while (sum > k) sum -= nums[left++];
  }
  return best;
}
