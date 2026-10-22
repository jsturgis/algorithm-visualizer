// The code editor (CodeMirror 6) with TypeScript feedback from the code checker.
// Loaded only when the learner first clicks Edit, together with the checker worker.
import "./editor.css";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type Completion as CMCompletion, type CompletionContext } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { linter, lintGutter, type Diagnostic as CMDiagnostic } from "@codemirror/lint";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, drawSelection, EditorView, hoverTooltip, keymap, lineNumbers, type DecorationSet } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import type { Contract } from "../runtime/types.ts";
import type { Diagnostic } from "./checker.ts";
import { overWorker, type AsyncChecker, type CheckerFactory } from "./transport.ts";

export interface EditorOptions {
  parent: HTMLElement;
  text: string;
  checker: AsyncChecker;
  /** Every edit, immediately. */
  onChange(text: string): void;
  /** The diagnostics for the current text, after the debounce. */
  onDiagnostics(diagnostics: Diagnostic[]): void;
  debounceMs?: number;
}

export interface Editor {
  view: EditorView;
  getText(): string;
  setText(text: string): void;
  /** Move the cursor to `offset` and focus the editor. */
  goTo(offset: number): void;
  /** Highlight the current step's 1-based lines (empty to clear). */
  highlightLine(lines: number[]): void;
  destroy(): void;
}

/** The browser checker: TypeScript in a Web Worker. */
export const workerChecker: CheckerFactory = (contract: Contract) =>
  overWorker(new Worker(new URL("./checker.worker.ts", import.meta.url), { type: "module", name: "type-checker" }))(contract);

const setStepLine = StateEffect.define<number[]>();
const stepLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setStepLine)) continue;
      const valid = e.value.filter(n => n >= 1 && n <= tr.state.doc.lines).sort((a, b) => a - b);
      deco = Decoration.set(valid.map(n => Decoration.line({ class: "cm-step-line" }).range(tr.state.doc.line(n).from)));
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

// Same colours as the read-only listing (.kw, .num), from the site's tokens, so both themes work.
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword, t.bool, t.null], color: "var(--curve)" },
  { tag: [t.number], color: "var(--cur)" },
  { tag: [t.string], color: "var(--goal)" },
  { tag: [t.comment], color: "var(--muted)", fontStyle: "italic" },
  { tag: [t.typeName, t.className], color: "var(--curve)" },   // the listing colours `number` as a keyword
]);

const KIND: Record<string, CMCompletion["type"]> = {
  function: "function", "local function": "function", method: "method", property: "property",
  parameter: "variable", let: "variable", const: "constant", var: "variable", "local var": "variable",
  keyword: "keyword", interface: "interface", type: "type", class: "class", enum: "enum", module: "namespace",
};

export function createEditor(o: EditorOptions): Editor {
  const { checker } = o;

  const lint = linter(async view => {
    const doc = view.state.doc;
    let found: Diagnostic[];
    try { found = await checker.diagnostics(doc.toString()); }
    catch { return []; }
    if (view.state.doc !== doc) return [];   // stale: the text changed while checking
    o.onDiagnostics(found);
    return found.map((d): CMDiagnostic => ({ from: d.from, to: Math.max(d.to, d.from), severity: d.severity, message: d.message, source: d.category }));
  }, { delay: o.debounceMs ?? 300 });

  const complete = async (ctx: CompletionContext) => {
    const word = ctx.matchBefore(/[\w$]+/);
    const afterDot = /\.\s*$/.test(ctx.state.sliceDoc(Math.max(0, ctx.pos - 2), ctx.pos));
    if (!ctx.explicit && !word && !afterDot) return null;
    const result = await checker.completions(ctx.state.doc.toString(), ctx.pos).catch(() => null);
    if (!result || ctx.aborted) return null;
    return {
      from: result.from,
      options: result.items.map(i => ({ label: i.label, type: KIND[i.kind] ?? "text", boost: -Number(i.sortText) || 0 })),
      validFor: /^[\w$]*$/,
    };
  };

  const hover = hoverTooltip(async (view, pos) => {
    const info = await checker.hover(view.state.doc.toString(), pos).catch(() => null);
    if (!info) return null;
    return {
      pos: info.from, end: info.to, above: true,
      create: () => {
        const dom = document.createElement("div");
        dom.className = "cm-type-hover";
        const code = dom.appendChild(document.createElement("code"));
        code.textContent = info.text;
        if (info.docs) dom.appendChild(document.createElement("p")).textContent = info.docs;
        return { dom };
      },
    };
  }, { hoverTime: 350 });

  const view = new EditorView({
    parent: o.parent,
    state: EditorState.create({
      doc: o.text,
      extensions: [
        lineNumbers(), history(), drawSelection(), indentOnInput(), bracketMatching(), closeBrackets(),
        EditorState.tabSize.of(4),
        javascript({ typescript: true }),
        syntaxHighlighting(highlight),
        autocompletion({ override: [complete], activateOnTyping: true }),
        lint, lintGutter(), hover, stepLine,
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab, { key: "Mod-/", run: toggleComment }]),
        EditorView.contentAttributes.of({ "aria-label": "Solution code editor" }),
        EditorView.updateListener.of(u => { if (u.docChanged) o.onChange(u.state.doc.toString()); }),
      ],
    }),
  });

  return {
    view,
    getText: () => view.state.doc.toString(),
    setText: text => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    goTo: offset => {
      view.dispatch({ selection: { anchor: Math.min(offset, view.state.doc.length) }, scrollIntoView: true });
      view.focus();
    },
    highlightLine: line => view.dispatch({ effects: setStepLine.of(line) }),
    destroy: () => view.destroy(),
  };
}
