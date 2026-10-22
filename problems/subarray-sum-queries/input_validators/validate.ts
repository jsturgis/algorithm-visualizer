// Every query [x, y] must be a valid range of nums.
export function validate(input: { nums: number[]; queries: number[][] }): string[] {
  const { nums, queries } = input;
  if (!Array.isArray(nums) || !Array.isArray(queries)) return [];
  const bad = queries.find(q => Array.isArray(q) && q.length === 2 && !(0 <= q[0] && q[0] <= q[1] && q[1] < nums.length));
  return bad ? [`Query [${bad.join(", ")}] isn't a range of nums: use [x, y] with 0 ≤ x ≤ y < ${nums.length}.`] : [];
}
