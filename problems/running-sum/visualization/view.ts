// nums above prefix; each new running total lights up under the number it adds.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, RunningStep } from "./trace.ts";

let numsEl: HTMLElement, prefixEl: HTMLElement;
let nums: number[];

const view: View<Input, RunningStep> = {
  markup: `
    <div>
      <p class="label">nums</p><div class="strip-scroll"><div class="strip" id="nums"></div></div>
      <p class="label">prefix (running sum)</p><div class="strip-scroll"><div class="strip" id="prefix"></div></div>
    </div>`,
  vars: [{ key: "i" }, { key: "nums[i]", tone: "curve" }, { key: "prefix[i - 1]", tone: "goal" }],
  setup(root, input) {
    numsEl = root.querySelector<HTMLElement>("#nums")!; prefixEl = root.querySelector<HTMLElement>("#prefix")!;
    numsEl.innerHTML = prefixEl.innerHTML = ""; nums = input.nums;
  },
  render(s) {
    const added = s.wrote ?? -1;
    drawStrip(numsEl, { values: nums, state: k => (k === added ? "cursor" : k < added || s.wrote === null && s.i === null && s.result !== undefined ? "done" : "") });
    drawStrip(prefixEl, {
      values: s.prefix.map(v => v ?? ""),
      state: k => (k === s.wrote ? "found" : k === added - 1 ? "done" : s.prefix[k] !== null ? "done" : ""),
      pointers: [{ name: "i", at: s.i, tone: "blue" }],
    });
  },
};

export default view;
