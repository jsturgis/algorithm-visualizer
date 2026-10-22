// Bug: answers "did we reach the end of t?" instead of "did we find all of s?".
export function isSubsequence(s: string, t: string): boolean {
  let i = 0, j = 0;
  while (i < s.length && j < t.length) {
    if (s[i] === t[j]) i++;
    j++;
  }
  return j === t.length;
}
