// Bug: copies the right character over the left one without saving it, so the second half is lost.
export function reverseString(s: string[]): string[] {
  for (let left = 0, right = s.length - 1; left < right; left++, right--) {
    s[left] = s[right];
  }
  return s;
}
