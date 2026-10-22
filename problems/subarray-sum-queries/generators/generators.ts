import fc from "fast-check";

const query = (n: number) => fc.tuple(fc.nat(n - 1), fc.nat(n - 1)).map(([a, b]) => [Math.min(a, b), Math.max(a, b)]);
export const random = fc.array(fc.integer({ min: -9, max: 9 }), { minLength: 1, maxLength: 10 }).chain(nums => fc.record({
  nums: fc.constant(nums),
  queries: fc.array(query(nums.length), { minLength: 1, maxLength: 6 }),
  limit: fc.integer({ min: -20, max: 30 }),
}));

export const edge = {
  sum_equal_to_limit: { nums: [2, 3], queries: [[0, 1]], limit: 5 },
  single_element_ranges: { nums: [4, -1, 7], queries: [[0, 0], [1, 1], [2, 2]], limit: 4 },
  whole_array: { nums: [1, 2, 3], queries: [[0, 2]], limit: 7 },
  query_starting_at_zero: { nums: [9, 1], queries: [[0, 1]], limit: 11 },
};

const n = 100_000;
const nums = () => Array.from({ length: n }, (_, i) => ((i * 7919) % 20_001) - 10_000);
export const large = {
  max_everything: () => ({ nums: nums(), queries: Array.from({ length: n }, (_, i) => [i % 1000, n - 1 - (i % 1000)]), limit: 0 }),
};
