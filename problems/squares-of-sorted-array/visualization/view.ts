// nums with left / right pointers, and result filling from the back.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, SquaresStep } from "./trace.ts";

let numsEl: HTMLElement, resultEl: HTMLElement;
let nums: number[];

const view: View<Input, SquaresStep> = {
  markup: `
    <div>
      <p class="label">nums</p>
      <div class="strip-scroll"><div class="strip" id="nums"></div></div>
      <p class="label">result</p>
      <div class="strip-scroll"><div class="strip" id="result"></div></div>
    </div>`,
  vars: [{ key: "left" }, { key: "right" }, { key: "|nums[left]|", tone: "curve" }, { key: "|nums[right]|", tone: "curve" }, { key: "k", tone: "goal" }],

  setup(root, input) {
    numsEl = root.querySelector<HTMLElement>("#nums")!;
    resultEl = root.querySelector<HTMLElement>("#result")!;
    numsEl.innerHTML = resultEl.innerHTML = "";
    nums = input.nums;
  },

  render(s) {
    const used = (i: number) => i < s.left || i > s.right;
    drawStrip(numsEl, {
      values: nums,
      state: i => (s.took === "left" && i === s.left) || (s.took === "right" && i === s.right) ? "cursor" : used(i) ? "out" : "",
      pointers: s.k === null ? [] : [{ name: "left", at: s.left, tone: "blue" }, { name: "right", at: s.right, tone: "red" }],
    });
    drawStrip(resultEl, {
      values: s.out.map(v => v ?? ""),
      state: i => (i === s.wrote ? "found" : s.out[i] !== null ? "done" : ""),
      pointers: [{ name: "k", at: s.k, tone: "green" }],
    });
  },
};

export default view;
