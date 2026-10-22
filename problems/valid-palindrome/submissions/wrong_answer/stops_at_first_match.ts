// Bug: returns true as soon as one pair matches, without checking the rest.
export function isPalindrome(s: string): boolean {
  for (let left = 0, right = s.length - 1; left < right; left++, right--) {
    return s[left] === s[right];
  }
  return true;
}
