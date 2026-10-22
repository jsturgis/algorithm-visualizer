// Bug: adds 1 per right end (the whole window) instead of every subarray ending there.
export function numSubarrayProductLessThanK(nums: number[], k: number): number {
  if (k <= 1) return 0;
  let left = 0, product = 1, count = 0;
  for (let right = 0; right < nums.length; right++) {
    product *= nums[right];
    while (product >= k) product /= nums[left++];
    if (left <= right) count++;
  }
  return count;
}
