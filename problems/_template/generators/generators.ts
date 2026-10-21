// `random`: a fast-check arbitrary for small inputs (seeded random tests + the property test against the brute force).
// `edge`: named cases you want checked every time. `large`: maximum-size inputs for the time limit.
import fc from "fast-check";

export const random = fc.record({
  nums: fc.array(fc.integer({ min: -1_000_000, max: 1_000_000 }), { minLength: 1, maxLength: 12 }),
});

export const edge = {
  single: { nums: [3] },
  all_negative: { nums: [-3, -1, -2] },
  max_first: { nums: [9, 1, 2] },
  max_last: { nums: [1, 2, 9] },
  repeated_max: { nums: [5, 5, 1] },
};

export const large = {
  max_n_ascending: () => ({ nums: Array.from({ length: 100_000 }, (_, i) => i) }),
};
