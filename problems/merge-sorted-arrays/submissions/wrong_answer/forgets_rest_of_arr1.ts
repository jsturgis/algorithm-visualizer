// Bug: copies what's left of arr2 when the loop ends, but forgets what's left of arr1.
export function mergeSorted(arr1: number[], arr2: number[]): number[] {
  const merged: number[] = [];
  let i = 0, j = 0;
  while (i < arr1.length && j < arr2.length) merged.push(arr1[i] <= arr2[j] ? arr1[i++] : arr2[j++]);
  while (j < arr2.length) merged.push(arr2[j++]);
  return merged;
}
