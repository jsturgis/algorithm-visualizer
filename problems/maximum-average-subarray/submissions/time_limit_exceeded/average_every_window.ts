// Sums every window from scratch: O(n·k). Divides the best sum once, like the solution, so the
// floating-point result is identical.
export function findMaxAverage(nums: number[], k: number): number {
  let best = -Infinity;
  for (let start = 0; start + k <= nums.length; start++) {
    let sum = 0;
    for (let i = start; i < start + k; i++) sum += nums[i];
    best = Math.max(best, sum);
  }
  return best / k;
}
