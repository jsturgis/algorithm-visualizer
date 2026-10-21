// Checks every element: O(n). Correct, so it's the oracle for the random tests.
export function search(nums: number[], target: number): number {
  for (let i = 0; i < nums.length; i++) if (nums[i] === target) return i;
  return -1;
}
