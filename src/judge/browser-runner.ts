// The judge's worker runner in the browser: a fresh Web Worker per run, started from the sandbox source.
import { workerRunner, type Runner, type WorkerLike } from "./runner.ts";
import { SANDBOX_SOURCE } from "./sandbox.ts";

let url: string | null = null;

export function browserRunner(): Runner {
  url ??= URL.createObjectURL(new Blob([SANDBOX_SOURCE], { type: "text/javascript" }));
  return workerRunner((): WorkerLike => {
    const w = new Worker(url!, { name: "test-runner" });
    let onError: (message: string) => void = () => {};
    w.onerror = e => { e.preventDefault(); onError(e.message || "The test runner crashed (it may have run out of memory)."); };
    w.onmessageerror = () => onError("The test runner sent back a value that couldn't be read.");
    return {
      post: m => w.postMessage(m),
      onMessage: cb => { w.onmessage = e => cb(e.data); },
      onError: cb => { onError = cb; },
      terminate: () => w.terminate(),
    };
  });
}
