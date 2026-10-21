// The sorted array with lo / mid / hi labels; ruled-out boxes fade.
import "./view.css";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, SearchStep } from "./trace.ts";

let root: HTMLElement;
let nums: number[];
const $ = (id: string) => root.querySelector<HTMLElement>("#" + id)!;

const view: View<Input, SearchStep> = {
  markup: `
    <div>
      <p class="label">nums (sorted)</p>
      <div class="strip-scroll"><div class="strip" id="strip"></div></div>
      <p class="range" id="range"></p>
    </div>`,

  vars: [{ key: "target" }, { key: "nums[mid]", tone: "curve" }, { key: "lo" }, { key: "hi" }, { key: "mid" }, { key: "result", tone: "goal" }],

  // Custom input doesn't have to be sorted or distinct; the page fixes it up.
  prepare: input => ({ ...input, nums: [...new Set(input.nums)].sort((a, b) => a - b) }),

  setup(el, input) {
    root = el;
    nums = input.nums;
    $("strip").innerHTML = nums.map((v, k) =>
      `<div class="cell"><div class="box" id="b${k}">${v}</div><span class="idx">${k}</span><div class="ptrs" id="p${k}"></div></div>`).join("");
  },

  render(s) {
    nums.forEach((_, k) => {
      const out = k < s.lo || k > s.hi;
      $("b" + k).className = "box" + (k === s.mid ? (s.found ? " found" : " cursor") : out ? " out" : "");
      $("p" + k).innerHTML = ([["lo", s.lo], ["mid", s.mid], ["hi", s.hi]] as const)
        .filter(([, i]) => i === k).map(([name]) => `<span class="ptr ${name}">${name}</span>`).join("");
    });
    $("range").textContent = s.lo <= s.hi ? `still searching indices ${s.lo}–${s.hi}` : "nothing left to search";
  },
};

export default view;
