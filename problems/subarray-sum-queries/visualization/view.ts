// nums with the current query's range highlighted, the prefix sum under it, and the answers so far.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, QueryStep } from "./trace.ts";

let numsEl: HTMLElement, prefixEl: HTMLElement, answersEl: HTMLElement, calcEl: HTMLElement;
let input: Input;

const view: View<Input, QueryStep> = {
  markup: `
    <div>
      <p class="label">nums</p><div class="strip-scroll"><div class="strip" id="nums"></div></div>
      <p class="label">prefix</p><div class="strip-scroll"><div class="strip" id="prefix"></div></div>
      <p class="sum-line" id="calc"></p>
      <p class="label">answers (one per query)</p><div class="strip-scroll"><div class="strip" id="answers"></div></div>
    </div>`,
  vars: [{ key: "limit" }, { key: "query" }, { key: "sum", tone: "curve" }],
  setup(root, inp) {
    [numsEl, prefixEl, answersEl, calcEl] = ["#nums", "#prefix", "#answers", "#calc"].map(s => root.querySelector<HTMLElement>(s)!);
    numsEl.innerHTML = prefixEl.innerHTML = answersEl.innerHTML = ""; input = inp;
  },
  render(s) {
    const r = s.range;
    drawStrip(numsEl, {
      values: input.nums,
      state: k => (r && k === r[0] && s.calc ? "cursor" : r && k >= r[0] && k <= r[1] ? "win" : s.built === k ? "cursor" : ""),
      pointers: r ? [{ name: "x", at: r[0], tone: "blue" }, { name: "y", at: r[1], tone: "red" }] : [],
    });
    drawStrip(prefixEl, {
      values: s.prefix.map(v => v ?? ""),
      state: k => (s.built === k ? "found" : r && s.calc && (k === r[0] || k === r[1]) ? "cursor" : s.prefix[k] !== null ? "done" : ""),
    });
    drawStrip(answersEl, {
      values: input.queries.map((_, k) => (k < s.answers.length ? String(s.answers[k]) : "?")),
      state: k => (k < s.answers.length ? (s.answers[k] ? "found" : "bad") : k === s.q ? "cursor" : ""),
      pointers: [{ name: "q", at: s.q, tone: "amber" }],
    });
    calcEl.textContent = s.calc;
  },
};

export default view;
