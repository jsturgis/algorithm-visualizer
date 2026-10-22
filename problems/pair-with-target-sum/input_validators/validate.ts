// nums must be strictly increasing (sorted, no repeats).
export function validate(input: { nums: number[] }): string[] {
  const { nums } = input;
  if (!Array.isArray(nums)) return [];
  for (let i = 1; i < nums.length; i++) if (nums[i] <= nums[i - 1]) return ["nums must be sorted in increasing order with no repeats."];
  return [];
}
