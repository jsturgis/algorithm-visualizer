// Join and sort: O((n + m) log(n + m)). Obviously correct, so it's the oracle.
export function mergeSorted(arr1: number[], arr2: number[]): number[] {
  return [...arr1, ...arr2].sort((a, b) => a - b);
}
