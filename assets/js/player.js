/*
 * AlgoPlayer: the step-through engine shared by every algorithm page.
 *
 * A page supplies the algorithm-specific parts and the player handles the rest
 * (play/pause/step controls, speed, keyboard shortcuts, code highlighting,
 * variable cards, the explanation note and the "try your own input" row).
 *
 *   AlgoPlayer.create({
 *     source:    ["line 1", "line 2", ...],      // code shown in the Code panel
 *     codeNote:  "optional caption under the code",
 *     vars:      [{ key: "lo" }, { key: "found", tone: "goal" }],  // tone: low | goal | curve
 *     inputs:    [{ id: "arr", label: "Array", value: "1, 2, 3" }, ...],
 *     parse:     values => input,                 // values = { arr: "1, 2, 3" }; throw Error(msg) if invalid
 *     buildTrace: input => steps,                 // [{ line, note, vars: {...}, flash: "key", ...yourFields }]
 *     setup:     input => {},                     // build the visual for a new input
 *     render:    (step, ctx) => {},              // update the visual for one step
 *   });
 *
 * The page needs these placeholders: [data-controls], [data-code], [data-note], [data-input].
 */
(function () {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const KW = /\b(var|let|const|function|for|of|in|while|if|else|return|break|continue|new|true|false|null)\b/g;
  const highlight = line => esc(line)
    .replace(KW, '<span class="kw">$1</span>')
    .replace(/(^|[^\w])(\d+)\b/g, '$1<span class="num">$2</span>');

  const NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  // "1, 2, -3" -> [1, 2, -3]; throws a readable Error when invalid.
  function parseIntList(str, { min = 1, max = 12 } = {}) {
    const arr = String(str).split(/[\s,]+/).filter(Boolean).map(Number);
    if (arr.some(x => !Number.isInteger(x))) throw new Error("Use whole numbers separated by commas.");
    if (arr.length < min || arr.length > max) throw new Error(`Use between ${min} and ${max} numbers.`);
    return arr;
  }

  const fmt = v => (v < 0 ? `(${v})` : `${v}`);

  function create(cfg) {
    const q = sel => document.querySelector(sel);
    const controls = q("[data-controls]"), codeBox = q("[data-code]"), noteEl = q("[data-note]"), inputBox = q("[data-input]");

    controls.classList.add("controls");
    controls.innerHTML = `
      <button data-act="reset" type="button" title="Restart (R)">⟲ Restart</button>
      <button data-act="prev" type="button" title="Step back (←)">◀ Back</button>
      <button data-act="play" type="button" class="primary" title="Play / pause (Space)">▶ Play</button>
      <button data-act="next" type="button" title="Step forward (→)">Step ▶</button>
      <label class="speed">Speed <input data-act="speed" type="range" min="1" max="5" value="3"></label>
      <span class="progress"></span>`;
    const btn = a => controls.querySelector(`[data-act="${a}"]`);
    const progress = controls.querySelector(".progress");

    codeBox.innerHTML = `
      <p class="label">Code</p>
      <pre class="code">${cfg.source.map((l, k) =>
        `<span class="ln" data-l="${k + 1}"><span class="no">${k + 1}</span>${highlight(l) || " "}</span>`).join("")}</pre>
      ${cfg.codeNote ? `<p class="code-note">${cfg.codeNote}</p>` : ""}
      <div class="vars"></div>`;
    const lines = codeBox.querySelectorAll(".ln");
    const varsEl = codeBox.querySelector(".vars");

    const inputs = cfg.inputs || [];
    if (inputBox && inputs.length) {
      inputBox.classList.add("input-row");
      inputBox.innerHTML = inputs.map(f =>
        `<label for="in-${f.id}">${f.label}</label>
         <input id="in-${f.id}" type="text" value="${esc(f.value)}" spellcheck="false" class="${f.short ? "short" : ""}">`).join("") +
        `<button type="button" data-act="apply">Run</button><span class="err"></span>`;
    }
    const readInputs = () => Object.fromEntries(inputs.map(f => [f.id, document.getElementById("in-" + f.id).value]));

    let input, trace, step = 0, timer = null;

    function load(next) {
      input = next;
      trace = cfg.buildTrace(input);
      cfg.setup(input);
      stop(); step = 0; render();
    }

    function render() {
      const s = trace[step];
      lines.forEach(e => e.classList.toggle("on", +e.dataset.l === s.line));
      cfg.render(s, { step, trace, input });
      noteEl.innerHTML = s.note || "";
      const vals = s.vars || {};
      varsEl.innerHTML = cfg.vars.map(v => {
        const val = vals[v.key];
        return `<div class="var ${v.tone || ""} ${s.flash === v.key ? "flash" : ""}">
          <div class="k">${v.label || v.key}</div><div class="v">${val == null ? "–" : esc(val)}</div></div>`;
      }).join("");
      progress.textContent = `step ${step + 1} / ${trace.length}`;
      btn("prev").disabled = step === 0;
      btn("next").disabled = step === trace.length - 1;
    }

    const delay = () => [1700, 1200, 800, 480, 240][btn("speed").value - 1];
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
    function stop() { clearTimeout(timer); timer = null; btn("play").textContent = "▶ Play"; }
    const toggle = () => (timer ? stop() : play());
    const go = k => { stop(); step = Math.max(0, Math.min(trace.length - 1, k)); render(); };

    btn("play").onclick = toggle;
    btn("next").onclick = () => go(step + 1);
    btn("prev").onclick = () => go(step - 1);
    btn("reset").onclick = () => go(0);

    if (inputBox && inputs.length) {
      const err = inputBox.querySelector(".err");
      const apply = () => {
        let parsed;
        try { parsed = cfg.parse(readInputs()); }
        catch (e) { err.textContent = e.message; return; }
        err.textContent = "";
        load(parsed); play();
      };
      inputBox.querySelector('[data-act="apply"]').onclick = apply;
      inputBox.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") apply(); });
    }

    document.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT" && e.target.type === "text") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") btn("next").click();
      else if (e.key === "ArrowLeft") btn("prev").click();
      else if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "r" || e.key === "R") btn("reset").click();
    });

    load(cfg.parse(readInputs()));
    return { load, play, stop };
  }

  window.AlgoPlayer = { create, svgEl, parseIntList, fmt, esc };
})();
