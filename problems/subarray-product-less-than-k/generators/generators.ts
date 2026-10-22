import fc from "fast-check";

export const random = fc.record({
  nums: fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 1, maxLength: 10 }),
  k: fc.integer({ min: 0, max: 120 }),
});

export const edge = {
  k_zero: { nums: [1, 2], k: 0 },
  k_one: { nums: [1, 1], k: 1 },
  product_equal_to_k: { nums: [2, 5], k: 10 },
  every_element_too_big: { nums: [7, 8], k: 5 },
  all_ones: { nums: [1, 1, 1, 1], k: 2 },
};

export const large = {
  max_length_ones: () => ({ nums: new Array(30_000).fill(1), k: 1_000_000 }),
  max_length_mixed: () => ({ nums: Array.from({ length: 30_000 }, (_, i) => 1 + (i * 37) % 1000), k: 1_000_000 }),
};
