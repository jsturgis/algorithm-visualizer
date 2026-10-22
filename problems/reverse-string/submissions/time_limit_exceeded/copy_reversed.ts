// Builds a reversed copy with an extra array: obviously correct, so it's the oracle (not O(1) space).
export function reverseString(s: string[]): string[] {
  const out: string[] = [];
  for (let i = s.length - 1; i >= 0; i--) out.push(s[i]);
  return out;
}
