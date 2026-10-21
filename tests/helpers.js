// Loads a real page from the site into jsdom, runs its scripts, and gives tests a way to drive the player.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { JSDOM, VirtualConsole, requestInterceptor } from "jsdom";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Serve local files only: remote URLs (Google Fonts) get an empty response instead of hitting the network.
const localOnly = requestInterceptor(request =>
  request.url.startsWith("file:") ? undefined : new Response("", { headers: { "Content-Type": "text/css" } }));

// The home page's list of algorithms, read the same way the browser reads it.
export function registry() {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(path.join(ROOT, "algorithms.js"), "utf8"), sandbox);
  return sandbox.window.ALGORITHMS;
}

export async function loadPage(relPath) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", e => errors.push(e.message));
  virtualConsole.on("error", (...args) => errors.push(args.join(" ")));

  const dom = await JSDOM.fromFile(path.join(ROOT, relPath), {
    runScripts: "dangerously",
    resources: { interceptors: [localOnly] },
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  if (window.document.readyState !== "complete") {
    await new Promise(resolve => window.addEventListener("load", resolve));
  }
  return new Page(window, errors);
}

class Page {
  constructor(window, errors) {
    this.window = window;
    this.document = window.document;
    this.errors = errors;
  }

  $(sel) { return this.document.querySelector(sel); }
  $$(sel) { return [...this.document.querySelectorAll(sel)]; }
  button(act) { return this.$(`[data-act="${act}"]`); }

  click(act) { this.button(act).click(); }
  press(key) { this.document.dispatchEvent(new this.window.KeyboardEvent("keydown", { key, bubbles: true })); }

  // [current, total] from the "step N / M" label.
  progress() {
    const [, cur, total] = this.$(".progress").textContent.match(/step (\d+) \/ (\d+)/);
    return [Number(cur), Number(total)];
  }

  toEnd() {
    while (!this.button("next").disabled) this.click("next");
    return this;
  }

  // The value shown on a variable card, e.g. varValue("minVal") -> "-4".
  varValue(key) {
    const card = this.$$(".var").find(v => v.querySelector(".k").textContent === key);
    if (!card) throw new Error(`No variable card "${key}"`);
    return card.querySelector(".v").textContent;
  }

  highlightedLine() {
    const on = this.$$(".ln.on");
    return on.length === 1 ? Number(on[0].dataset.l) : null;
  }

  note() { return this.$("[data-note]").textContent; }
  error() { return this.$(".err").textContent; }

  // Fill the custom-input fields ({ arr: "1, 2", target: "2" }) and click Run, then pause playback.
  run(values) {
    for (const [id, value] of Object.entries(values)) this.$(`#in-${id}`).value = value;
    this.click("apply");
    if (this.button("play").textContent.includes("Pause")) this.click("play");
  }
}

// Small seeded random generator so failures are reproducible.
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
export const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
