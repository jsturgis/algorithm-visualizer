// The step-through engine shared by every algorithm page: controls, speed, keyboard shortcuts,
// code highlighting, variable cards, the explanation note and the custom-input row.
import type { Code, Step, VarSpec } from "./types.ts";

export const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KW = /\b(var|let|const|function|for|of|in|while|if|else|return|break|continue|new|true|false|null|number|boolean|string|void)\b/g;
export const highlight = (line: string) => esc(line)
  .replace(KW, '<span class="kw">$1</span>')
  .replace(/(^|[^\w])(\d+)\b/g, '$1<span class="num">$2</span>');

export interface Field { id: string; label: string; value: string; short?: boolean }

/** How long after the last keystroke in an input field the animation redraws for the new input. */
export const LIVE_INPUT_DELAY_MS = 400;

export interface PlayerOptions<I> {
  doc?: Document;
  code: Code;
  codeNote?: string;
  vars: VarSpec[];
  fields: Field[];
  /** Field values → input. Throw an Error with a readable message when invalid. */
  parse(values: Record<string, string>): I;
  buildTrace(input: I): Step[];
  setup(input: I): void;
  render(step: Step): void;
  /** Called on every step with the highlighted code lines (1-based); empty when none. */
  onLine?(lines: number[]): void;
}

export interface Player {
  load(input: unknown): void;
  /** Redraw for the input fields' current values, paused at step 1. Returns the error message, or null. */
  applyFields(): string | null;
  play(): void;
  stop(): void;
  destroy(): void;
}

