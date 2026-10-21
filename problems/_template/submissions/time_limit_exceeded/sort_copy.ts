// Sorts a copy and takes the last element: O(n log n). Slower but obviously correct, so it's the oracle.
export function findMax(nums: number[]): number {
  return [...nums].sort((a, b) => a - b).at(-1)!;
}
