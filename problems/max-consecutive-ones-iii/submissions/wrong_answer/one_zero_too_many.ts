// Bug: `zeros > k + 1` lets the window keep one more 0 than you're allowed to flip.
export function longestOnes(nums: number[], k: number): number {
  let left = 0, zeros = 0, best = 0;
  for (let right = 0; right < nums.length; right++) {
    if (nums[right] === 0) zeros++;
    while (zeros > k + 1) if (nums[left++] === 0) zeros--;
    best = Math.max(best, right - left + 1);
  }
  return best;
}
