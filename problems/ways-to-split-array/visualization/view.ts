// nums split into a left part (blue) and a right part, with the two sums; valid split points turn green.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, SplitStep } from "./trace.ts";

let strip: HTMLElement, calcEl: HTMLElement;
let nums: number[];

const view: View<Input, SplitStep> = {
  markup: `<div><p class="label">nums (left part highlighted)</p><div class="strip-scroll"><div class="strip" id="nums"></div></div><p class="sum-line" id="calc"></p></div>`,
  vars: [{ key: "total" }, { key: "i" }, { key: "left", tone: "curve" }, { key: "right" }, { key: "ways", tone: "goal" }],
  setup(root, input) { strip = root.querySelector<HTMLElement>("#nums")!; calcEl = root.querySelector<HTMLElement>("#calc")!; strip.innerHTML = ""; nums = input.nums; },
  render(s) {
    drawStrip(strip, {
      values: nums,
      state: k => (s.split !== null && k === s.split ? (s.valid === true ? "found" : s.valid === false ? "bad" : "cursor") : s.split !== null && k < s.split ? "win" : s.split === null && s.validSplits.includes(k) ? "found" : ""),
      pointers: [{ name: "split", at: s.split, tone: "amber" }],
    });
    calcEl.textContent = s.calc;
  },
};

export default view;
