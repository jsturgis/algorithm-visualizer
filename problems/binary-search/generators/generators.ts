// Test generators. `random` feeds the seeded random tests and the property test; `edge` and `large` are named cases.
import fc from "fast-check";

// Sorted, distinct arrays; the target is in the array about half the time.
export const random = fc
  .uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 16 })
  .map(a => a.sort((x, y) => x - y))
  .chain(nums => fc.record({
    nums: fc.constant(nums),
    target: fc.oneof(fc.constantFrom(...nums), fc.integer({ min: -55, max: 55 })),
  }));

const evens = Array.from({ length: 10 }, (_, i) => i * 2);
export const edge = {
  single_found: { nums: [7], target: 7 },
  single_missing_below: { nums: [7], target: 6 },
  single_missing_above: { nums: [7], target: 8 },
  first: { nums: evens, target: 0 },
  last: { nums: evens, target: 18 },
  between_two: { nums: evens, target: 9 },
  below_all: { nums: evens, target: -1 },
  above_all: { nums: evens, target: 19 },
  two_elements_second: { nums: [1, 2], target: 2 },
  extremes: { nums: [-9999, 0, 9999], target: 9999 },
};

const maxNums = () => Array.from({ length: 10_000 }, (_, i) => i * 2 - 9999);
export const large = {
  max_n_first: () => ({ nums: maxNums(), target: -9999 }),
  max_n_last: () => ({ nums: maxNums(), target: 9999 }),
  max_n_missing: () => ({ nums: maxNums(), target: 0 }),
};
