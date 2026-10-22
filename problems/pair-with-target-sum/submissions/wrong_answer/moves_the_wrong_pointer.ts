// Bug: when the sum is too small it shrinks the right end, which makes the sum even smaller.
export function hasPairWithSum(nums: number[], target: number): boolean {
  let left = 0, right = nums.length - 1;
  while (left < right) {
    const sum = nums[left] + nums[right];
    if (sum === target) return true;
    if (sum < target) right--;
    else left++;
  }
  return false;
}
