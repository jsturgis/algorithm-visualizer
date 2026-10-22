import fc from "fast-check";

const letters = fc.constantFrom("a", "b", "c");
const word = fc.array(letters, { minLength: 1, maxLength: 7 }).map(a => a.join(""));
// Half palindromes (a word plus its mirror, with or without a middle letter), half anything.
const palindrome = fc.tuple(word, fc.option(letters, { nil: "" })).map(([w, mid]) => w + mid + [...w].reverse().join(""));

export const random = fc.record({ s: fc.oneof(palindrome, fc.array(letters, { minLength: 1, maxLength: 14 }).map(a => a.join(""))) });

export const edge = {
  two_same: { s: "aa" },
  two_different: { s: "ab" },
  even_palindrome: { s: "abba" },
  mismatch_in_the_middle: { s: "abcxba" },
  first_and_last_match_only: { s: "abca" },
};

export const large = {
  long_palindrome: () => ({ s: "ab".repeat(12_500) + "c" + "ba".repeat(12_500) }),
  long_mismatch_at_the_center: () => ({ s: "a".repeat(50_000) + "b" + "c" + "a".repeat(49_998) }),
};
