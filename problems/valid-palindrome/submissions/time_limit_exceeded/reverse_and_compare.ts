// Reverse the whole string and compare: O(n) extra space, obviously correct, so it's the oracle.
export function isPalindrome(s: string): boolean {
  return s === [...s].reverse().join("");
}
