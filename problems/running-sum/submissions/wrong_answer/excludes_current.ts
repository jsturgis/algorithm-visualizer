// Bug: each entry is the sum *before* nums[i] (an exclusive prefix sum), so everything is shifted by one.
export function runningSum(nums: number[]): number[] {
  const prefix: number[] = [];
  let sum = 0;
  for (const x of nums) { prefix.push(sum); sum += x; }
  return prefix;
}
