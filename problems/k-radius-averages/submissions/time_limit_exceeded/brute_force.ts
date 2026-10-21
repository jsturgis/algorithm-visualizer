// Adds up every window from scratch: O(n·k). Correct, so it's the oracle for the random tests.
export function getAverages(nums: number[], k: number): number[] {
  return nums.map((_, i) => {
    if (i - k < 0 || i + k >= nums.length) return -1;
    let sum = 0;
    for (let j = i - k; j <= i + k; j++) sum += nums[j];
    return Math.trunc(sum / (2 * k + 1));
  });
}