export function createPlayer<I>(o: PlayerOptions<I>): Player {
  const doc = o.doc ?? document;
  const q = <T extends Element = HTMLElement>(sel: string) => {
    const el = doc.querySelector<T>(sel);
    if (!el) throw new Error(`Page is missing ${sel}`);
    return el as unknown as T;
  };
  const controls = q("[data-controls]"), codeBox = q("[data-code]"), noteEl = q("[data-note]"), inputBox = q("[data-input]");

  controls.classList.add("controls");
  // Each button's text is in .btn-label so narrow screens can show the icon alone (aria-label keeps the name).
  const button = (act: string, icon: string, label: string, title: string, after = false) =>
    `<button data-act="${act}" type="button" title="${title}" aria-label="${label}">` +
    (after ? `<span class="btn-label">${label} </span><span aria-hidden="true">${icon}</span>` : `<span aria-hidden="true">${icon}</span><span class="btn-label"> ${label}</span>`) +
    `</button>`;
  controls.innerHTML = `
    ${button("reset", "⟲", "Restart", "Restart (R)")}
    ${button("prev", "◀", "Back", "Step back (←)")}
    ${button("play", "▶", "Play", "Play / pause (Space)").replace("<button", '<button class="primary"')}
    ${button("next", "▶", "Step", "Step forward (→)", true)}
    <label class="speed"><span class="btn-label">Speed</span> <input data-act="speed" type="range" min="1" max="5" value="3" aria-label="Speed" aria-valuetext="Normal"></label>
    <span class="progress"></span>`;
  const btn = (a: string) => controls.querySelector(`[data-act="${a}"]`) as HTMLButtonElement;
  const progress = controls.querySelector(".progress")!;
  const SPEEDS = ["Slowest", "Slow", "Normal", "Fast", "Fastest"];
  const speed = btn("speed") as unknown as HTMLInputElement;
  speed.addEventListener("input", () => speed.setAttribute("aria-valuetext", SPEEDS[Number(speed.value) - 1]));
  const setPlayLabel = (playing: boolean) => {
    const b = btn("play");
    b.innerHTML = playing
      ? `<span aria-hidden="true">❚❚</span><span class="btn-label"> Pause</span>`
      : `<span aria-hidden="true">▶</span><span class="btn-label"> Play</span>`;
    b.setAttribute("aria-label", playing ? "Pause" : "Play");
  };
  // Optional: the current code line, repeated next to the animation (shown on narrow screens).
  const currentLine = doc.querySelector<HTMLElement>("[data-current-line]");

  codeBox.innerHTML = `
    <div class="code-head"><p class="label">Code</p><div class="code-actions" data-code-actions></div></div>
    <pre class="code">${o.code.lines.map((l, k) =>
      `<span class="ln" data-l="${k + 1}"><span class="no">${k + 1}</span>${highlight(l) || " "}</span>`).join("")}</pre>
    ${o.codeNote ? `<p class="code-note">${o.codeNote}</p>` : ""}
    <div class="vars"></div>`;
  const lines = [...codeBox.querySelectorAll<HTMLElement>(".ln")];
  const varsEl = codeBox.querySelector(".vars")!;

  inputBox.classList.add("input-row");
  inputBox.innerHTML = o.fields.map(f =>
    `<span class="field"><label for="in-${f.id}">${esc(f.label)}</label>
     <input id="in-${f.id}" type="text" value="${esc(f.value)}" spellcheck="false" class="${f.short ? "short" : ""}"></span>`).join("") +
    `<button type="button" data-act="apply">Run</button><span class="err" role="alert"></span>`;
  const readFields = () => Object.fromEntries(o.fields.map(f => [f.id, (doc.getElementById("in-" + f.id) as HTMLInputElement).value]));

  let trace: Step[] = [], step = 0, timer: ReturnType<typeof setTimeout> | null = null;

  function load(input: I) {
    trace = o.buildTrace(input);
    o.setup(input);
    stop(); step = 0; render();
  }

  function render() {
    const s = trace[step];
    const on = o.code.labels[s.line] ?? [];
    lines.forEach(e => e.classList.toggle("on", on.includes(Number(e.dataset.l))));
    if (currentLine) {
      currentLine.innerHTML = on.map(n =>
        `<span class="cl-line"><span class="no">${n}</span><code>${highlight(o.code.lines[n - 1].trim())}</code></span>`).join("");
    }
    o.onLine?.(on);
    o.render(s);
    noteEl.innerHTML = s.note || "";
    const vals = s.vars ?? {};
    varsEl.innerHTML = o.vars.map(v => {
      const val = vals[v.key];
      return `<div class="var ${v.tone ?? ""} ${s.flash === v.key ? "flash" : ""}">
        <div class="k">${esc(v.label ?? v.key)}</div><div class="v">${val == null ? "–" : esc(val)}</div></div>`;
    }).join("");
    progress.textContent = `step ${step + 1} / ${trace.length}`;
    btn("prev").disabled = step === 0;
    btn("next").disabled = step === trace.length - 1;
  }

  const delay = () => [1700, 1200, 800, 480, 240][Number(speed.value) - 1];
  function tick() {
    if (step >= trace.length - 1) { stop(); return; }
    step++; render();
    // Linger a little before the final step so the conclusion lands.
    timer = setTimeout(tick, step === trace.length - 2 ? delay() * 1.6 : delay());
  }
  function play() {
    if (step >= trace.length - 1) { step = 0; render(); }
    setPlayLabel(true);
    timer = setTimeout(tick, delay());
  }
  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
    setPlayLabel(false);
  }
  const toggle = () => (timer ? stop() : play());
  const go = (k: number) => { stop(); step = Math.max(0, Math.min(trace.length - 1, k)); render(); };

  btn("play").onclick = toggle;
  btn("next").onclick = () => go(step + 1);
  btn("prev").onclick = () => go(step - 1);
  btn("reset").onclick = () => go(0);

  const err = inputBox.querySelector(".err")!;
  let shown = "";   // the input currently animated, as JSON
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  const parseFields = (): I | null => {
    try {
      const parsed = o.parse(readFields());
      err.textContent = "";
      return parsed;
    } catch (e) {
      err.textContent = (e as Error).message;
      return null;
    }
  };
  // Run / Enter: redraw for the fields' input and play it.
  const apply = () => {
    clearTimeout(liveTimer);
    const parsed = parseFields();
    if (parsed === null) return;
    shown = JSON.stringify(parsed);
    load(parsed); play();
  };
  (inputBox.querySelector('[data-act="apply"]') as HTMLButtonElement).onclick = apply;
  inputBox.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") apply();
  });
  // Typing: follow the fields once the learner pauses. A valid new input redraws the animation at step 1,
  // paused; an invalid one shows its error and keeps the last valid animation.
  inputBox.addEventListener("input", () => {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      const parsed = parseFields();
      if (parsed === null) return;
      const key = JSON.stringify(parsed);
      if (key === shown) return;
      shown = key;
      load(parsed);
    }, LIVE_INPUT_DELAY_MS);
  });

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLInputElement;
    if (t?.tagName === "INPUT" && t.type === "text") return;
    // Typing in the code editor must not drive the player.
    if (t instanceof Element && (t.closest(".cm-editor") || (t as HTMLElement).isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Let focused controls keep their own keys: Space presses a button, link or tab; arrows move a slider.
    if (e.key === " " && t instanceof Element && t.closest("button, a, [role=tab], input, select, summary")) return;
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && t?.tagName === "INPUT" && t.type === "range") return;
    if (t instanceof Element && t.closest("select, textarea")) return;
    if (e.key === "ArrowRight") btn("next").click();
    else if (e.key === "ArrowLeft") btn("prev").click();
    else if (e.key === " ") { e.preventDefault(); toggle(); }
    else if (e.key === "r" || e.key === "R") btn("reset").click();
  };
  doc.addEventListener("keydown", onKey);

  const initial = o.parse(readFields());
  shown = JSON.stringify(initial);
  load(initial);
  return {
    load: input => load(input as I),
    applyFields() {
      clearTimeout(liveTimer);
      const parsed = parseFields();
      if (parsed === null) return err.textContent;
      shown = JSON.stringify(parsed);
      load(parsed);
      return null;
    },
    play,
    stop,
    destroy: () => { stop(); clearTimeout(liveTimer); doc.removeEventListener("keydown", onKey); },
  };
}
