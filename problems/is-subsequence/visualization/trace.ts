import type { Step } from "../../../src/runtime/types.ts";

export interface Input { s: string; t: string }
export interface SubseqStep extends Step { i: number; j: number; matchedAt: number[]; justMatched: boolean; comparing: boolean }

export function buildTrace({ s, t }: Input): SubseqStep[] {
  const T: SubseqStep[] = [];
  const matchedAt: number[] = [];   // index in t where each matched character of s was found
  let i = 0, j = 0;
  const snap = (o: Partial<SubseqStep> & Pick<Step, "line" | "note">) => T.push({
    i, j, matchedAt: matchedAt.slice(), justMatched: false, comparing: false, ...o,
    vars: { i, j, "s[i]": s[i] ?? null, "t[j]": t[j] ?? null },
  });

  snap({ line: "init", note: `<b>i = 0</b> marks the next character of s we need; <b>j = 0</b> scans t.` });
  while (true) {
    if (!(i < s.length && j < t.length)) {
      snap({ line: "loop", note: i >= s.length ? `<b>i = ${i}</b>: every character of s has been found.` : `<b>j = ${j}</b>: reached the end of t with ${s.length - i} character${s.length - i === 1 ? "" : "s"} of s still missing.` });
      break;
    }
    snap({ line: "loop", comparing: true, note: `Need <b>s[${i}] = "${s[i]}"</b>; looking at <b>t[${j}] = "${t[j]}"</b>.` });
    if (s[i] === t[j]) {
      matchedAt.push(j);
      i++;
      snap({ line: "match", comparing: true, justMatched: true, note: `<b>"${t[j]}" = "${s[i - 1]}"</b>: found it. Move on to the next character of s: <b>i = ${i}</b>.` });
    } else {
      snap({ line: "match", comparing: true, note: `<b>"${t[j]}" ≠ "${s[i]}"</b>: skip this character of t.` });
    }
    j++;
    snap({ line: "next", note: `Move along t: <b>j = ${j}</b>.` });
  }
  const ok = i === s.length;
  snap({ line: "return", result: ok, note: ok ? `<b>i = ${i} = s.length</b>: all of s appears in t, in order. Return <b>true</b>.` : `<b>i = ${i} < ${s.length}</b>: s isn't fully found in order. Return <b>false</b>.` });
  return T;
}
