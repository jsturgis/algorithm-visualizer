import fc from "fast-check";

const text = (max: number) => fc.array(fc.constantFrom("a", "b", "c"), { minLength: 0, maxLength: max }).map(a => a.join(""));
// Half the time s is cut out of t, so it really is a subsequence.
const fromT = text(14).chain(t => fc.record({
  s: fc.array(fc.boolean(), { minLength: t.length, maxLength: t.length }).map(keep => [...t].filter((_, k) => keep[k]).join("").slice(0, 8)),
  t: fc.constant(t),
}));
export const random = fc.oneof(fromT, fc.record({ s: text(8), t: text(14) }));

export const edge = {
  both_empty: { s: "", t: "" },
  t_empty: { s: "a", t: "" },
  equal: { s: "abc", t: "abc" },
  same_letters_wrong_order: { s: "acb", t: "abc" },
  s_longer_than_t: { s: "aaaa", t: "aaa" },
  match_at_the_very_end: { s: "c", t: "aaaac" },
};

export const large = {
  long_t_found_at_end: () => ({ s: "z".repeat(100), t: "a".repeat(9_900) + "z".repeat(100) }),
  long_t_not_found: () => ({ s: "b".repeat(100), t: "a".repeat(10_000) }),
};
