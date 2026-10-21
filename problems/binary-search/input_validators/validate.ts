// Constraints problem.yaml can't express as ranges: nums is sorted ascending with no repeats.
export function validate(input: { nums: number[] }): string[] {
  const { nums } = input;
  if (!Array.isArray(nums)) return [];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1]) return [`nums can't contain ${nums[i]} twice.`];
    if (nums[i] < nums[i - 1]) return ["nums must be sorted in ascending order."];
  }
  return [];
}
