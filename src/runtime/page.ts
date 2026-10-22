// Wires one algorithm package (from the build) into the page shell rendered by build/render.ts.
import "../styles/base.css";
import { checkInput, formatField, parseField, withLimits } from "./constraints.ts";
import { attachEditing, safeLocalStorage, type Editing, type EditingOptions } from "./editing.ts";
import { createPlayer, type Player } from "./player.ts";
import { attachTabs, type Tabs } from "./tabs.ts";
import { BROWSER_TIME_MULTIPLIER, contractOf, type AlgorithmModule, type Input } from "./types.ts";

export type MountOptions = Pick<EditingOptions, "storage" | "loadEditor" | "checker" | "debounceMs" | "runner" | "loadJudge" | "reload">;

/** When an array strip is wider than its pane (narrow screens), scroll it so the active box is visible. */
function keepActiveInView(stage: HTMLElement) {
  for (const scroller of stage.querySelectorAll<HTMLElement>(".strip-scroll")) {
    if (scroller.scrollWidth <= scroller.clientWidth) continue;
    const active = scroller.querySelector<HTMLElement>(".box.cursor, .box.found, .box.bad, .box.sub, .box.leaving");
    if (!active) continue;
    const a = active.getBoundingClientRect(), s = scroller.getBoundingClientRect();
    if (a.left < s.left) scroller.scrollLeft -= s.left - a.left + 12;
    else if (a.right > s.right) scroller.scrollLeft += a.right - s.right + 12;
  }
}
export type MountedPage = Player & { editing: Editing; tabs: Tabs };

export function mountAlgorithm(mod: AlgorithmModule, doc: Document = document, opts: MountOptions = {}): MountedPage {
  const { meta, code, view } = mod;
  const stage = doc.querySelector<HTMLElement>("[data-stage]");
  if (!stage) throw new Error("Page is missing [data-stage]");
  stage.innerHTML = view.markup;

  // The page accepts smaller inputs than the problem allows, so the picture stays readable.
  const params = withLimits(meta.input, meta.visualization.limits);

  // The player reports the highlighted line before edit mode exists; keep the latest for it.
  let editing: Editing | null = null;
  let line: number | null = null;

  const player = createPlayer<Input>({
    doc,
    code,
    codeNote: meta.visualization.code_note,
    vars: view.vars,
    fields: params.map(p => ({
      id: p.name,
      label: meta.visualization.labels[p.name] ?? p.name,
      value: formatField(meta.visualization.default[p.name], p),
      short: p.type === "int",
    })),
    parse: values => {
      let input: Input = Object.fromEntries(params.map(p => [p.name, parseField(values[p.name], p)]));
      if (view.prepare) input = view.prepare(input);
      const errors = [...checkInput(input, params), ...(mod.validate?.(input) ?? [])];
      if (errors.length) throw new Error(errors[0]);
      return input;
    },
    buildTrace: mod.buildTrace,
    setup: input => view.setup(stage, input),
    render: step => { view.render(step); keepActiveInView(stage); },
    onLine: n => { line = n; editing?.setLine(n); },
  });

  const storage = opts.storage === undefined ? safeLocalStorage() : opts.storage;
  const tabs = attachTabs({ doc, slug: meta.slug, storage });

  editing = attachEditing({
    ...opts,
    storage,
    doc,
    panel: doc.querySelector<HTMLElement>("[data-code]")!,
    slug: meta.slug,
    reference: code.lines.join("\n"),
    contract: contractOf(meta),
    loadTestSet: mod.loadTestSet,
    // "Step through this input" on a failing verdict: animate the failing test, if the page can show it.
    stepThrough: input => {
      const errors = [...checkInput(input, params), ...(mod.validate?.(input) ?? [])];
      if (errors.length) return `This input is too big to animate here: ${errors[0]}`;
      for (const p of params) (doc.getElementById(`in-${p.name}`) as HTMLInputElement).value = formatField(input[p.name], p);
      const problem = player.applyFields();
      if (!problem) doc.querySelector<HTMLElement>(".pane-right")?.scrollIntoView?.({ block: "nearest" });
      return problem;
    },
    timeLimitMs: meta.limits.time_ms * BROWSER_TIME_MULTIPLIER,
  });
  editing.setLine(line);

  return {
    ...player,
    editing,
    tabs,
    destroy: () => { player.destroy(); editing?.destroy(); },
  };
}
