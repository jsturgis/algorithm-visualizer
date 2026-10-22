// Both arrays must be sorted in non-decreasing order.
export function validate(input: { arr1: number[]; arr2: number[] }): string[] {
  for (const name of ["arr1", "arr2"] as const) {
    const a = input[name];
    if (!Array.isArray(a)) continue;
    for (let i = 1; i < a.length; i++) if (a[i] < a[i - 1]) return [`${name} must be sorted in non-decreasing order.`];
  }
  return [];
}
