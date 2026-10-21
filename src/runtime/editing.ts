// Edit mode for the code panel: the Edit / Show reference toggle, Reset, saved edits, the problem list,
// and switching off line highlighting while the learner's code differs from the reference.
//
// This module is small and loaded with every page. The editor (CodeMirror) and the type checker
// (TypeScript in a worker) are loaded the first time the learner clicks Edit.
import type { Diagnostic } from "../editor/checker.ts";
import type { Editor, createEditor as CreateEditor } from "../editor/editor.ts";
import type { AsyncChecker, CheckerFactory } from "../editor/transport.ts";
import { esc } from "./player.ts";
import { signatureOf, type Contract } from "./types.ts";

export interface EditingOptions {
  doc: Document;
  /** The code panel ([data-code]) rendered by the player. */
  panel: HTMLElement;
  slug: string;
  /** The accepted solution as displayed. */
  reference: string;
  contract: Contract;
  /** Where edits are saved. null, or a Storage that throws, means edits can't be saved. */
  storage?: Storage | null;
  /** Loads the editor module. Tests may replace it; the page loads it lazily. */
  loadEditor?: () => Promise<{ createEditor: typeof CreateEditor; workerChecker: CheckerFactory }>;
  /** Overrides the checker the editor module would create (tests inject an in-process one). */
  checker?: CheckerFactory;
  debounceMs?: number;
}

export interface Editing {
  /** The player reports the highlighted line on every step. */
  setLine(line: number | null): void;
  /** Resolves when Edit has finished opening (for tests). */
  ready(): Promise<void>;
  editor(): Editor | null;
  destroy(): void;
}

/** Ignore line-ending and trailing-whitespace differences when comparing with the reference. */
export const normalize = (s: string) => s.replace(/\r\n/g, "\n").split("\n").map(l => l.trimEnd()).join("\n").trimEnd();

/** FNV-1a hash of the reference text, so a saved edit knows which reference it started from. */
export function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

interface Saved { code: string; ref: string }

