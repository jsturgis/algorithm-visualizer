// The character array with left / right pointers; swapped pairs light up, finished ends turn green.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, ReverseStep } from "./trace.ts";

let strip: HTMLElement;
let n = 0;

const view: View<Input, ReverseStep> = {
  markup: `
    <div>
      <p class="label">s</p>
      <div class="strip-scroll"><div class="strip" id="s"></div></div>
    </div>`,

  vars: [{ key: "left" }, { key: "right" }, { key: "s[left]", tone: "curve" }, { key: "s[right]", tone: "curve" }],

  setup(root, input) {
    strip = root.querySelector<HTMLElement>("#s")!;
    strip.innerHTML = "";
    n = input.s.length;
  },

  render(st) {
    // Positions outside [left, right] are already in their final place.
    const settled = (i: number) => st.left === null || i < st.done || i > n - 1 - st.done;
    drawStrip(strip, {
      values: st.s,
      state: i => (st.swapped && (i === st.swapped[0] || i === st.swapped[1]) ? "cursor" : settled(i) ? "found" : ""),
      pointers: [{ name: "left", at: st.left, tone: "blue" }, { name: "right", at: st.right, tone: "red" }],
    });
  },
};

export default view;
