// Runners execute the learner's compiled code one test at a time.
//
// workerRunner: in a worker (browser Web Worker or Node worker thread), with a watchdog that terminates
//   the worker when a test runs past its limit, which also stops infinite loops.
// inProcessRunner: on the calling thread, for page tests. It can't stop an infinite loop.

export type RunResult =
  | { kind: "ok"; output: unknown; ms: number }
  | { kind: "error"; message: string; ms: number }
  | { kind: "timeout"; ms: number }
  | { kind: "crash"; message: string };

export interface Runner {
  /** Compile the code. Resolves with an error message if it throws while loading. */
  load(js: string, entry: string): Promise<{ ok: true } | { ok: false; message: string }>;
  /** Run the entry function on one test's arguments. */
  run(args: unknown[], limitMs: number): Promise<RunResult>;
  /** Stop everything (cancel). Any pending run resolves as a crash. */
  dispose(): void;
}

/** The parts of a worker the runner needs, so the same host works with Web Workers and Node worker threads. */
export interface WorkerLike {
  post(message: unknown): void;
  onMessage(cb: (message: any) => void): void;
  onError(cb: (message: string) => void): void;
  terminate(): void;
}

/** Extra time beyond the limit before the watchdog terminates the worker (message passing, start-up). */
export const WATCHDOG_GRACE_MS = 250;

export function workerRunner(spawn: () => WorkerLike, graceMs = WATCHDOG_GRACE_MS): Runner {
  let worker: WorkerLike | null = null;
  let pending: ((message: any) => void) | null = null;
  let failed: ((message: string) => void) | null = null;

  const start = () => {
    const w = spawn();
    w.onMessage(m => { const p = pending; pending = failed = null; p?.(m); });
    w.onError(message => { const f = failed; pending = failed = null; f?.(message); });
    return w;
  };
  const request = (message: unknown) => new Promise<any>((resolve, reject) => {
    if (!worker) { reject(new Error("The test runner was stopped.")); return; }
    pending = resolve;
    failed = m => reject(new Error(m));
    worker.post(message);
  });
  const stop = () => {
    worker?.terminate();
    worker = null;
    const f = failed;
    pending = failed = null;
    f?.("The test runner was stopped.");
  };

  return {
    async load(js, entry) {
      stop();
      worker = start();
      try {
        const reply = await request({ op: "load", js, entry });
        return reply.op === "loaded" ? { ok: true } : { ok: false, message: reply.message };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    },

    run(args, limitMs) {
      const started = performance.now();
      return new Promise<RunResult>(resolve => {
        const timer = setTimeout(() => {
          stop();
          resolve({ kind: "timeout", ms: performance.now() - started });
        }, limitMs + graceMs);
        request({ op: "run", args }).then(
          reply => {
            clearTimeout(timer);
            resolve(reply.op === "result" ? { kind: "ok", output: reply.output, ms: reply.ms } : { kind: "error", message: reply.message, ms: reply.ms });
          },
          (e: Error) => { clearTimeout(timer); resolve({ kind: "crash", message: e.message }); },
        );
      });
    },

    dispose: stop,
  };
}

/** Runs on the calling thread. Only for tests of the page: there is no time limit. */
export function inProcessRunner(): Runner {
  let entry: ((...args: unknown[]) => unknown) | null = null;
  const describe = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : `Threw ${String(e)}`);
  return {
    async load(js, name) {
      try {
        const exports = {}, module = { exports };
        entry = new Function("exports", "module", `${js}\n;return typeof ${name} === "function" ? ${name} : module.exports.${name};`)(exports, module);
        if (typeof entry !== "function") throw new Error(`${name} is not a function`);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: describe(e) };
      }
    },
    async run(args) {
      const start = performance.now();
      try {
        const output = structuredClone(entry!(...structuredClone(args)));
        return { kind: "ok", output, ms: performance.now() - start };
      } catch (e) {
        return { kind: "error", message: describe(e), ms: performance.now() - start };
      }
    },
    dispose() { entry = null; },
  };
}
