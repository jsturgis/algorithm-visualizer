// Bug: only checks that t has enough of each letter, ignoring the order.
export function isSubsequence(s: string, t: string): boolean {
  const count = new Map<string, number>();
  for (const c of t) count.set(c, (count.get(c) ?? 0) + 1);
  for (const c of s) {
    const left = count.get(c) ?? 0;
    if (left === 0) return false;
    count.set(c, left - 1);
  }
  return true;
}
