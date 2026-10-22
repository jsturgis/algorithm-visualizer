// Bug: compares the numbers instead of their absolute values, so a big negative number is missed.
export function sortedSquares(nums: number[]): number[] {
  const result: number[] = new Array(nums.length);
  let left = 0, right = nums.length - 1;
  for (let k = nums.length - 1; k >= 0; k--) {
    if (nums[left] > nums[right]) result[k] = nums[left] * nums[left++];
    else result[k] = nums[right] * nums[right--];
  }
  return result;
}
