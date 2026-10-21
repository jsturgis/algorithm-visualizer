// The nums strip plus a running-sum chart that lifts by the answer on the last step.
import "./view.css";
import { svgEl as el } from "../../../src/runtime/svg.ts";
import type { View } from "../../../src/runtime/types.ts";
import type { Input, MinStartStep } from "./trace.ts";

let root: HTMLElement;
let nums: number[];
let sums: number[];
let G: {
  g: SVGGElement; segs: SVGLineElement[]; pts: SVGCircleElement[]; vals: SVGTextElement[];
  minLine: SVGLineElement; minText: SVGTextElement; arrow: SVGPathElement; arrowT: SVGTextElement;
  xs(k: number): number; ys(v: number): number;
};
const $ = (id: string) => root.querySelector<HTMLElement>("#" + id)!;

const view: View<Input, MinStartStep> = {
  markup: `
    <div>
      <p class="label">nums</p>
      <div class="strip-scroll"><div class="strip" id="strip"></div></div>
    </div>
    <div>
      <p class="label" id="chart-label">Running sum</p>
      <div class="chart-wrap"><svg class="chart" id="chart" viewBox="0 0 640 320" role="img" aria-label="Running sum chart"></svg></div>
    </div>`,

  vars: [{ key: "num" }, { key: "total" }, { key: "minVal", tone: "low" }, { key: "startValue", tone: "goal" }],

  setup(elRoot, input) {
    root = elRoot;
    nums = input.nums;
    $("strip").innerHTML = nums.map((v, k) =>
      `<div class="cell"><div class="box" id="b${k}">${v}</div><span class="idx">${k}</span></div>`).join("");

    const svg = $("chart") as unknown as SVGSVGElement;
    svg.innerHTML = "";
    const W = 640, H = 320, L = 46, R = 24, Tp = 26, B = 34;
    const n = nums.length;
    sums = [0];
    nums.forEach(v => sums.push(sums[sums.length - 1] + v));
    const minV = Math.min(...sums), maxV = Math.max(...sums);
    const ans = 1 - Math.min(0, minV);
    const lo = Math.min(minV, 0), hi = Math.max(maxV + ans, 1);
    const span = Math.max(hi - lo, 1);
    const pad = span * 0.08;
    const y0 = lo - pad, y1 = hi + pad;
    const xs = (k: number) => L + (n === 0 ? 0 : k * (W - L - R) / n);
    const ys = (v: number) => Tp + (y1 - v) * (H - Tp - B) / (y1 - y0);

    const rawStep = span / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const stepV = [1, 2, 5, 10].map(m => m * mag).find(s => s >= rawStep) || 10 * mag;
    const tickStep = Math.max(1, Math.round(stepV));
    for (let v = Math.ceil(y0 / tickStep) * tickStep; v <= y1; v += tickStep) {
      el("line", { x1: L, x2: W - R, y1: ys(v), y2: ys(v), class: v === 0 ? "zero" : "grid-l" }, svg);
      el("text", { x: L - 8, y: ys(v) + 4, "text-anchor": "end", class: "tick" }, svg, v);
    }
    for (let k = 0; k <= n; k++) el("text", { x: xs(k), y: H - 10, class: "xlab" }, svg, k === 0 ? "start" : k);

    el("line", { x1: L, x2: W - R, y1: ys(1), y2: ys(1), class: "goal" }, svg);
    el("text", { x: W - R, y: ys(1) - 6, "text-anchor": "end", class: "goal-t" }, svg, "must stay ≥ 1");

    const minLine = el("line", { x1: L, x2: W - R, y1: ys(0), y2: ys(0), class: "minline" }, svg);
    const minText = el("text", { x: L + 6, y: ys(0) + 14, class: "min-t" }, svg, "");
    const arrow = el("path", { class: "arrow", d: "" }, svg);
    const arrowT = el("text", { class: "arrow-t" }, svg, "");

    const g = el("g", { class: "lift" }, svg);
    const segs: SVGLineElement[] = [], pts: SVGCircleElement[] = [], vals: SVGTextElement[] = [];
    for (let k = 1; k <= n; k++) segs.push(el("line", { x1: xs(k - 1), y1: ys(sums[k - 1]), x2: xs(k), y2: ys(sums[k]), class: "seg" }, g));
    for (let k = 0; k <= n; k++) {
      pts.push(el("circle", { cx: xs(k), cy: ys(sums[k]), r: 6, class: "pt" }, g));
      vals.push(el("text", { x: xs(k), y: ys(sums[k]) - 12, class: "val" }, g, sums[k]));
    }
    G = { g, segs, pts, vals, minLine, minText, arrow, arrowT, xs, ys };
  },

  render(s) {
    nums.forEach((_, k) => {
      $("b" + k).className = "box" + (k === s.cursor ? " cursor" : k <= s.done ? " done" : "");
    });

    const lifted = s.lift > 0;
    G.g.style.transform = `translateY(${G.ys(s.lift) - G.ys(0)}px)`;
    G.segs.forEach((e, i) => { e.style.opacity = i + 1 < s.shown ? "1" : "0"; });
    G.pts.forEach((e, k) => {
      e.style.opacity = k < s.shown ? "1" : "0";
      let c = "pt";
      if (lifted && k === s.minIdx) c += " lifted-low";
      else if (k === s.minIdx && s.minVal < 0) c += " low";
      if (!lifted && s.cursor !== null && k === s.cursor + 1) c += " cur";
      e.setAttribute("class", c);
    });
    G.vals.forEach((e, k) => {
      e.style.opacity = k < s.shown ? "1" : "0";
      e.textContent = String(sums[k] + s.lift);
    });

    const showMin = !lifted && s.minVal < 0;
    G.minLine.style.transform = G.minText.style.transform = `translateY(${G.ys(s.minVal) - G.ys(0)}px)`;
    G.minLine.style.opacity = G.minText.style.opacity = showMin ? "1" : "0";
    G.minText.textContent = `lowest = ${s.minVal}`;

    if (s.ans !== null) {
      const x = G.xs(s.minIdx) + 18, ya = G.ys(s.minVal), yb = G.ys(1);
      G.arrow.setAttribute("d", `M${x} ${ya} L${x} ${yb + 6} M${x - 5} ${yb + 12} L${x} ${yb + 4} L${x + 5} ${yb + 12}`);
      G.arrowT.setAttribute("x", String(x + 8));
      G.arrowT.setAttribute("y", String((ya + yb) / 2 + 4));
      G.arrowT.textContent = `+${s.ans}`;
      G.arrow.style.opacity = G.arrowT.style.opacity = lifted ? "0" : "1";
    } else {
      G.arrow.style.opacity = G.arrowT.style.opacity = "0";
    }

    $("chart-label").textContent = lifted ? `Running total with startValue = ${s.lift}` : "Running sum with startValue = 0";
  },
};

export default view;
