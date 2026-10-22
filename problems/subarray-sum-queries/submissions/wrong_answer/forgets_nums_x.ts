// Bug: prefix[y] − prefix[x] leaves out nums[x] itself.
export function answerQueries(nums: number[], queries: number[][], limit: number): boolean[] {
  const prefix: number[] = [nums[0]];
  for (let i = 1; i < nums.length; i++) prefix.push(prefix[i - 1] + nums[i]);
  return queries.map(([x, y]) => prefix[y] - prefix[x] < limit);
}
