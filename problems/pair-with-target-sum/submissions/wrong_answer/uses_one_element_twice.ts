// Bug: `left <= right` lets the pointers meet, so a single number can count as a pair with itself.
export function hasPairWithSum(nums: number[], target: number): boolean {
  let left = 0, right = nums.length - 1;
  while (left <= right) {
    const sum = nums[left] + nums[right];
    if (sum === target) return true;
    if (sum < target) left++;
    else right--;
  }
  return false;
}
