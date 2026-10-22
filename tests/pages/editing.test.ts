// @vitest-environment jsdom
// Edit mode in the code panel, through the page, with the real checker run in-process.
// Editor text is changed through CodeMirror's transaction API: jsdom can't simulate typing into it.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import modules from "virtual:all-algorithms";
import mod from "virtual:algorithm/k-radius-averages";
import { fingerprint, normalize } from "../../src/runtime/editing.ts";
import { MemoryStorage, mountPage, type Page } from "./helpers.ts";

const reference = mod.code.lines.join("\n");
const KEY = "algorithm-visualizer:edit:k-radius-averages";

let p: Page;
let storage: MemoryStorage;
beforeEach(() => { storage = new MemoryStorage(); });
afterEach(() => p?.player.destroy());

const editBtn = () => p.$<HTMLButtonElement>('[data-edit="toggle"]');
const resetBtn = () => p.$<HTMLButtonElement>('[data-edit="reset"]');
const area = () => p.$(".edit-area");
const status = () => p.$('[data-edit="status"]').textContent ?? "";
const problems = () => p.texts(".problems li");
const editor = () => p.player.editing.editor()!;
const text = () => editor().getText();

async function openEditor(page = p) {
  page.$<HTMLButtonElement>('[data-edit="toggle"]').click();
  await page.player.editing.ready();
  await vi.waitFor(() => expect(page.texts(".problems li")).not.toEqual(["Checking…"]));
}
const replace = (from: string, to: string) => {
  const t = text();
  if (!t.includes(from)) throw new Error(`"${from}" not in editor`);
  editor().setText(t.replace(from, to));
};
const waitForProblems = (match: (list: string[]) => boolean) =>
  vi.waitFor(() => { if (!match(problems())) throw new Error(`problems: ${JSON.stringify(problems())}`); });

describe.each(Object.values(modules))("$meta.title", m => {
  test("opens the editor on the displayed solution with no problems", async () => {
    p = mountPage(m, { storage });
    await openEditor();
    expect(text()).toBe(m.code.lines.join("\n"));
    expect(problems()).toEqual(["No problems"]);
  });
});

