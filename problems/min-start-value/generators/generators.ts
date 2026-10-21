// Test generators. `random` feeds the seeded random tests and the property test; `edge` and `large` are named cases.
import fc from "fast-check";

export const random = fc.record({
  nums: fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 12 }),
});

export const edge = {
  all_positive: { nums: [1, 2, 3] },
  single_zero: { nums: [0] },
  single_most_negative: { nums: [-100] },
  lowest_point_is_last: { nums: [5, -1, -1, -1, -1, -1, -1] },
  dips_to_exactly_zero: { nums: [2, -2, 3] },
  recovers_then_drops_lower: { nums: [-2, 5, -6, 1] },
};

export const large = {
  max_n_all_most_negative: () => ({ nums: Array(100).fill(-100) }),
  max_n_alternating: () => ({ nums: Array.from({ length: 100 }, (_, i) => (i % 2 ? 100 : -100)) }),
};
