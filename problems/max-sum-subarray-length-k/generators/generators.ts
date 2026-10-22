import fc from "fast-check";

export const random = fc.array(fc.integer({ min: -20, max: 20 }), { minLength: 1, maxLength: 12 })
  .chain(nums => fc.record({ nums: fc.constant(nums), k: fc.integer({ min: 1, max: nums.length }) }));

export const edge = {
  k_equals_length: { nums: [1, -2, 3], k: 3 },
  all_negative: { nums: [-3, -1, -2], k: 1 },
  best_window_is_last: { nums: [1, 1, 1, 9, 9], k: 2 },
  best_window_is_first: { nums: [9, 9, 1, 1, 1], k: 2 },
};

const wave = () => Array.from({ length: 100_000 }, (_, i) => ((i * 7919) % 20_001) - 10_000);
export const large = { max_length_small_k: () => ({ nums: wave(), k: 3 }), max_length_half_k: () => ({ nums: wave(), k: 50_000 }) };
