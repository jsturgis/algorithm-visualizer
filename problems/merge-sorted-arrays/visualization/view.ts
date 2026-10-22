// arr1 and arr2 with their pointers, and the merged array growing underneath.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, MergeStep } from "./trace.ts";

let a1: HTMLElement, a2: HTMLElement, out: HTMLElement;
let input: Input;

const view: View<Input, MergeStep> = {
  markup: `
    <div>
      <p class="label">arr1</p><div class="strip-scroll"><div class="strip" id="arr1"></div></div>
      <p class="label">arr2</p><div class="strip-scroll"><div class="strip" id="arr2"></div></div>
      <p class="label">merged</p><div class="strip-scroll"><div class="strip" id="merged"></div></div>
    </div>`,
  vars: [{ key: "i" }, { key: "j" }, { key: "arr1[i]", tone: "curve" }, { key: "arr2[j]", tone: "curve" }, { key: "merged.length", tone: "goal" }],

  setup(root, inp) {
    [a1, a2, out] = ["#arr1", "#arr2", "#merged"].map(sel => root.querySelector<HTMLElement>(sel)!);
    a1.innerHTML = a2.innerHTML = out.innerHTML = "";
    input = inp;
  },

  render(s) {
    const total = input.arr1.length + input.arr2.length;
    drawStrip(a1, {
      values: input.arr1,
      state: k => (s.comparing && k === s.i ? "cursor" : s.from === 1 && k === s.i - 1 ? "done" : k < s.i ? "out" : ""),
      pointers: [{ name: "i", at: s.i, tone: "blue" }],
    });
    drawStrip(a2, {
      values: input.arr2,
      state: k => (s.comparing && k === s.j ? "cursor" : s.from === 2 && k === s.j - 1 ? "done" : k < s.j ? "out" : ""),
      pointers: [{ name: "j", at: s.j, tone: "red" }],
    });
    drawStrip(out, {
      values: Array.from({ length: total }, (_, k) => s.merged[k] ?? ""),
      state: k => (k === s.merged.length - 1 && s.from ? "found" : k < s.merged.length ? "done" : ""),
    });
  },
};

export default view;
