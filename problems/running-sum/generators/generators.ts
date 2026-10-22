import fc from "fast-check";

export const random = fc.record({ nums: fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 12 }) });

export const edge = {
  zeros: { nums: [0, 0, 0] },
  alternating: { nums: [5, -5, 5, -5] },
  extremes: { nums: [1_000_000, 1_000_000, -1_000_000] },
};

export const large = { max_length: () => ({ nums: Array.from({ length: 100_000 }, (_, i) => ((i * 7919) % 2_000_001) - 1_000_000) }) };
