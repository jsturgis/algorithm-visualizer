// nums with the window highlighted, and how many subarrays the latest right end added.
import { drawWindow } from "../../../src/runtime/window.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, ProductStep } from "./trace.ts";

let strip: HTMLElement, line: HTMLElement;
let nums: number[];

const view: View<Input, ProductStep> = {
  markup: `<div><p class="label">nums (window highlighted)</p><div class="strip-scroll"><div class="strip" id="nums"></div></div><p class="sum-line" id="added"></p></div>`,
  vars: [{ key: "k" }, { key: "left" }, { key: "right" }, { key: "product", tone: "curve" }, { key: "count", tone: "goal" }],
  setup(root, input) { strip = root.querySelector<HTMLElement>("#nums")!; line = root.querySelector<HTMLElement>("#added")!; strip.innerHTML = ""; nums = input.nums; },
  render(s) {
    drawWindow(strip, nums, s);
    line.textContent = s.added === null ? "" : `+${s.added} subarray${s.added === 1 ? "" : "s"} ending at ${s.right}`;
  },
};

export default view;
