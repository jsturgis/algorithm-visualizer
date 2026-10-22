// Bug: `left < right - 1` stops before swapping the middle pair of an even-length array.
export function reverseString(s: string[]): string[] {
  let left = 0, right = s.length - 1;
  while (left < right - 1) {
    [s[left], s[right]] = [s[right], s[left]];
    left++;
    right--;
  }
  return s;
}
