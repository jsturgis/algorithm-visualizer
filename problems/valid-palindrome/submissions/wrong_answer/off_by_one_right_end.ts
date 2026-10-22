// Bug: starts right at s.length instead of s.length - 1, so it compares against undefined.
export function isPalindrome(s: string): boolean {
  let left = 0, right = s.length;
  while (left < right) {
    if (s[left] !== s[right]) return false;
    left++;
    right--;
  }
  return true;
}
