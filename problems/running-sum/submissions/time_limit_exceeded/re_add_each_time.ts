// Re-adds nums[0..i] for every i: O(n²). Correct, so it's the oracle.
export function runningSum(nums: number[]): number[] {
  return nums.map((_, i) => {
    let sum = 0;
    for (let j = 0; j <= i; j++) sum += nums[j];
    return sum;
  });
}
