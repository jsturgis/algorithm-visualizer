// Test generators. `random` feeds the seeded random tests and the property test; `edge` and `large` are named cases.
import fc from "fast-check";

const printable = fc.integer({ min: 32, max: 126 }).map(c => String.fromCharCode(c));

export const random = fc.record({ s: fc.array(printable, { minLength: 1, maxLength: 12 }) });

export const edge = {
  one_character: { s: ["a"] },
  two_characters: { s: ["a", "b"] },
  odd_length: { s: ["a", "b", "c"] },
  even_length: { s: ["a", "b", "c", "d"] },
  already_a_palindrome: { s: ["r", "a", "c", "e", "c", "a", "r"] },
  spaces_and_symbols: { s: [" ", "!", "~", " "] },
};

export const large = {
  max_length: () => ({ s: Array.from({ length: 100_000 }, (_, i) => String.fromCharCode(32 + (i % 95))) }),
};
