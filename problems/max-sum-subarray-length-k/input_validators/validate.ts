// k can't be longer than the array.
export function validate(input: { nums: number[]; k: number }): string[] {
  if (!Array.isArray(input.nums) || !Number.isInteger(input.k)) return [];
  return input.k > input.nums.length ? [`k must be at most nums.length (${input.nums.length}).`] : [];
}
