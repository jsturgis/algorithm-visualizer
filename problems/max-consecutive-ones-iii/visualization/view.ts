// nums with the window highlighted; the 0s inside it are the ones we'd flip.
import { drawWindow } from "../../../src/runtime/window.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, OnesStep } from "./trace.ts";

let strip: HTMLElement;
let nums: number[];

const view: View<Input, OnesStep> = {
  markup: `<div><p class="label">nums (window highlighted)</p><div class="strip-scroll"><div class="strip" id="nums"></div></div></div>`,
  vars: [{ key: "k" }, { key: "left" }, { key: "right" }, { key: "zeros", tone: "low" }, { key: "best", tone: "goal" }],
  setup(root, input) { strip = root.querySelector<HTMLElement>("#nums")!; strip.innerHTML = ""; nums = input.nums; },
  render(s) { drawWindow(strip, nums, s); },
};

export default view;
