// A row of boxes for an array or string, with labelled pointers under the boxes. Shared by the problem
// packages' views. Boxes are built once per input and updated in place on every step, so CSS transitions
// between steps still play.

/** Box looks, from base.css. */
export type BoxState = "" | "done" | "cursor" | "found" | "out" | "bad" | "win";
/** Pointer label colours. */
export type Tone = "blue" | "amber" | "red" | "green" | "grey";

export interface Pointer {
  name: string;
  /** Index the pointer is at; null or out of range hides it. */
  at: number | null;
  tone: Tone;
}

export interface StripState {
  values: readonly unknown[];
  /** The look of each box (default ""). */
  state?: (i: number) => BoxState;
  pointers?: Pointer[];
}

const text = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "string" ? v : String(v));

/**
 * Draw `s` into `el` (a `.strip`). Rebuilds the boxes only when the number of values changes.
 * Wrap it in `.strip-scroll` so long rows scroll, and the page keeps the active box in view.
 */
export function drawStrip(el: HTMLElement, s: StripState) {
  if (el.children.length !== s.values.length) {
    el.innerHTML = s.values.map((_, i) =>
      `<div class="cell"><div class="box"></div><span class="idx">${i}</span><div class="ptrs"></div></div>`).join("");
  }
  const cells = el.children;
  s.values.forEach((v, i) => {
    const cell = cells[i] as HTMLElement;
    const box = cell.firstElementChild as HTMLElement;
    const t = v === " " ? "␣" : text(v);   // make spaces visible
    if (box.textContent !== t) box.textContent = t;
    const state = s.state?.(i) ?? "";
    box.className = "box" + (state ? ` ${state}` : "") + (v === " " ? " blank" : "");
    const here = (s.pointers ?? []).filter(p => p.at === i);
    (cell.lastElementChild as HTMLElement).innerHTML = here.map(p => `<span class="ptr ${p.tone}">${p.name}</span>`).join("");
  });
}
