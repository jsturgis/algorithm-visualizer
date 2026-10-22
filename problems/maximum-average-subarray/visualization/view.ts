// nums with the fixed-size window highlighted; the entering element is amber, the leaving one red.
import { drawWindow } from "../../../src/runtime/window.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { FixedWindowStep, Input } from "./trace.ts";

let strip: HTMLElement, calc: HTMLElement;
let nums: number[];

const view: View<Input, FixedWindowStep> = {
  markup: `<div><p class="label">nums (window highlighted)</p><div class="strip-scroll"><div class="strip" id="nums"></div></div><p class="sum-line" id="calc"></p></div>`,
  vars: [{ key: "k" }, { key: "i" }, { key: "sum", tone: "curve" }, { key: "best", tone: "goal" }],
  setup(root, input) { strip = root.querySelector<HTMLElement>("#nums")!; calc = root.querySelector<HTMLElement>("#calc")!; strip.innerHTML = ""; nums = input.nums; },
  render(s) { drawWindow(strip, nums, s); calc.textContent = s.calc; },
};

export default view;
