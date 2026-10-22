// Bug: assumes squaring keeps the order, which isn't true once there are negative numbers.
export function sortedSquares(nums: number[]): number[] {
  return nums.map(x => x * x);
}
