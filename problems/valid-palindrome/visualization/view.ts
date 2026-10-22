// The string's characters with left / right pointers; matched pairs turn green, a mismatch turns red.
import { drawStrip } from "../../../src/runtime/strip.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, PalindromeStep } from "./trace.ts";

let strip: HTMLElement;
let chars: string[];

const view: View<Input, PalindromeStep> = {
  markup: `
    <div>
      <p class="label">s</p>
      <div class="strip-scroll"><div class="strip" id="s"></div></div>
    </div>`,
  vars: [{ key: "left" }, { key: "right" }, { key: "s[left]", tone: "curve" }, { key: "s[right]", tone: "curve" }],

  setup(root, input) {
    strip = root.querySelector<HTMLElement>("#s")!;
    strip.innerHTML = "";
    chars = [...input.s];
  },

  render(st) {
    const n = chars.length;
    const isMatched = (i: number) => i < st.matched || i > n - 1 - st.matched;
    drawStrip(strip, {
      values: chars,
      state: i => {
        const pointed = i === st.left || i === st.right;
        if (st.mismatch && pointed) return "bad";
        if (st.comparing && pointed) return "cursor";
        if (isMatched(i)) return "found";
        if (st.result === true) return "found";
        return "";
      },
      pointers: [{ name: "left", at: st.left, tone: "blue" }, { name: "right", at: st.right, tone: "red" }],
    });
  },
};

export default view;
