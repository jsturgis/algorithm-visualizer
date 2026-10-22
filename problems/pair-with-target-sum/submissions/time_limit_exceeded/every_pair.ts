// Checks every pair: O(n²). Correct, so it's the oracle.
export function hasPairWithSum(nums: number[], target: number): boolean {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] + nums[j] === target) return true;
  return false;
}
