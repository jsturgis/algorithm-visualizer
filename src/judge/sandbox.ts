// The code that runs inside the judge's worker, as source text. The browser starts it from a Blob URL;
// tests start it in a Node worker thread, so both run exactly this code.
//
// Messages in:  { op: "load", js, entry }   { op: "run", args }
// Messages out: { op: "loaded" } | { op: "load-error", message }
//               { op: "result", output, ms } | { op: "error", message, ms }
export const SANDBOX_SOURCE = String.raw`
"use strict";
const isNode = typeof self === "undefined";
const port = isNode ? require("node:worker_threads").parentPort : self;
const send = msg => port.postMessage(msg);

// The learner's code gets no network or script loading. It only ever runs in their own browser,
// so this protects against mistakes, not attackers.
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "Worker", "SharedWorker", "indexedDB", "caches"]) {
  try { Object.defineProperty(globalThis, name, { value: undefined, configurable: false, writable: false }); } catch {}
}

const describe = e => (e instanceof Error ? e.name + ": " + e.message : "Threw " + String(e));
let entry = null;

function onMessage(msg) {
  if (msg.op === "load") {
    try {
      const exports = {}, module = { exports };
      const body = msg.js + "\n;return typeof " + msg.entry + " === \"function\" ? " + msg.entry + " : module.exports." + msg.entry + ";";
      entry = new Function("exports", "module", body)(exports, module);
      if (typeof entry !== "function") throw new Error(msg.entry + " is not a function");
      send({ op: "loaded" });
    } catch (e) {
      send({ op: "load-error", message: describe(e) });
    }
    return;
  }
  if (msg.op === "run") {
    const start = performance.now();
    let output;
    try {
      output = entry(...msg.args);
    } catch (e) {
      send({ op: "error", message: describe(e), ms: performance.now() - start });
      return;
    }
    const ms = performance.now() - start;
    try {
      send({ op: "result", output, ms });
    } catch (e) {
      send({ op: "error", message: "Returned a value that can't be compared (" + describe(e) + ")", ms });
    }
  }
}

if (isNode) port.on("message", onMessage); else self.onmessage = e => onMessage(e.data);
`;
