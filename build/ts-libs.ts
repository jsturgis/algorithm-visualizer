// The TypeScript standard-library declarations the code checker needs (ES2023, no DOM), read from the
// browser-runnable TypeScript package. Used directly in Node, and by the Vite plugin to ship them to the browser.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const TS_LIB_ROOT = "es2023";

export function loadTsLibs(): Record<string, string> {
  const dir = path.dirname(createRequire(import.meta.url).resolve("typescript-js/lib/lib.d.ts"));
  const libs: Record<string, string> = {};
  const queue = [TS_LIB_ROOT];
  while (queue.length) {
    const name = `lib.${queue.pop()}.d.ts`;
    if (libs[name]) continue;
    libs[name] = readFileSync(path.join(dir, name), "utf8");
    for (const m of libs[name].matchAll(/<reference lib="([^"]+)"/g)) queue.push(m[1]);
  }
  return libs;
}
