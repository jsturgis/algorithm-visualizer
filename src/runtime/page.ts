// Wires one algorithm package (from the build) into the page shell rendered by build/render.ts.
import "../styles/base.css";
import { checkInput, formatField, parseField, withLimits } from "./constraints.ts";
import { attachEditing, type Editing, type EditingOptions } from "./editing.ts";
import { createPlayer, type Player } from "./player.ts";
import { contractOf, type AlgorithmModule, type Input } from "./types.ts";

export type MountOptions = Pick<EditingOptions, "storage" | "loadEditor" | "checker" | "debounceMs">;
export type MountedPage = Player & { editing: Editing };

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
    render: step => view.render(step),
    onLine: n => { line = n; editing?.setLine(n); },
  });

  editing = attachEditing({
    ...opts,
    doc,
    panel: doc.querySelector<HTMLElement>("[data-code]")!,
    slug: meta.slug,
    reference: code.lines.join("\n"),
    contract: contractOf(meta),
  });
  editing.setLine(line);

  return {
    ...player,
    editing,
    destroy: () => { player.destroy(); editing?.destroy(); },
  };
}
