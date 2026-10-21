// The picture: `markup` goes in the stage panel, `setup` builds it for an input, `render` updates it per step.
import type { View } from "../../../src/runtime/types.ts";
import type { Input, MaxStep } from "./trace.ts";

let root: HTMLElement;
let nums: number[];
const $ = (id: string) => root.querySelector<HTMLElement>("#" + id)!;

const view: View<Input, MaxStep> = {
  markup: `
    <div>
      <p class="label">nums</p>
      <div class="strip-scroll"><div class="strip" id="strip"></div></div>
    </div>`,

  vars: [{ key: "i" }, { key: "nums[i]" }, { key: "best", tone: "goal" }],

  setup(el, input) {
    root = el;
    nums = input.nums;
    $("strip").innerHTML = nums.map((v, k) =>
      `<div class="cell"><div class="box" id="b${k}">${v}</div><span class="idx">${k}</span></div>`).join("");
  },

  render(s) {
    nums.forEach((_, k) => {
      $("b" + k).className = "box" + (k === s.cursor ? " cursor" : k === s.bestIdx ? " found" : "");
    });
  },
};

export default view;
