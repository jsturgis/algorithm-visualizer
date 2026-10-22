// Tries flipping each 0 (and flipping nothing), measuring the longest run of 1s each time: O(n²).
export function longestOnesAfterFlip(s: string): number {
  const longestRun = (t: string) => Math.max(0, ...t.split("0").map(run => run.length));
  let best = longestRun(s);
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "0") best = Math.max(best, longestRun(s.slice(0, i) + "1" + s.slice(i + 1)));
  }
  return best;
}
