// Square everything, then sort: O(n log n). Obviously correct, so it's the oracle.
export function sortedSquares(nums: number[]): number[] {
  return nums.map(x => x * x).sort((a, b) => a - b);
}
