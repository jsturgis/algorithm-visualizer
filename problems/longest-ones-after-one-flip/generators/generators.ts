import fc from "fast-check";

export const random = fc.record({ s: fc.array(fc.constantFrom("0", "1", "1"), { minLength: 1, maxLength: 14 }).map(a => a.join("")) });

export const edge = {
  single_zero: { s: "0" },
  single_one: { s: "1" },
  zero_between_runs: { s: "11011" },
  two_zeros_together: { s: "1100111" },
  best_window_shrinks_twice: { s: "1010110111" },
};

export const large = {
  alternating: () => ({ s: "10".repeat(50_000) }),
  long_runs: () => ({ s: ("1".repeat(999) + "0").repeat(100) }),
};
