// nums with the window highlighted between left and right; the longest window flashes green.
import { drawWindow } from "../../../src/runtime/window.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, SumWindowStep } from "./trace.ts";

let strip: HTMLElement;
let nums: number[];

const view: View<Input, SumWindowStep> = {
  markup: `<div><p class="label">nums (window highlighted)</p><div class="strip-scroll"><div class="strip" id="nums"></div></div></div>`,
  vars: [{ key: "k" }, { key: "left" }, { key: "right" }, { key: "sum", tone: "curve" }, { key: "window length" }, { key: "best", tone: "goal" }],
  setup(root, input) { strip = root.querySelector<HTMLElement>("#nums")!; strip.innerHTML = ""; nums = input.nums; },
  render(s) { drawWindow(strip, nums, s); },
};

export default view;
