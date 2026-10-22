// Shared step shape and picture for sliding-window problems: an array (or string) with a highlighted
// window between `left` and `right`, the element that just entered or left, and the best window so far.
import { drawStrip, type BoxState } from "./strip.ts";

export interface WindowState {
  left: number;
  right: number | null;
  /** Index that just joined (amber) or just left (red) the window. */
  entered?: number | null;
  left_out?: number | null;
  /** The best window found so far, outlined green on the step it's found. */
  best?: [number, number] | null;
  newBest?: boolean;
  done?: boolean;
}

export function drawWindow(el: HTMLElement, values: readonly unknown[], w: WindowState) {
  const inWindow = (i: number) => w.right !== null && i >= w.left && i <= w.right;
  drawStrip(el, {
    values,
    state: (i): BoxState => {
      if (i === w.left_out) return "bad";
      if (i === w.entered) return "cursor";
      if (w.newBest && w.best && i >= w.best[0] && i <= w.best[1]) return "found";
      if (w.done && w.best && i >= w.best[0] && i <= w.best[1]) return "found";
      return inWindow(i) ? "win" : "";
    },
    pointers: w.done ? [] : [{ name: "left", at: w.left, tone: "blue" }, { name: "right", at: w.right, tone: "red" }],
  });
}
