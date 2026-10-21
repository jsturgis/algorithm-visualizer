// Three aligned rows. nums and avgs get an empty first column so prefix[j + 1] sits under nums[j].
import "./view.css";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, KRadiusStep } from "./trace.ts";

let root: HTMLElement;
let nums: number[];
const $ = (id: string) => root.querySelector<HTMLElement>("#" + id)!;

const view: View<Input, KRadiusStep> = {
  markup: `
    <div>
      <p class="legend">
        <span><i style="border-color:var(--curve);background:var(--curve-soft)"></i>in the window</span>
        <span><i style="border-color:var(--cur);background:var(--cur-soft)"></i>reading / sum through window end</span>
        <span><i style="border-color:var(--low);background:var(--low-soft)"></i>sum before window start</span>
        <span><i style="border-color:var(--goal);background:var(--goal-soft)"></i>value written</span>
      </p>
      <div class="strip-scroll">
        <div class="rows">
          <p class="row-label">nums</p>
          <div class="strip" id="nums"></div>
          <p class="row-label">prefix</p>
          <div class="strip" id="prefix"></div>
          <p class="row-label">avgs</p>
          <div class="strip" id="avgs"></div>
        </div>
      </div>
      <p class="sum" id="sum"></p>
    </div>`,

  vars: [{ key: "k" }, { key: "size" }, { key: "i" }, { key: "window" }, { key: "sum", tone: "curve" }, { key: "avg", tone: "goal" }],

  setup(el, input) {
    root = el;
    nums = input.nums;
    const spacer = `<div class="cell"><div class="spacer"></div></div>`;
    $("nums").innerHTML = spacer + nums.map((v, j) =>
      `<div class="cell"><div class="box" id="n${j}">${v}</div><span class="idx">${j}</span><div class="ptrs" id="pn${j}"></div></div>`).join("");
    $("prefix").innerHTML = [0, ...nums].map((_, j) =>
      `<div class="cell"><div class="box" id="p${j}"></div><span class="idx">${j}</span><div class="ptrs" id="pp${j}"></div></div>`).join("");
    $("avgs").innerHTML = spacer + nums.map((_, j) => `<div class="cell"><div class="box" id="a${j}"></div></div>`).join("");
  },

  render(s) {
    nums.forEach((_, j) => {
      const inWin = s.win && j >= s.win[0] && j <= s.win[1];
      $("n" + j).className = "box" + (j === s.read ? " cursor" : inWin ? " done" : "");
      $("pn" + j).innerHTML = j === s.center ? `<span class="ptr center">center</span>` : "";
      const a = s.avgs[j], box = $("a" + j);
      box.textContent = a == null ? "" : String(a);
      box.className = "box" + (j === s.wroteA ? " found" : a == null ? " unset" : a === -1 ? "" : " done");
    });
    s.prefix.forEach((v, j) => {
      const box = $("p" + j);
      box.textContent = v == null ? "" : String(v);
      box.className = "box" + (j === s.wroteP ? " found" : j === s.sub ? " sub" : j === s.add ? " cursor" : v == null ? " unset" : "");
      const tags: string[] = [];
      if (s.win && j === s.add) tags.push(`<span class="ptr add">i+k+1</span>`);
      if (s.win && j === s.sub) tags.push(`<span class="ptr sub">i−k</span>`);
      $("pp" + j).innerHTML = tags.join("");
    });
    $("sum").innerHTML = s.sumText;
  },
};

export default view;
