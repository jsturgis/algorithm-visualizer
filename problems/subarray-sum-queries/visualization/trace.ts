import type { Step } from "../../../src/runtime/types.ts";

export interface Input { nums: number[]; queries: number[][]; limit: number }
export interface QueryStep extends Step {
  prefix: (number | null)[];
  built: number | null;
  q: number | null;          // which query is being answered
  range: [number, number] | null;
  answers: boolean[];
  calc: string;
}

export function buildTrace({ nums, queries, limit }: Input): QueryStep[] {
  const T: QueryStep[] = [];
  const prefix: (number | null)[] = new Array(nums.length).fill(null);
  const answers: boolean[] = [];
  let q: number | null = null, sum: number | null = null;
  const snap = (o: Partial<QueryStep> & Pick<Step, "line" | "note">) => T.push({
    prefix: prefix.slice(), built: null, q, range: null, answers: answers.slice(), calc: "", ...o,
    vars: { limit, query: q === null ? null : `[${queries[q].join(", ")}]`, sum },
  });

  prefix[0] = nums[0];
  snap({ line: "init", built: 0, note: `Build the prefix sum once. <b>prefix[0] = nums[0] = ${nums[0]}</b>.` });
  for (let i = 1; i < nums.length; i++) {
    prefix[i] = (prefix[i - 1] as number) + nums[i];
    snap({ line: "build", built: i, note: `<b>prefix[${i}] = ${prefix[i - 1]} + ${nums[i]} = ${prefix[i]}</b>.` });
  }
  snap({ line: "answers", note: `The prefix sum is ready. Now each query takes one subtraction, however long its range.` });
  for (q = 0; q < queries.length; q++) {
    const [x, y] = queries[q];
    snap({ line: "query", range: [x, y], note: `Query ${q + 1}: is the sum of <b>nums[${x}..${y}]</b> less than ${limit}?` });
    sum = (prefix[y] as number) - (prefix[x] as number) + nums[x];
    const calc = `prefix[${y}] − prefix[${x}] + nums[${x}] = ${prefix[y]} − ${prefix[x]} + ${nums[x]} = ${sum}`;
    snap({ line: "sum", range: [x, y], flash: "sum", calc, note: `<b>${calc}</b>: everything up to ${y}, minus everything up to ${x}, plus nums[${x}] back.` });
    answers.push(sum < limit);
    snap({ line: "compare", range: [x, y], calc, note: `<b>${sum} ${sum < limit ? "<" : "≥"} ${limit}</b>: answer <b>${sum < limit}</b>.` });
  }
  q = null; sum = null;
  snap({ line: "return", result: answers.slice(), note: `${queries.length} quer${queries.length === 1 ? "y" : "ies"} answered with ${nums.length} additions up front and one subtraction each.` });
  return T;
}