describe("edit mode", () => {
  beforeEach(() => { p = mountPage(mod, { storage }); });

  test("the code panel is read-only until Edit is clicked", () => {
    expect(editBtn().textContent).toBe("Edit");
    expect(p.$("pre.code").hidden).toBe(false);
    expect(area().hidden).toBe(true);
    expect(p.$(".cm-editor")).toBeNull();
  });

  test("Edit swaps the listing for the editor; Show reference swaps back, keeping edits", async () => {
    await openEditor();
    expect(p.$("pre.code").hidden).toBe(true);
    expect(area().hidden).toBe(false);
    expect(editBtn().textContent).toBe("Show reference");
    expect(editBtn().getAttribute("aria-pressed")).toBe("true");

    replace("return avgs;", "return avgs; // mine");
    editBtn().click();
    expect(p.$("pre.code").hidden).toBe(false);
    expect(editBtn().textContent).toBe("Edit (changed)");
    editBtn().click();
    expect(text()).toContain("// mine");
  });

  test("a type error shows up in the problem list with its line, and fixing it clears it", async () => {
    await openEditor();
    replace('prefix[i + 1] = prefix[i] + nums[i]', 'prefix[i + 1] = "x"');
    await waitForProblems(l => l.length === 1 && l[0].includes("Type 'string' is not assignable to type 'number'."));
    expect(problems()[0]).toMatch(/^Line 6:\d+ type /);

    replace('prefix[i + 1] = "x"', "prefix[i + 1] = prefix[i] + nums[i]");
    await waitForProblems(l => l[0] === "No problems");
  });

  test("syntax and contract errors are labelled by kind", async () => {
    await openEditor();
    replace("for (let i = k;", "for (let i = k");
    await waitForProblems(l => l.length > 0 && l.every(x => / syntax /.test(x)));
    editor().setText(reference.replace("function getAverages", "function averages"));
    await waitForProblems(l => l.length === 1 && / contract Define a function named getAverages/.test(l[0]));
  });

  test("clicking a problem moves the cursor to it", async () => {
    await openEditor();
    replace('prefix[i + 1] = prefix[i] + nums[i]', 'prefix[i + 1] = "x"');
    await waitForProblems(l => l[0] !== "No problems");
    p.$<HTMLButtonElement>(".problems button").click();
    expect(editor().view.state.selection.main.head).toBe(text().indexOf("prefix[i + 1] = \"x\""));
  });

  test("the editor mirrors the step's line until the code changes, then highlighting stops with a note", async () => {
    await openEditor();
    p.until(() => p.highlightedCode()!.startsWith("const sum"));
    const line = p.highlightedLine()!;
    expect(p.$$(".cm-step-line")).toHaveLength(1);
    expect(p.$(".cm-step-line").textContent).toBe(mod.code.lines[line - 1]);
    expect(status()).not.toMatch(/highlighting is off/);

    replace("return avgs;", "return avgs; // mine");
    expect(p.$$(".cm-step-line")).toHaveLength(0);
    expect(status()).toMatch(/Line highlighting is off while your code differs from the reference/);
    p.click("next");
    expect(p.$$(".cm-step-line")).toHaveLength(0);

    // Undoing the change by hand brings highlighting back.
    replace("return avgs; // mine", "return avgs;");
    expect(p.$$(".cm-step-line")).toHaveLength(1);
    expect(status()).not.toMatch(/highlighting is off/);
  });

  test("the editor highlights every line of a multi-line step", async () => {
    const { default: reverse } = await import("virtual:algorithm/reverse-string");
    p = mountPage(reverse, { storage });
    await openEditor();
    p.until(() => p.note().startsWith("Move both pointers"));
    expect(p.$$(".cm-step-line").map(l => l.textContent!.trim())).toEqual(["left++;", "right--;"]);
  });

  test("whitespace-only differences still count as the reference", async () => {
    await openEditor();
    editor().setText(reference.split("\n").map(l => l + "   ").join("\r\n") + "\n\n");
    expect(p.$$(".cm-step-line")).toHaveLength(1);
    expect(resetBtn().hidden).toBe(true);
  });

  test("the read-only listing keeps highlighting while edits exist", async () => {
    await openEditor();
    replace("return avgs;", "return avgs; // mine");
    editBtn().click();
    p.click("next");
    expect(p.highlightedLine()).not.toBeNull();
  });

  test("Reset appears only for changed code and asks before discarding", async () => {
    await openEditor();
    expect(resetBtn().hidden).toBe(true);
    replace("return avgs;", "return avgs; // mine");
    expect(resetBtn().hidden).toBe(false);

    resetBtn().click();
    expect(p.$('[data-edit="confirm"]').hidden).toBe(false);
    p.$<HTMLButtonElement>('[data-edit="keep"]').click();
    expect(p.$('[data-edit="confirm"]').hidden).toBe(true);
    expect(text()).toContain("// mine");

    resetBtn().click();
    p.$<HTMLButtonElement>('[data-edit="discard"]').click();
    expect(text()).toBe(reference);
    expect(resetBtn().hidden).toBe(true);
    expect(storage.getItem(KEY)).toBeNull();
  });

  test("player shortcuts are ignored while typing in the editor, and work again outside it", async () => {
    await openEditor();
    p.press("ArrowRight");
    expect(p.progress()[0]).toBe(2);

    // CodeMirror lets these keys bubble (it inserts text on input, not keydown), so the player must ignore them.
    const typeInEditor = (key: string) => p.$(".cm-content").dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    typeInEditor("r");
    typeInEditor(" ");
    expect(p.progress()[0]).toBe(2);
    expect(p.button("play").textContent).toContain("Play");

    p.press("r");
    expect(p.progress()[0]).toBe(1);
  });

  test("the editor is labelled and the problem list is a live region", async () => {
    await openEditor();
    expect(p.$(".cm-content").getAttribute("aria-label")).toBe("Solution code editor");
    expect(p.$(".problems").getAttribute("aria-live")).toBe("polite");
  });

  test("the Edit button names the function the code must keep", () => {
    expect(editBtn().title).toContain("getAverages(nums: number[], k: number): number[]");
  });
});

