// The judge: runs a learner's solution against a package's test set, in order, stopping at the first
// failure, and returns one ICPC-style verdict. The tests and the answer comparison are the same ones
// `npm run verify` uses, so "Accepted" here means the same as passing verification.
import { answerFingerprint, firstDifference, sameAnswer } from "../runtime/answers.ts";
import type { Contract, Input } from "../runtime/types.ts";
import type { Diagnostic } from "../editor/checker.ts";
import type { Runner } from "./runner.ts";

export { BROWSER_TIME_MULTIPLIER } from "../runtime/types.ts";

export type TestCategory = "sample" | "edge" | "random" | "large";

/** A test as shipped to the browser. Large tests carry a generator and a fingerprint instead of data. */
export type JudgeTest = { name: string; category: TestCategory } & (
  | { input: Input; answer: unknown }
  | { make: () => Input; answerHash: string }
);

export interface TestRef { name: string; category: TestCategory; index: number }

interface Counts { passed: number; total: number; typeErrors: number }

export type Verdict =
  | ({ kind: "Accepted"; slowest: { test: TestRef; ms: number } | null } & Counts)
  | ({ kind: "WrongAnswer"; test: TestRef; input: Input; actual: unknown;
       /** Missing for large tests, whose answers are shipped as fingerprints. */
       expected?: unknown; difference: (string | number)[] | null } & Counts)
  | ({ kind: "TimeLimitExceeded"; test: TestRef; input: Input; limitMs: number } & Counts)
  | ({ kind: "RuntimeError"; test: TestRef | null; input: Input | null; message: string } & Counts)
  | { kind: "CompileError"; diagnostics: Diagnostic[] }
  | ({ kind: "Cancelled" } & Counts);

export interface Progress { done: number; total: number; test: string }

export interface JudgeOptions {
  source: string;
  contract: Contract;
  tests: JudgeTest[];
  /** Diagnostics and transpiling come from the editor's code checker. */
  checker: { diagnostics(source: string): Promise<Diagnostic[]>; transpile(source: string): Promise<string> };
  runner: Runner;
  timeLimitMs: number;
  onProgress?(p: Progress): void;
  signal?: AbortSignal;
}

/** Syntax and contract problems stop a run; type errors alone don't. */
export const blocksRun = (d: Diagnostic) => d.category !== "type";

export async function judge(o: JudgeOptions): Promise<Verdict> {
  const diagnostics = await o.checker.diagnostics(o.source);
  const blocking = diagnostics.filter(blocksRun);
  if (blocking.length) return { kind: "CompileError", diagnostics: blocking };

  const total = o.tests.length;
  const counts = (passed: number): Counts => ({ passed, total, typeErrors: diagnostics.length });
  const cancelled = (passed: number): Verdict => ({ kind: "Cancelled", ...counts(passed) });

  const js = await o.checker.transpile(o.source);
  if (o.signal?.aborted) return cancelled(0);
  const loaded = await o.runner.load(js, o.contract.entry);
  if (!loaded.ok) {
    return o.signal?.aborted ? cancelled(0) : { kind: "RuntimeError", test: null, input: null, message: loaded.message, ...counts(0) };
  }

  let slowest: { test: TestRef; ms: number } | null = null;
  for (let index = 0; index < total; index++) {
    if (o.signal?.aborted) return cancelled(index);
    const t = o.tests[index];
    const test: TestRef = { name: t.name, category: t.category, index };
    o.onProgress?.({ done: index, total, test: t.name });

    const input = "make" in t ? t.make() : t.input;
    const result = await o.runner.run(o.contract.params.map(p => input[p.name]), o.timeLimitMs);
    if (o.signal?.aborted) return cancelled(index);

    if (result.kind === "timeout" || (result.kind === "ok" && result.ms > o.timeLimitMs)) {
      return { kind: "TimeLimitExceeded", test, input, limitMs: o.timeLimitMs, ...counts(index) };
    }
    if (result.kind === "error" || result.kind === "crash") {
      return { kind: "RuntimeError", test, input, message: result.message, ...counts(index) };
    }

    const right = "answerHash" in t
      ? (await answerFingerprint(result.output)) === t.answerHash
      : sameAnswer(t.answer, result.output);
    if (!right) {
      return "answerHash" in t
        ? { kind: "WrongAnswer", test, input, actual: result.output, difference: null, ...counts(index) }
        : { kind: "WrongAnswer", test, input, actual: result.output, expected: t.answer, difference: firstDifference(t.answer, result.output), ...counts(index) };
    }
    if (!slowest || result.ms > slowest.ms) slowest = { test, ms: result.ms };
  }
  o.onProgress?.({ done: total, total, test: "" });
  return { kind: "Accepted", slowest, ...counts(total) };
}
