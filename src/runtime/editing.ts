// Edit mode for the code panel: the Edit / Show reference toggle, Reset, saved edits, the problem list,
// switching off line highlighting while the learner's code differs from the reference, and Run tests.
//
// This module is small and loaded with every page. The editor (CodeMirror) and the type checker
// (TypeScript in a worker) are loaded the first time the learner clicks Edit; the judge and the
// package's test set the first time they click Run tests.
import type { Diagnostic } from "../editor/checker.ts";
import type { Editor, createEditor as CreateEditor } from "../editor/editor.ts";
import type { AsyncChecker, CheckerFactory } from "../editor/transport.ts";
import type { JudgeTest, Verdict } from "../judge/judge.ts";
import type * as Panel from "../judge/panel.ts";
import type { Runner } from "../judge/runner.ts";
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
  /** The package's test set for the judge. */
  loadTestSet?: () => Promise<{ tests: JudgeTest[] }>;
  /** Per-test time limit for the judge, already adjusted for the browser. */
  timeLimitMs?: number;
  /** Overrides the judge's Web Worker runner (tests inject an in-process one). */
  runner?: () => Runner;
  /** Loads the judge module. Tests may replace it; the page loads it lazily. */
  loadJudge?: () => Promise<typeof Panel>;
  /** Reloads the page (tests replace it). */
  reload?: () => void;
  /** Animate a failing test's input. Returns an error message when it can't. */
  stepThrough?: (input: Record<string, unknown>) => string | null;
}

export interface Editing {
  /** The player reports the highlighted line on every step. */
  setLine(line: number | null): void;
  /** Resolves when Edit has finished opening (for tests). */
  ready(): Promise<void>;
  editor(): Editor | null;
  /** Resolves with the verdict of the run in progress, or the last one (for tests). */
  lastRun(): Promise<Verdict | null>;
  destroy(): void;
}

/**
 * True when a lazily loaded part of the page (editor, judge) couldn't be fetched because the site was
 * redeployed after this page was opened: each deploy replaces every asset file with new hashed names.
 * The messages are Chrome's, Safari's and Firefox's, plus Vite's for CSS preloads.
 */
