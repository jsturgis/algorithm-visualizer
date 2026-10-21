// The judge's worker runner on Node worker threads, running the same sandbox code as the browser.
// Used by tests (and could be used by a CLI); never bundled into the site.
import { Worker } from "node:worker_threads";
import { workerRunner, type Runner, type WorkerLike } from "./runner.ts";
import { SANDBOX_SOURCE } from "./sandbox.ts";

export function nodeRunner(graceMs?: number): Runner {
  return workerRunner((): WorkerLike => {
    const w = new Worker(SANDBOX_SOURCE, { eval: true });
    let onError: (message: string) => void = () => {};
    w.on("error", (e: Error) => onError(e.message));
    w.on("exit", code => onError(`The test runner stopped (exit code ${code}).`));
    return {
      post: m => w.postMessage(m),
      onMessage: cb => { w.on("message", cb); },
      onError: cb => { onError = cb; },
      terminate: () => { onError = () => {}; void w.terminate(); },
    };
  }, graceMs);
}
