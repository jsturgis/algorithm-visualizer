// Runs the code checker off the page's main thread. Loaded only when the learner first clicks Edit.
import libs from "virtual:ts-libs";
import { createChecker, type Checker } from "./checker.ts";
import type { Request, Response } from "./transport.ts";

let checker: Checker | null = null;

self.onmessage = (e: MessageEvent<Request>) => {
  const req = e.data;
  const reply = (r: Omit<Response, "id">) => (self as unknown as Worker).postMessage({ ...r, id: req.id });
  try {
    if (req.op === "init") { checker = createChecker(req.contract, libs); reply({ result: true }); return; }
    if (!checker) throw new Error("Checker used before init");
    switch (req.op) {
      case "diagnostics": reply({ result: checker.diagnostics(req.source) }); break;
      case "transpile": reply({ result: checker.transpile(req.source) }); break;
      case "completions": reply({ result: checker.completions(req.source, req.offset) }); break;
      case "hover": reply({ result: checker.hover(req.source, req.offset) }); break;
    }
  } catch (err) {
    reply({ error: (err as Error).message });
  }
};
