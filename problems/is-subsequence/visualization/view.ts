// s (what we need) above t (what we scan), each with its pointer; matched characters turn green in both.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, SubseqStep } from "./trace.ts";

let sEl: HTMLElement, tEl: HTMLElement, emptyEl: HTMLElement;
let input: Input;

const view: View<Input, SubseqStep> = {
  markup: `
    <div>
      <p class="label">s (need, in order)</p><div class="strip-scroll"><div class="strip" id="s"></div></div>
      <p class="empty-note" id="s-empty" hidden>s is empty, so it's a subsequence of anything.</p>
      <p class="label">t (scan)</p><div class="strip-scroll"><div class="strip" id="t"></div></div>
    </div>`,
  vars: [{ key: "i" }, { key: "j" }, { key: "s[i]", tone: "curve" }, { key: "t[j]", tone: "curve" }],

  setup(root, inp) {
    sEl = root.querySelector<HTMLElement>("#s")!;
    tEl = root.querySelector<HTMLElement>("#t")!;
    emptyEl = root.querySelector<HTMLElement>("#s-empty")!;
    sEl.innerHTML = tEl.innerHTML = "";
    input = inp;
    emptyEl.hidden = inp.s.length > 0;
  },

  render(st) {
    drawStrip(sEl, {
      values: [...input.s],
      state: k => (k < st.i ? (st.justMatched && k === st.i - 1 ? "found" : "done") : st.comparing && k === st.i ? "cursor" : ""),
      pointers: [{ name: "i", at: st.i, tone: "blue" }],
    });
    drawStrip(tEl, {
      values: [...input.t],
      state: k => (st.matchedAt.includes(k) ? (st.justMatched && k === st.matchedAt.at(-1) ? "found" : "done") : st.comparing && k === st.j ? "cursor" : k < st.j ? "out" : ""),
      pointers: [{ name: "j", at: st.j, tone: "red" }],
    });
  },
};

export default view;