export function attachEditing(o: EditingOptions): Editing {
  const { doc, panel, reference } = o;
  const key = `algorithm-visualizer:edit:${o.slug}`;
  const refPrint = fingerprint(normalize(reference));
  const storage = o.storage === undefined ? safeLocalStorage() : o.storage;

  // Storage can be missing or throw (private mode, blocked site data); editing works either way.
  let canSave = storage !== null;
  const load = (): Saved | null => {
    try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch { canSave = false; return null; }
  };
  const save = (code: string) => {
    try {
      if (normalize(code) === normalize(reference)) storage?.removeItem(key);
      else storage?.setItem(key, JSON.stringify({ code, ref: refPrint } satisfies Saved));
    } catch { canSave = false; showStatus(); }
  };

  const actions = panel.querySelector<HTMLElement>("[data-code-actions]")!;
  actions.innerHTML = `
    <button type="button" data-edit="toggle" aria-pressed="false">Edit</button>
    <button type="button" data-edit="reset" hidden>Reset</button>`;
  const toggleBtn = actions.querySelector<HTMLButtonElement>('[data-edit="toggle"]')!;
  const resetBtn = actions.querySelector<HTMLButtonElement>('[data-edit="reset"]')!;
  const listing = panel.querySelector<HTMLElement>("pre.code")!;

  const area = doc.createElement("div");
  area.className = "edit-area";
  area.hidden = true;
  area.innerHTML = `
    <div class="confirm" data-edit="confirm" hidden role="group" aria-label="Confirm reset">
      <span>Discard your changes and restore the reference solution?</span>
      <button type="button" data-edit="discard" class="danger">Discard changes</button>
      <button type="button" data-edit="keep">Keep editing</button>
    </div>
    <p class="edit-status" data-edit="status"></p>
    <div class="editor" data-edit="editor"></div>
    <p class="label problems-label">Problems</p>
    <ul class="problems" data-edit="problems" aria-live="polite"></ul>`;
  listing.after(area);
  const $ = (name: string) => area.querySelector<HTMLElement>(`[data-edit="${name}"]`)!;
  const confirmBox = $("confirm"), statusEl = $("status"), editorBox = $("editor"), problemsEl = $("problems");

  let editor: Editor | null = null;
  let checker: AsyncChecker | null = null;
  let opening: Promise<void> | null = null;
  let editing = false;
  let line: number | null = null;
  let loadError = "";
  const saved = load();
  const outdated = !!saved && saved.ref !== refPrint;
  if (saved) toggleBtn.textContent = "Edit (changed)";

  const changed = () => !!editor && normalize(editor.getText()) !== normalize(reference);

  function showStatus() {
    const notes: string[] = [];
    if (loadError) notes.push(loadError);
    else if (editing && !editor) notes.push("Starting the editor and type checker…");
    if (editor && outdated && changed()) notes.push("Your saved code was based on an older version of the reference solution. Reset to start from the current one.");
    if (editor && changed()) notes.push("Line highlighting is off while your code differs from the reference. The animation follows the reference solution.");
    if (editor && !canSave) notes.push("Your edits can't be saved in this browser, so they'll be lost when you leave the page.");
    statusEl.innerHTML = notes.map(n => `<span>${esc(n)}</span>`).join("");
    statusEl.hidden = !notes.length;
  }

  function syncHighlight() {
    editor?.highlightLine(changed() ? null : line);
    resetBtn.hidden = !editing || !changed();
    if (resetBtn.hidden) confirmBox.hidden = true;
    showStatus();
  }

  function showProblems(list: Diagnostic[]) {
    problemsEl.innerHTML = list.length
      ? list.map((d, i) => `<li class="${d.severity}"><button type="button" data-i="${i}">` +
          `<span class="where">Line ${d.line}:${d.column}</span> <span class="kind">${d.category}</span> ${esc(d.message)}</button></li>`).join("")
      : `<li class="none">No problems</li>`;
    problemsEl.onclick = e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-i]");
      if (b) editor?.goTo(list[Number(b.dataset.i)].from);
    };
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  async function open() {
    try {
      const mod = await (o.loadEditor ?? (() => import("../editor/editor.ts")))();
      checker = await (o.checker ?? mod.workerChecker)(o.contract);
      editor = mod.createEditor({
        parent: editorBox,
        text: saved?.code ?? reference,
        checker,
        debounceMs: o.debounceMs,
        onChange: text => {
          clearTimeout(saveTimer);
          if (canSave) saveTimer = setTimeout(() => save(text), 400);
          syncHighlight();
        },
        onDiagnostics: showProblems,
      });
      problemsEl.innerHTML = `<li class="none">Checking…</li>`;
      syncHighlight();
    } catch (e) {
      loadError = `The editor couldn't start: ${(e as Error).message}`;
      showStatus();
      throw e;
    }
  }

  function setEditing(on: boolean) {
    editing = on;
    area.hidden = !on;
    listing.hidden = on;
    toggleBtn.textContent = on ? "Show reference" : changed() || (!editor && saved) ? "Edit (changed)" : "Edit";
    toggleBtn.setAttribute("aria-pressed", String(on));
    toggleBtn.title = on ? "Show the reference solution; your edits are kept" : `Edit the solution. It must stay ${signatureOf(o.contract)}.`;
    if (on && !opening) opening = open().catch(() => {});
    syncHighlight();
  }

  toggleBtn.onclick = () => setEditing(!editing);
  resetBtn.onclick = () => { confirmBox.hidden = false; confirmBox.querySelector<HTMLButtonElement>('[data-edit="keep"]')!.focus(); };
  $("keep").onclick = () => { confirmBox.hidden = true; editor?.view.focus(); };
  $("discard").onclick = () => {
    confirmBox.hidden = true;
    editor?.setText(reference);
    clearTimeout(saveTimer);
    try { storage?.removeItem(key); } catch { /* nothing saved */ }
    syncHighlight();
  };
  toggleBtn.title = `Edit the solution. It must stay ${signatureOf(o.contract)}.`;

  return {
    setLine(n) { line = n; if (editor) syncHighlight(); },
    ready: async () => { await opening; },
    editor: () => editor,
    destroy() {
      clearTimeout(saveTimer);
      editor?.destroy();
      checker?.dispose();
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = "algorithm-visualizer:probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
