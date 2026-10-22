// Bug: `product > k` keeps windows whose product equals k, but the product must be strictly less.
export function numSubarrayProductLessThanK(nums: number[], k: number): number {
  if (k <= 1) return 0;
  let left = 0, product = 1, count = 0;
  for (let right = 0; right < nums.length; right++) {
    product *= nums[right];
    while (product > k) product /= nums[left++];
    count += right - left + 1;
  }
  return count;
}
