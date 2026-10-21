// Test generators. `random` feeds the seeded random tests and the property test; `edge` and `large` are named cases.
import fc from "fast-check";

export const random = fc.record({
  nums: fc.array(fc.integer({ min: 0, max: 100_000 }), { minLength: 1, maxLength: 12 }),
  k: fc.integer({ min: 0, max: 7 }),
});

export const edge = {
  k_zero_copies_nums: { nums: [5, 0, 7], k: 0 },
  window_fills_array: { nums: [1, 2, 3, 4, 5], k: 2 },
  window_one_too_big: { nums: [1, 2, 3, 4], k: 2 },
  truncates_down: { nums: [1, 1, 2], k: 1 },
  all_zero: { nums: [0, 0, 0, 0, 0], k: 1 },
  all_max: { nums: Array(9).fill(100_000), k: 4 },
  single_element: { nums: [42], k: 0 },
};

// Maximum-size inputs for the time limit. Too big for the brute force.
const maxNums = () => Array.from({ length: 100_000 }, (_, i) => (i * 7919) % 100_001);
export const large = {
  max_n_small_k: () => ({ nums: maxNums(), k: 1 }),
  max_n_largest_window: () => ({ nums: maxNums(), k: 49_999 }),
  max_n_window_too_big: () => ({ nums: maxNums(), k: 100_000 }),
};
