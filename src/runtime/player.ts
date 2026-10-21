// The step-through engine shared by every algorithm page: controls, speed, keyboard shortcuts,
// code highlighting, variable cards, the explanation note and the custom-input row.
import type { Code, Step, VarSpec } from "./types.ts";

export const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KW = /\b(var|let|const|function|for|of|in|while|if|else|return|break|continue|new|true|false|null|number|boolean|string|void)\b/g;
export const highlight = (line: string) => esc(line)
  .replace(KW, '<span class="kw">$1</span>')
  .replace(/(^|[^\w])(\d+)\b/g, '$1<span class="num">$2</span>');

export interface Field { id: string; label: string; value: string; short?: boolean }

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
}

export interface Player {
  load(input: unknown): void;
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
  controls.innerHTML = `
    <button data-act="reset" type="button" title="Restart (R)">⟲ Restart</button>
    <button data-act="prev" type="button" title="Step back (←)">◀ Back</button>
    <button data-act="play" type="button" class="primary" title="Play / pause (Space)">▶ Play</button>
    <button data-act="next" type="button" title="Step forward (→)">Step ▶</button>
    <label class="speed">Speed <input data-act="speed" type="range" min="1" max="5" value="3"></label>
    <span class="progress"></span>`;
  const btn = (a: string) => controls.querySelector(`[data-act="${a}"]`) as HTMLButtonElement;
  const progress = controls.querySelector(".progress")!;

  codeBox.innerHTML = `
    <p class="label">Code</p>
    <pre class="code">${o.code.lines.map((l, k) =>
      `<span class="ln" data-l="${k + 1}"><span class="no">${k + 1}</span>${highlight(l) || " "}</span>`).join("")}</pre>
    ${o.codeNote ? `<p class="code-note">${o.codeNote}</p>` : ""}
    <div class="vars"></div>`;
  const lines = [...codeBox.querySelectorAll<HTMLElement>(".ln")];
  const varsEl = codeBox.querySelector(".vars")!;

  inputBox.classList.add("input-row");
  inputBox.innerHTML = o.fields.map(f =>
    `<label for="in-${f.id}">${esc(f.label)}</label>
     <input id="in-${f.id}" type="text" value="${esc(f.value)}" spellcheck="false" class="${f.short ? "short" : ""}">`).join("") +
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
    const lineNo = o.code.labels[s.line];
    lines.forEach(e => e.classList.toggle("on", Number(e.dataset.l) === lineNo));
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

  const delay = () => [1700, 1200, 800, 480, 240][Number((btn("speed") as unknown as HTMLInputElement).value) - 1];
  function tick() {
    if (step >= trace.length - 1) { stop(); return; }
    step++; render();
    // Linger a little before the final step so the conclusion lands.
    timer = setTimeout(tick, step === trace.length - 2 ? delay() * 1.6 : delay());
  }
  function play() {
    if (step >= trace.length - 1) { step = 0; render(); }
    btn("play").textContent = "❚❚ Pause";
    timer = setTimeout(tick, delay());
  }
  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
    btn("play").textContent = "▶ Play";
  }
  const toggle = () => (timer ? stop() : play());
  const go = (k: number) => { stop(); step = Math.max(0, Math.min(trace.length - 1, k)); render(); };

  btn("play").onclick = toggle;
  btn("next").onclick = () => go(step + 1);
  btn("prev").onclick = () => go(step - 1);
  btn("reset").onclick = () => go(0);

  const err = inputBox.querySelector(".err")!;
  const apply = () => {
    let parsed: I;
    try { parsed = o.parse(readFields()); }
    catch (e) { err.textContent = (e as Error).message; return; }
    err.textContent = "";
    load(parsed); play();
  };
  (inputBox.querySelector('[data-act="apply"]') as HTMLButtonElement).onclick = apply;
  inputBox.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") apply();
  });

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLInputElement;
    if (t?.tagName === "INPUT" && t.type === "text") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight") btn("next").click();
    else if (e.key === "ArrowLeft") btn("prev").click();
    else if (e.key === " ") { e.preventDefault(); toggle(); }
    else if (e.key === "r" || e.key === "R") btn("reset").click();
  };
  doc.addEventListener("keydown", onKey);

  load(o.parse(readFields()));
  return {
    load: input => load(input as I),
    play,
    stop,
    destroy: () => { stop(); doc.removeEventListener("keydown", onKey); },
  };
}
