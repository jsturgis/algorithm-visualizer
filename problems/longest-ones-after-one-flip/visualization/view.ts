// The 0/1 string with the window highlighted; the 0 inside the window is the one we'd flip.
import { drawWindow } from "../../../src/runtime/window.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { FlipStep, Input } from "./trace.ts";

let strip: HTMLElement;
let chars: string[];

const view: View<Input, FlipStep> = {
  markup: `<div><p class="label">s (window highlighted)</p><div class="strip-scroll"><div class="strip" id="s"></div></div></div>`,
  vars: [{ key: "left" }, { key: "right" }, { key: "zeros", tone: "low" }, { key: "window length" }, { key: "best", tone: "goal" }],
  setup(root, input) { strip = root.querySelector<HTMLElement>("#s")!; strip.innerHTML = ""; chars = [...input.s]; },
  render(s) { drawWindow(strip, chars, s); },
};

export default view;
