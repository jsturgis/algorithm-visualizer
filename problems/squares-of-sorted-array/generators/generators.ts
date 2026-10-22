import fc from "fast-check";

export const random = fc.record({
  nums: fc.array(fc.integer({ min: -60, max: 60 }), { minLength: 1, maxLength: 12 }).map(a => a.sort((x, y) => x - y)),
});

export const edge = {
  single_negative: { nums: [-5] },
  all_negative: { nums: [-9, -4, -2, -1] },
  all_positive: { nums: [1, 2, 7] },
  equal_absolute_values: { nums: [-3, -3, 3, 3] },
  zeros: { nums: [0, 0, 0] },
  extremes: { nums: [-10000, 0, 10000] },
};

const maxNums = () => Array.from({ length: 10_000 }, (_, i) => i * 2 - 9999);
export const large = { max_length: () => ({ nums: maxNums() }) };
