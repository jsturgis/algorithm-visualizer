// Bug: moves left past zeros without decrementing the count, so the window keeps shrinking.
export function longestOnes(nums: number[], k: number): number {
  let left = 0, zeros = 0, best = 0;
  for (let right = 0; right < nums.length; right++) {
    if (nums[right] === 0) zeros++;
    while (zeros > k && left <= right) left++;
    best = Math.max(best, right - left + 1);
  }
  return best;
}
