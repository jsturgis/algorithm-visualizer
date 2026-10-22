// Bug: on a second 0 it restarts the window at that 0, losing the 1s between the two zeros.
export function longestOnesAfterFlip(s: string): number {
  let left = 0, zeros = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    if (s[right] === "0") zeros++;
    if (zeros > 1) { left = right; zeros = 1; }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
