// Draws the judge's progress and verdict in the code panel. Loaded with the judge on the first Run tests.
import "./judge.css";
import { canonical } from "../runtime/answers.ts";
import { esc } from "../runtime/player.ts";
import type { Contract, Input } from "../runtime/types.ts";
import { BROWSER_TIME_MULTIPLIER } from "../runtime/types.ts";
import type { Progress, TestCategory, TestRef, Verdict } from "./judge.ts";

export { judge } from "./judge.ts";
export { browserRunner } from "./browser-runner.ts";

const CATEGORY: Record<TestCategory, string> = {
  sample: "a sample from the problem statement",
  edge: "an edge case",
  random: "a random test",
  large: "a maximum-size test",
};
const num = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, word: string) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;
const MAX_ITEMS = 24;

/** A value as JSON, shortened around `at` (an array index) for long arrays, with that element marked. */
export function formatValue(v: unknown, at: number | null = null): string {
  if (!Array.isArray(v) || v.some(x => x !== null && typeof x === "object")) {
    const s = canonical(v) ?? "undefined";
    return esc(s.length > 400 ? s.slice(0, 400) + "…" : s);
  }
  const n = v.length;
  let from = 0, to = n;
  if (n > MAX_ITEMS) {
    from = at === null ? 0 : Math.max(0, Math.min(at - MAX_ITEMS / 2, n - MAX_ITEMS));
    to = from + MAX_ITEMS;
  }
  const items = v.slice(from, to).map((x, i) => {
    const s = esc(canonical(x) ?? "undefined");
    return from + i === at ? `<mark title="index ${from + i}">${s}</mark>` : s;
  });
  if (at === n) items.push(`<mark class="missing" title="index ${n}">…</mark>`);   // shorter than expected
  return `[${from > 0 ? `… ${num(from)} more, ` : ""}${items.join(", ")}${to < n ? `, … ${num(n - to)} more` : ""}]` +
    (n > MAX_ITEMS ? ` <span class="count">(${num(n)} items)</span>` : "");
}

function copyButton(value: unknown, label: string) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "copy";
  b.textContent = "Copy";
  b.title = `Copy the full ${label} as JSON`;
  b.onclick = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(value)); b.textContent = "Copied"; }
    catch { b.textContent = "Couldn't copy"; }
    setTimeout(() => (b.textContent = "Copy"), 1500);
  };
  return b;
}

function row(dl: HTMLElement, term: string, html: string, copy?: { value: unknown; label: string }) {
  const dt = dl.appendChild(document.createElement("dt"));
  dt.textContent = term;
  const dd = dl.appendChild(document.createElement("dd"));
  const code = dd.appendChild(document.createElement("code"));
  code.innerHTML = html;
  if (copy) dd.appendChild(copyButton(copy.value, copy.label));
}

const where = (t: TestRef, total: number) =>
  `On test ${num(t.index + 1)} of ${num(total)}: <code>${esc(t.name)}</code>, ${CATEGORY[t.category]}`;

export function renderProgress(el: HTMLElement, p: Progress | null, onCancel: () => void) {
  el.hidden = false;
  el.className = "verdict running";
  delete el.dataset.verdict;
  el.innerHTML = `<p class="progress-line"><span class="spinner" aria-hidden="true"></span>
    <span>${p ? `Running test ${num(Math.min(p.done + 1, p.total))} of ${num(p.total)}${p.test ? ` <code>${esc(p.test)}</code>` : ""}…` : "Loading the tests…"}</span></p>`;
  const cancel = el.appendChild(document.createElement("button"));
  cancel.type = "button";
  cancel.dataset.judge = "cancel";
  cancel.textContent = "Cancel";
  cancel.onclick = onCancel;
}

export function renderVerdict(el: HTMLElement, v: Verdict, contract: Contract) {
  el.hidden = false;
  el.innerHTML = "";
  const kind = { Accepted: "accepted", WrongAnswer: "wrong", TimeLimitExceeded: "tle", RuntimeError: "rte", CompileError: "compile", Cancelled: "cancelled" }[v.kind];
  el.className = `verdict ${kind}`;
  el.dataset.verdict = v.kind;
  const title = { Accepted: "Accepted", WrongAnswer: "Wrong Answer", TimeLimitExceeded: "Time Limit Exceeded", RuntimeError: "Runtime Error", CompileError: "Compile Error", Cancelled: "Cancelled" }[v.kind];
  const head = el.appendChild(document.createElement("p"));
  head.className = "verdict-title";
  head.innerHTML = `<strong>${title}</strong>`;
  const summary = el.appendChild(document.createElement("p"));
  summary.className = "verdict-summary";

  const showInput = (input: Input) => {
    const dl = el.appendChild(document.createElement("dl"));
    for (const p of contract.params) row(dl, p.name, formatValue(input[p.name]), { value: input[p.name], label: p.name });
    return dl;
  };

  switch (v.kind) {
    case "Accepted":
      summary.innerHTML = `All ${plural(v.total, "test")} passed.` +
        (v.slowest ? ` Slowest: <code>${esc(v.slowest.test.name)}</code>, ${v.slowest.ms.toFixed(1)} ms.` : "");
      break;
    case "WrongAnswer": {
      summary.innerHTML = `${where(v.test, v.total)}. ${plural(v.passed, "test")} passed before it.`;
      const dl = showInput(v.input);
      const at = v.difference && v.difference.length === 1 && typeof v.difference[0] === "number" ? v.difference[0] : null;
      if ("expected" in v) row(dl, "expected", formatValue(v.expected, at), { value: v.expected, label: "expected answer" });
      else row(dl, "expected", `<span class="hidden-answer">Not shown for maximum-size tests: only a fingerprint of the answer is downloaded.</span>`);
      row(dl, "your output", formatValue(v.actual, at), { value: v.actual, label: "output" });
      if (at !== null) {
        const note = el.appendChild(document.createElement("p"));
        note.className = "difference";
        note.textContent = `First difference at index ${num(at)}.`;
      }
      break;
    }
    case "TimeLimitExceeded":
      summary.innerHTML = `${where(v.test, v.total)}. It ran longer than ${num(v.limitMs)} ms ` +
        `(the problem's ${num(v.limitMs / BROWSER_TIME_MULTIPLIER)} ms × ${BROWSER_TIME_MULTIPLIER} for running in a browser). ` +
        `${plural(v.passed, "test")} passed before it.` + (v.test.category === "large" ? " A faster algorithm is needed." : " Check for a loop that never ends.");
      showInput(v.input);
      break;
    case "RuntimeError": {
      summary.innerHTML = v.test ? `${where(v.test, v.total)}. ${plural(v.passed, "test")} passed before it.` : "While loading your code, before any test ran.";
      const pre = el.appendChild(document.createElement("pre"));
      pre.className = "error-message";
      pre.textContent = v.message;
      if (v.input) showInput(v.input);
      break;
    }
    case "CompileError":
      summary.textContent = `Your code can't run until the ${plural(v.diagnostics.length, "syntax or contract problem")} listed above ${v.diagnostics.length === 1 ? "is" : "are"} fixed.`;
      break;
    case "Cancelled":
      summary.textContent = `Stopped after ${plural(v.passed, "test")} of ${num(v.total)}.`;
      break;
  }
  if (v.kind !== "CompileError" && v.typeErrors) {
    const note = el.appendChild(document.createElement("p"));
    note.className = "type-note";
    note.textContent = `Ran despite ${plural(v.typeErrors, "type error")}.`;
  }
}