export const isOutdatedBuild = (e: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i
    .test(e instanceof Error ? e.message : String(e));

const OUTDATED = "This page is out of date: the site was updated after you opened it. Reload to get the new version.";

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
    <button type="button" data-edit="run" hidden>Run tests</button>
    <button type="button" data-edit="reset" hidden>Reset</button>`;
  const toggleBtn = actions.querySelector<HTMLButtonElement>('[data-edit="toggle"]')!;
  const resetBtn = actions.querySelector<HTMLButtonElement>('[data-edit="reset"]')!;
  const runBtn = actions.querySelector<HTMLButtonElement>('[data-edit="run"]')!;
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
    <ul class="problems" data-edit="problems" aria-live="polite"></ul>
    <p class="run-hint" data-edit="run-hint" hidden></p>
    <div class="verdict" data-edit="verdict" aria-live="polite" hidden></div>`;
  listing.after(area);
  const $ = (name: string) => area.querySelector<HTMLElement>(`[data-edit="${name}"]`)!;
  const confirmBox = $("confirm"), statusEl = $("status"), editorBox = $("editor"), problemsEl = $("problems");
  const runHint = $("run-hint"), verdictEl = $("verdict");

  let editor: Editor | null = null;
  let checker: AsyncChecker | null = null;
  let opening: Promise<void> | null = null;
  let editing = false;
  let line: number | null = null;
  let loadError = "";
  let loadOutdated = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  // "Reload" for an out-of-date page: save the edits first, so they're still there after reloading.
  const reloadButton = () => {
    const b = doc.createElement("button");
    b.type = "button";
    b.dataset.edit = "reload";
    b.textContent = canSave ? "Reload (your edits are saved)" : "Reload";
    b.onclick = () => {
      clearTimeout(saveTimer);
      if (editor && canSave) save(editor.getText());
      (o.reload ?? (() => doc.defaultView?.location.reload()))();
    };
    return b;
  };
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
    if (loadOutdated) statusEl.appendChild(reloadButton());
    statusEl.hidden = !notes.length;
  }

  function syncHighlight() {
    editor?.highlightLine(changed() ? null : line);
    resetBtn.hidden = !editing || !changed();
    if (resetBtn.hidden) confirmBox.hidden = true;
    showStatus();
  }

  // Run tests: blocked until the code has been checked, and while it has syntax or contract problems.
  let diagnostics: Diagnostic[] | null = null;
  let running: AbortController | null = null;
  let run: Promise<Verdict | null> = Promise.resolve(null);
  let ranText: string | null = null;

  function syncRun() {
    runBtn.hidden = !editing || !o.loadTestSet;
    const blocking = diagnostics?.filter(d => d.category !== "type").length ?? 0;
    runBtn.disabled = !!running || !editor || diagnostics === null || blocking > 0;
    runHint.hidden = runBtn.hidden || !!running || !editor || (diagnostics !== null && blocking === 0);
    runHint.textContent = diagnostics === null
      ? "Run tests is available once your code has been checked."
      : `Fix the ${blocking === 1 ? "syntax or contract problem" : `${blocking} syntax or contract problems`} above to run the tests.`;
    runBtn.title = runBtn.disabled ? runHint.textContent : "Run your code against this problem's tests";
    // A verdict describes the code it ran; mark it once the code changes.
    const stale = !running && ranText !== null && !!editor && normalize(editor.getText()) !== ranText;
    verdictEl.classList.toggle("stale", stale);
    let note = verdictEl.querySelector(".stale-note");
    if (stale && !note) {
      note = doc.createElement("p");
      note.className = "stale-note";
      note.textContent = "Your code has changed since this run.";
      verdictEl.prepend(note);
    } else if (!stale) note?.remove();
  }

  async function runTests() {
    if (!editor || !checker || running || !o.loadTestSet) return null;
    const source = editor.getText();
    const controller = new AbortController();
    running = controller;
    ranText = null;
    // Clear the previous verdict straight away; the judge may still be downloading.
    verdictEl.hidden = false;
    verdictEl.className = "verdict running";
    delete verdictEl.dataset.verdict;
    verdictEl.textContent = "Loading the tests…";
    syncRun();
    let panel: typeof Panel | null = null;
    try {
      panel = await (o.loadJudge ?? (() => import("../judge/panel.ts")))();
      const cancel = () => controller.abort();
      panel.renderProgress(verdictEl, null, cancel);
      const { tests } = await o.loadTestSet();
      const runner = (o.runner ?? panel.browserRunner)();
      controller.signal.addEventListener("abort", () => runner.dispose());
      const verdict = await panel.judge({
        source, contract: o.contract, tests, checker, runner,
        timeLimitMs: o.timeLimitMs ?? 1000,
        signal: controller.signal,
        onProgress: p => panel!.renderProgress(verdictEl, p, cancel),
      });
      runner.dispose();
      panel.renderVerdict(verdictEl, verdict, o.contract, { onStepThrough: o.stepThrough });
      ranText = normalize(source);
      verdictEl.scrollIntoView?.({ block: "nearest" });
      return verdict;
    } catch (e) {
      verdictEl.hidden = false;
      verdictEl.className = "verdict rte";
      if (isOutdatedBuild(e)) {
        verdictEl.textContent = `The tests couldn't load. ${OUTDATED}`;
        verdictEl.appendChild(reloadButton());
      } else {
        verdictEl.textContent = `The tests couldn't run: ${(e as Error).message}`;
      }
      return null;
    } finally {
      running = null;
      syncRun();
    }
  }
  runBtn.onclick = () => { run = runTests(); };

  function showProblems(list: Diagnostic[]) {
    diagnostics = list;
    syncRun();
    problemsEl.innerHTML = list.length
      ? list.map((d, i) => `<li class="${d.severity}"><button type="button" data-i="${i}">` +
          `<span class="where">Line ${d.line}:${d.column}</span> <span class="kind">${d.category}</span> ${esc(d.message)}</button></li>`).join("")
      : `<li class="none">No problems</li>`;
    problemsEl.onclick = e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-i]");
      if (b) editor?.goTo(list[Number(b.dataset.i)].from);
    };
  }

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
          diagnostics = null;   // until the checker reports on the new text
          syncHighlight();
          syncRun();
        },
        onDiagnostics: showProblems,
      });
      problemsEl.innerHTML = `<li class="none">Checking…</li>`;
      syncHighlight();
      syncRun();
    } catch (e) {
      loadOutdated = isOutdatedBuild(e);
      loadError = loadOutdated ? `The editor couldn't load. ${OUTDATED}` : `The editor couldn't start: ${(e as Error).message}`;
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
    syncRun();
  }

  toggleBtn.onclick = () => setEditing(!editing);
  resetBtn.onclick = () => { confirmBox.hidden = false; confirmBox.querySelector<HTMLButtonElement>('[data-edit="keep"]')!.focus(); };
  $("keep").onclick = () => { confirmBox.hidden = true; editor?.view.focus(); };
  $("discard").onclick = () => {
    confirmBox.hidden = true;
    editor?.setText(reference);
    clearTimeout(saveTimer);
    // The old verdict was about the discarded code.
    verdictEl.hidden = true;
    verdictEl.textContent = "";
    delete verdictEl.dataset.verdict;
    ranText = null;
    try { storage?.removeItem(key); } catch { /* nothing saved */ }
    syncHighlight();
  };
  toggleBtn.title = `Edit the solution. It must stay ${signatureOf(o.contract)}.`;

  return {
    setLine(n) { line = n; if (editor) syncHighlight(); },
    ready: async () => { await opening; },
    editor: () => editor,
    lastRun: () => run,
    destroy() {
      running?.abort();
      clearTimeout(saveTimer);
      editor?.destroy();
      checker?.dispose();
    },
  };
}

export function safeLocalStorage(): Storage | null {
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
