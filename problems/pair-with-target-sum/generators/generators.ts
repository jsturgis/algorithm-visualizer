import fc from "fast-check";

const sortedUnique = fc.uniqueArray(fc.integer({ min: -40, max: 40 }), { minLength: 1, maxLength: 12 }).map(a => a.sort((x, y) => x - y));
// The target is a real pair's sum about half the time.
export const random = sortedUnique.chain(nums => fc.record({
  nums: fc.constant(nums),
  target: nums.length > 1
    ? fc.oneof(fc.tuple(fc.nat(nums.length - 1), fc.nat(nums.length - 1)).filter(([i, j]) => i !== j).map(([i, j]) => nums[i] + nums[j]), fc.integer({ min: -80, max: 80 }))
    : fc.integer({ min: -80, max: 80 }),
}));

export const edge = {
  single_element_twice_is_not_a_pair: { nums: [3], target: 6 },
  pair_at_the_ends: { nums: [1, 5, 9], target: 10 },
  pair_in_the_middle: { nums: [1, 4, 5, 20], target: 9 },
  only_middle_element_doubled: { nums: [1, 4, 9], target: 8 },
  negatives: { nums: [-5, -2, 0, 3], target: -7 },
};

const evens = () => Array.from({ length: 10_000 }, (_, i) => i * 2 - 9998);
export const large = {
  max_length_no_pair: () => ({ nums: evens(), target: 1 }),
  max_length_pair_in_middle: () => ({ nums: evens(), target: 2 }),
};
