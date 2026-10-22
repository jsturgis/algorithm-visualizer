// The sorted numbers with left / right pointers; ruled-out numbers fade, a found pair turns green.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, PairStep } from "./trace.ts";

let strip: HTMLElement, sumEl: HTMLElement;
let nums: number[];

const view: View<Input, PairStep> = {
  markup: `
    <div>
      <p class="label">nums</p>
      <div class="strip-scroll"><div class="strip" id="nums"></div></div>
      <p class="sum-line" id="sum"></p>
    </div>`,
  vars: [{ key: "target" }, { key: "left" }, { key: "right" }, { key: "sum", tone: "curve" }],

  setup(root, input) {
    strip = root.querySelector<HTMLElement>("#nums")!;
    sumEl = root.querySelector<HTMLElement>("#sum")!;
    strip.innerHTML = "";
    nums = input.nums;
  },

  render(s) {
    drawStrip(strip, {
      values: nums,
      state: i => {
        const pointed = i === s.left || i === s.right;
        if (s.found && pointed) return "found";
        if (s.comparing && pointed) return "cursor";
        return i < s.left || i > s.right ? "out" : "";
      },
      pointers: s.left <= s.right ? [{ name: "left", at: s.left, tone: "blue" }, { name: "right", at: s.right, tone: "red" }] : [],
    });
    sumEl.textContent = s.sumText;
  },
};

export default view;
