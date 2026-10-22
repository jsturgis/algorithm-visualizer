// Adds up both sides for every split: O(n²). Correct, so it's the oracle.
export function waysToSplitArray(nums: number[]): number {
  let ways = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    let left = 0, right = 0;
    for (let j = 0; j <= i; j++) left += nums[j];
    for (let j = i + 1; j < nums.length; j++) right += nums[j];
    if (left >= right) ways++;
  }
  return ways;
}
