// Bug: `zeros > 2` lets the window keep two 0s, as if you could flip twice.
export function longestOnesAfterFlip(s: string): number {
  let left = 0, zeros = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    if (s[right] === "0") zeros++;
    while (zeros > 2) if (s[left++] === "0") zeros--;
    best = Math.max(best, right - left + 1);
  }
  return best;
}
