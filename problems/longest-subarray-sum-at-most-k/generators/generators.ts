import fc from "fast-check";

export const random = fc.record({
  nums: fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 1, maxLength: 12 }),
  k: fc.integer({ min: 1, max: 30 }),
});

export const edge = {
  nothing_fits: { nums: [5, 6, 7], k: 4 },
  everything_fits: { nums: [1, 2, 3], k: 6 },
  exactly_k: { nums: [2, 2, 2], k: 4 },
  best_at_the_end: { nums: [9, 9, 1, 1, 1], k: 3 },
  shrink_more_than_once: { nums: [1, 1, 1, 10, 1], k: 11 },
};

export const large = {
  max_length_small_values: () => ({ nums: Array.from({ length: 100_000 }, (_, i) => 1 + (i % 7)), k: 50_000 }),
  max_length_tight_k: () => ({ nums: Array.from({ length: 100_000 }, (_, i) => 1 + (i * 31) % 10_000), k: 10_000 }),
};
