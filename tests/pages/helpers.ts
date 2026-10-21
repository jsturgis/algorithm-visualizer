// Mounts an algorithm page (the real HTML shell + the built package module) in jsdom and drives it like a user.
import path from "node:path";
import { loadPackage, PROBLEMS } from "../../build/package.ts";
import { renderBody } from "../../build/render.ts";
import { mountAlgorithm } from "../../src/runtime/page.ts";
import type { Player } from "../../src/runtime/player.ts";
import type { AlgorithmModule } from "../../src/runtime/types.ts";

export class Page {
  player: Player;
  constructor(player: Player) { this.player = player; }

  $<T extends HTMLElement = HTMLElement>(sel: string) { return document.querySelector<T>(sel)!; }
  $$(sel: string) { return [...document.querySelectorAll<HTMLElement>(sel)]; }
  button(act: string) { return this.$<HTMLButtonElement>(`[data-act="${act}"]`); }

  click(act: string) { this.button(act).click(); }
  press(key: string) { document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); }

  /** [current, total] from the "step N / M" label. */
  progress(): [number, number] {
    const [, cur, total] = this.$(".progress").textContent!.match(/step (\d+) \/ (\d+)/)!;
    return [Number(cur), Number(total)];
  }

  toEnd() {
    while (!this.button("next").disabled) this.click("next");
    return this;
  }

  /** Step forward until `done()` is true. */
  until(done: () => boolean) {
    while (!done()) {
      if (this.button("next").disabled) throw new Error("Reached the last step");
      this.click("next");
    }
  }

  varValue(key: string) {
    const card = this.$$(".var").find(v => v.querySelector(".k")!.textContent === key);
    if (!card) throw new Error(`No variable card "${key}"`);
    return card.querySelector(".v")!.textContent;
  }

  highlightedLine() {
    const on = this.$$(".ln.on");
    return on.length === 1 ? Number(on[0].dataset.l) : null;
  }
  highlightedCode() {
    return this.$(".ln.on")?.textContent?.replace(/^\d+/, "").trim() ?? null;
  }

  note() { return this.$("[data-note]").textContent!; }
  error() { return this.$(".err").textContent!; }
  has(sel: string, cls: string) { return this.$(sel).classList.contains(cls); }
  texts(sel: string) { return this.$$(sel).map(e => e.textContent); }

  /** Fill the custom-input fields and click Run, then pause playback. */
  run(values: Record<string, string>) {
    for (const [id, value] of Object.entries(values)) this.$<HTMLInputElement>(`#in-${id}`).value = value;
    this.click("apply");
    if (this.button("play").textContent!.includes("Pause")) this.click("play");
  }
}

let current: Page | null = null;

export function mountPage(mod: AlgorithmModule): Page {
  current?.player.destroy();
  document.body.innerHTML = renderBody(loadPackage(path.join(PROBLEMS, mod.meta.slug)));
  current = new Page(mountAlgorithm(mod));
  return current;
}