describe("saved edits", () => {
  test("are saved, survive re-mounting, and are kept per algorithm", async () => {
    p = mountPage(mod, { storage });
    await openEditor();
    replace("return avgs;", "return avgs; // mine");
    await vi.waitFor(() => expect(storage.getItem(KEY)).not.toBeNull());
    expect(JSON.parse(storage.getItem(KEY)!)).toEqual({ code: text(), ref: fingerprint(normalize(reference)) });

    p = mountPage(mod, { storage });
    expect(editBtn().textContent).toBe("Edit (changed)");
    await openEditor();
    expect(text()).toContain("// mine");

    p = mountPage(modules["binary-search"], { storage });
    await openEditor();
    expect(text()).toBe(modules["binary-search"].code.lines.join("\n"));
  });

  test("matching the reference again removes the saved edit", async () => {
    p = mountPage(mod, { storage });
    await openEditor();
    replace("return avgs;", "return avgs; // mine");
    await vi.waitFor(() => expect(storage.getItem(KEY)).not.toBeNull());
    replace("return avgs; // mine", "return avgs;");
    await vi.waitFor(() => expect(storage.getItem(KEY)).toBeNull());
  });

  test("an edit based on an older reference is kept, with a notice to reset", async () => {
    storage.setItem(KEY, JSON.stringify({ code: "function getAverages(nums: number[], k: number): number[] { return []; }", ref: "old" }));
    p = mountPage(mod, { storage });
    await openEditor();
    expect(text()).toContain("return [];");
    expect(status()).toMatch(/based on an older version of the reference solution/);
  });

  test("editing still works when storage is unavailable, with a note that edits won't be saved", async () => {
    const broken = new MemoryStorage();
    broken.getItem = broken.setItem = () => { throw new Error("SecurityError"); };
    p = mountPage(mod, { storage: broken });
    await openEditor();
    replace("return avgs;", "return avgs; // mine");
    expect(status()).toMatch(/can't be saved in this browser/);
    await waitForProblems(l => l[0] === "No problems");
  });

  test("with no storage at all, editing still works", async () => {
    p = mountPage(mod, { storage: null });
    await openEditor();
    expect(status()).toMatch(/can't be saved/);
  });
});

describe("loading", () => {
  test("shows a starting message until the editor is ready", async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    p = mountPage(mod, { storage, loadEditor: async () => { await gate; return import("../../src/editor/editor.ts"); } });
    editBtn().click();
    expect(status()).toMatch(/Starting the editor and type checker/);
    release();
    await p.player.editing.ready();
    expect(status()).not.toMatch(/Starting/);
  });

  test("an editor from an older deploy explains the page is out of date and offers Reload", async () => {
    const reload = vi.fn();
    p = mountPage(mod, {
      storage, reload,
      loadEditor: () => Promise.reject(new TypeError("Importing a module script failed.")),
    });
    editBtn().click();
    await p.player.editing.ready();
    expect(status()).toContain("The editor couldn't load. This page is out of date");
    p.$<HTMLButtonElement>('[data-edit="status"] [data-edit="reload"]').click();
    expect(reload).toHaveBeenCalledOnce();
  });

  test("explains when the editor can't start", async () => {
    p = mountPage(mod, { storage, checker: async () => { throw new Error("worker blocked"); } });
    editBtn().click();
    await p.player.editing.ready();
    expect(status()).toMatch(/The editor couldn't start: worker blocked/);
  });
});
