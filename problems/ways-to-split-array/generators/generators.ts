import fc from "fast-check";

export const random = fc.record({ nums: fc.array(fc.integer({ min: -20, max: 20 }), { minLength: 2, maxLength: 12 }) });

export const edge = {
  equal_halves: { nums: [3, 3] },
  all_zeros: { nums: [0, 0, 0] },
  negatives: { nums: [-1, -1, -1] },
  big_right_end: { nums: [1, 1, 1, 100] },
};

export const large = {
  max_length_extremes: () => ({ nums: Array.from({ length: 100_000 }, (_, i) => (i % 2 ? 100_000 : -100_000)) }),
};
