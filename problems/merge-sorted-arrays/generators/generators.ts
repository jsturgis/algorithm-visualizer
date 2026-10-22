import fc from "fast-check";

const sorted = fc.array(fc.integer({ min: -30, max: 30 }), { minLength: 0, maxLength: 8 }).map(a => a.sort((x, y) => x - y));
export const random = fc.record({ arr1: sorted, arr2: sorted });

export const edge = {
  both_empty: { arr1: [], arr2: [] },
  arr1_empty: { arr1: [], arr2: [1, 2] },
  arr2_empty: { arr1: [1, 2], arr2: [] },
  arr1_all_smaller: { arr1: [1, 2, 3], arr2: [7, 8] },
  arr2_all_smaller: { arr1: [7, 8], arr2: [1, 2, 3] },
  interleaved_with_ties: { arr1: [1, 3, 3, 5], arr2: [2, 3, 4] },
};

const evens = () => Array.from({ length: 10_000 }, (_, i) => i * 2);
export const large = { max_lengths_interleaved: () => ({ arr1: evens(), arr2: evens().map(x => x + 1) }) };
