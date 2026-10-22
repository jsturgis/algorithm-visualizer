// nums must be sorted in non-decreasing order.
export function validate(input: { nums: number[] }): string[] {
  const { nums } = input;
  if (!Array.isArray(nums)) return [];
  for (let i = 1; i < nums.length; i++) if (nums[i] < nums[i - 1]) return ["nums must be sorted in non-decreasing order."];
  return [];
}
