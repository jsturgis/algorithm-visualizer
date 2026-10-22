// Adds up each query's range directly: O(n · q). Correct, so it's the oracle.
export function answerQueries(nums: number[], queries: number[][], limit: number): boolean[] {
  return queries.map(([x, y]) => {
    let sum = 0;
    for (let i = x; i <= y; i++) sum += nums[i];
    return sum < limit;
  });
}
