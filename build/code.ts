// Turns an accepted solution into the code shown on its page.
//
// A line ending in `// @line <label>` can be highlighted by a trace step with `line: "<label>"`.
// The marker is removed from the displayed code, as is the `export` keyword.
import type { Code } from "../src/runtime/types.ts";

const MARKER = /\s*\/\/\s*@line\s+([\w-]+)\s*$/;

export function toDisplayCode(source: string): Code {
  const lines: string[] = [];
  const labels: Record<string, number> = {};
  for (const raw of source.replace(/\r\n/g, "\n").trimEnd().split("\n")) {
    const m = raw.match(MARKER);
    lines.push((m ? raw.slice(0, m.index) : raw).replace(/^export (?=function|const|default)/, ""));
    if (m) {
      if (labels[m[1]]) throw new Error(`Duplicate @line label "${m[1]}"`);
      labels[m[1]] = lines.length;
    }
  }
  return { lines, labels };
}
