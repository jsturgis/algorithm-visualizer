// Multiplies out every subarray, stopping early once the product reaches k: O(n²) worst case.
export function numSubarrayProductLessThanK(nums: number[], k: number): number {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    let product = 1;
    for (let j = i; j < nums.length; j++) {
      product *= nums[j];
      if (product >= k) break;
      count++;
    }
  }
  return count;
}
