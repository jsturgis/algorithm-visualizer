// How the editor talks to the code checker: one async interface, two implementations.
// The page uses a Web Worker so type checking never blocks the page; tests use the checker in-process.
import type { Checker, Completions, Diagnostic, HoverInfo } from "./checker.ts";
import type { Contract } from "../runtime/types.ts";

export interface AsyncChecker {
  diagnostics(source: string): Promise<Diagnostic[]>;
  completions(source: string, offset: number): Promise<Completions | null>;
  hover(source: string, offset: number): Promise<HoverInfo | null>;
  transpile(source: string): Promise<string>;
  dispose(): void;
}

/** Creates a checker for one problem's contract. Called the first time the learner clicks Edit. */
export type CheckerFactory = (contract: Contract) => Promise<AsyncChecker>;

export function inProcess(checker: Checker): AsyncChecker {
  return {
    diagnostics: async s => checker.diagnostics(s),
    completions: async (s, o) => checker.completions(s, o),
    hover: async (s, o) => checker.hover(s, o),
    transpile: async s => checker.transpile(s),
    dispose: () => {},
  };
}

export type Request =
  | { id: number; op: "init"; contract: Contract }
  | { id: number; op: "diagnostics" | "transpile"; source: string }
  | { id: number; op: "completions" | "hover"; source: string; offset: number };
export type Response = { id: number; result?: unknown; error?: string };
type Call = Request extends infer R ? (R extends unknown ? Omit<R, "id"> : never) : never;

export function overWorker(worker: Worker): (contract: Contract) => Promise<AsyncChecker> {
  let next = 0;
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>();
  worker.onmessage = (e: MessageEvent<Response>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.result);
  };
  worker.onerror = e => {
    for (const p of pending.values()) p.reject(new Error(e.message || "The type checker stopped."));
    pending.clear();
  };
  const call = <T>(req: Call) => new Promise<T>((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker.postMessage({ ...req, id });
  });

  return async contract => {
    await call({ op: "init", contract });
    return {
      diagnostics: source => call({ op: "diagnostics", source }),
      completions: (source, offset) => call({ op: "completions", source, offset }),
      hover: (source, offset) => call({ op: "hover", source, offset }),
      transpile: source => call({ op: "transpile", source }),
      dispose: () => worker.terminate(),
    };
  };
}
