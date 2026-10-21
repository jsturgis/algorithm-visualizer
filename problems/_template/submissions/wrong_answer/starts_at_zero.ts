// Bug: starting best at 0 is wrong when every number is negative.
export function findMax(nums: number[]): number {
  let best = 0;
  for (const n of nums) if (n > best) best = n;
  return best;
}
