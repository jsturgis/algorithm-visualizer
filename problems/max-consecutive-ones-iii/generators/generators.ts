import fc from "fast-check";

export const random = fc.record({
  nums: fc.array(fc.constantFrom(0, 1, 1), { minLength: 1, maxLength: 14 }),
  k: fc.integer({ min: 0, max: 4 }),
});

export const edge = {
  k_zero_ones_only: { nums: [1, 0, 1, 1], k: 0 },
  k_zero_all_zeros: { nums: [0, 0], k: 0 },
  k_bigger_than_zero_count: { nums: [0, 1, 0, 1], k: 9 },
  shrink_past_several_ones: { nums: [0, 1, 1, 1, 0, 0, 1], k: 1 },
};

export const large = {
  alternating_k_small: () => ({ nums: Array.from({ length: 100_000 }, (_, i) => i % 2), k: 3 }),
  long_runs_k_large: () => ({ nums: Array.from({ length: 100_000 }, (_, i) => (i % 1000 === 0 ? 0 : 1)), k: 50 }),
};
