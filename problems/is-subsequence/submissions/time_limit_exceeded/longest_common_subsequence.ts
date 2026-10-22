// Dynamic programming: s is a subsequence of t exactly when their longest common subsequence is all of s.
// O(n·m) time and space, and a different method from the solution, so it's a good oracle.
export function isSubsequence(s: string, t: string): boolean {
  const dp = Array.from({ length: s.length + 1 }, () => new Array<number>(t.length + 1).fill(0));
  for (let a = 1; a <= s.length; a++)
    for (let b = 1; b <= t.length; b++)
      dp[a][b] = s[a - 1] === t[b - 1] ? dp[a - 1][b - 1] + 1 : Math.max(dp[a - 1][b], dp[a][b - 1]);
  return dp[s.length][t.length] === s.length;
}
