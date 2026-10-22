// Extends a window from every start while it has at most k zeros: O(n²). Correct, so it's the oracle.
export function longestOnes(nums: number[], k: number): number {
  let best = 0;
  for (let i = 0; i < nums.length; i++) {
    let zeros = 0;
    for (let j = i; j < nums.length; j++) {
      if (nums[j] === 0) zeros++;
      if (zeros > k) break;
      best = Math.max(best, j - i + 1);
    }
  }
  return best;
}
