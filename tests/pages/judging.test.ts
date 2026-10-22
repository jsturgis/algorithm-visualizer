// @vitest-environment jsdom
// Run tests in edit mode, through the page. The judge runs in-process here (jsdom has no workers);
// fake runners stand in for timeouts and slow runs. Real time limits are covered by tests/judge.test.ts.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import mod from "virtual:algorithm/k-radius-averages";
import { inProcessRunner, type Runner } from "../../src/judge/runner.ts";
import { MemoryStorage, mountPage, type Page } from "./helpers.ts";

const reference = mod.code.lines.join("\n");
const total = (await mod.loadTestSet()).tests.length;

let p: Page;
afterEach(() => p?.player.destroy());

const runBtn = () => p.$<HTMLButtonElement>('[data-edit="run"]');
const hint = () => p.$('[data-edit="run-hint"]');
const verdict = () => p.$('[data-edit="verdict"]');
const editor = () => p.player.editing.editor()!;
const setText = (t: string) => editor().setText(t);
const lastIndexReplace = (from: string, to: string) => {
  const i = reference.lastIndexOf(from);
  return reference.slice(0, i) + to + reference.slice(i + from.length);
};

async function openEditor() {
  p.$<HTMLButtonElement>('[data-edit="toggle"]').click();
  await p.player.editing.ready();
  await vi.waitFor(() => expect(p.texts(".problems li")).not.toEqual(["Checking…"]));
}
const runnable = () => vi.waitFor(() => expect(runBtn().disabled).toBe(false));
async function runTests() {
  await runnable();
  runBtn().click();
  return p.player.editing.lastRun();
}

describe("the Run tests button", () => {
  beforeEach(() => { p = mountPage(mod); });

  test("is hidden outside edit mode", async () => {
    expect(runBtn().hidden).toBe(true);
    await openEditor();
    expect(runBtn().hidden).toBe(false);
    p.$<HTMLButtonElement>('[data-edit="toggle"]').click();
    expect(runBtn().hidden).toBe(true);
  });

  test("is enabled once the code has been checked and has no problems", async () => {
    await openEditor();
    await runnable();
    expect(hint().hidden).toBe(true);
  });

  test("is disabled, with an explanation, while there are syntax or contract problems", async () => {
    await openEditor();
    setText(reference.replace("function getAverages", "function averages"));
    await vi.waitFor(() => expect(hint().textContent).toBe("Fix the syntax or contract problem above to run the tests."));
    expect(runBtn().disabled).toBe(true);
    expect(hint().hidden).toBe(false);
    expect(runBtn().title).toBe(hint().textContent);
  });

  test("is disabled while the new text hasn't been checked yet", async () => {
    await openEditor();
    await runnable();
    setText(reference + "\n// changed");
    expect(runBtn().disabled).toBe(true);
    expect(hint().textContent).toMatch(/once your code has been checked/);
    await runnable();
  });

  test("stays enabled when there are only type errors", async () => {
    await openEditor();
    setText(lastIndexReplace("return avgs;", "const label: string = n;\n    return avgs;"));
    await vi.waitFor(() => expect(p.texts(".problems li")[0]).toMatch(/type/));
    await runnable();
  });
});

describe("verdicts", () => {
  beforeEach(() => { p = mountPage(mod); });

  test("Accepted shows how many tests passed and the slowest one", async () => {
    await openEditor();
    expect(await runTests()).toMatchObject({ kind: "Accepted" });
    expect(verdict().dataset.verdict).toBe("Accepted");
    expect(verdict().textContent).toContain(`All ${total} tests passed.`);
    expect(verdict().textContent).toMatch(/Slowest: large\//);
  });

  test("Wrong Answer shows the test, its input, the expected and actual output, and the first difference", async () => {
    await openEditor();
    setText(reference.replace("Math.floor(sum / size)", "Math.round(sum / size)"));
    expect(await runTests()).toMatchObject({ kind: "WrongAnswer" });
    const text = verdict().textContent!;
    expect(text).toContain(`On test 1 of ${total}: sample/1, a sample from the problem statement. 0 tests passed before it.`);
    expect(p.texts(".verdict dt")).toEqual(["nums", "k", "expected", "your output"]);
    expect(p.texts(".verdict dd code")).toEqual(["[7, 4, 3, 9, 1, 8, 5, 2, 6]", "3", "[-1, -1, -1, 5, 4, 4, -1, -1, -1]", "[-1, -1, -1, 5, 5, 5, -1, -1, -1]"]);
    expect(p.texts(".verdict mark")).toEqual(["4", "5"]);
    expect(text).toContain("First difference at index 4.");
    expect(p.$$(".verdict .copy")).toHaveLength(4);
  });

  test("Runtime Error shows the message and the input", async () => {
    await openEditor();
    setText(lastIndexReplace("return avgs;", "if (k > 2) throw new RangeError('k too big');\n    return avgs;"));
    expect(await runTests()).toMatchObject({ kind: "RuntimeError" });
    expect(p.$(".verdict .error-message").textContent).toBe("RangeError: k too big");
    expect(p.texts(".verdict dt")).toEqual(["nums", "k"]);
  });

  test("Time Limit Exceeded names the test and the browser-adjusted limit", async () => {
    const timeout: () => Runner = () => ({
      load: async () => ({ ok: true }),
      run: async () => ({ kind: "timeout", ms: 1750 }),
      dispose() {},
    });
    p = mountPage(mod, { runner: timeout });
    await openEditor();
    expect(await runTests()).toMatchObject({ kind: "TimeLimitExceeded" });
    expect(verdict().textContent).toContain("It ran longer than 1,500 ms (the problem's 500 ms × 3 for running in a browser).");
    expect(verdict().textContent).toContain("Check for a loop that never ends.");
  });

  test("type errors are noted on the verdict", async () => {
    await openEditor();
    setText(lastIndexReplace("return avgs;", "const label: string = n;\n    return avgs;"));
    await vi.waitFor(() => expect(p.texts(".problems li")[0]).toMatch(/type/));
    expect(await runTests()).toMatchObject({ kind: "Accepted", typeErrors: 1 });
    expect(p.$(".verdict .type-note").textContent).toBe("Ran despite 1 type error.");
  });

  test("the verdict is a live region", async () => {
    expect(verdict().getAttribute("aria-live")).toBe("polite");
  });
});

describe("running", () => {
  test("shows progress, and Cancel stops the run", async () => {
    // The real in-process runner, except that the third test never finishes on its own.
    let calls = 0;
    let release: (() => void) | undefined;
    const slow: () => Runner = () => {
      const real = inProcessRunner();
      return {
        load: real.load,
        run: async (args, limit) => {
          if (++calls === 3) await new Promise<void>(r => { release = r; });
          return real.run(args, limit);
        },
        dispose() { release?.(); real.dispose(); },
      };
    };
    p = mountPage(mod, { runner: slow });
    await openEditor();
    await runnable();
    runBtn().click();
    await vi.waitFor(() => expect(p.$(".verdict .progress-line")?.textContent).toMatch(/Running test \d+ of \d+/));
    expect(runBtn().disabled).toBe(true);
    p.$<HTMLButtonElement>('[data-judge="cancel"]').click();
    const v = await p.player.editing.lastRun();
    expect(v).toMatchObject({ kind: "Cancelled" });
    expect(verdict().textContent).toBe(`CancelledStopped after 2 tests of ${total}.`);
    await runnable();
  });

  test("clears the previous verdict as soon as Run is clicked", async () => {
    p = mountPage(mod);
    await openEditor();
    await runTests();
    runBtn().click();
    expect(verdict().dataset.verdict).toBeUndefined();
    expect(verdict().classList.contains("running")).toBe(true);
    await p.player.editing.lastRun();
  });

  test("the verdict is marked out of date when the code changes, until it's run again", async () => {
    p = mountPage(mod);
    await openEditor();
    await runTests();
    expect(verdict().classList.contains("stale")).toBe(false);
    setText(reference + "\n// changed");
    expect(verdict().classList.contains("stale")).toBe(true);
    expect(p.$(".verdict .stale-note").textContent).toBe("Your code has changed since this run.");
    await runTests();
    expect(verdict().classList.contains("stale")).toBe(false);
    expect(p.$(".verdict .stale-note")).toBeNull();
  });

  test("the visualization still plays the reference solution", async () => {
    p = mountPage(mod);
    await openEditor();
    const steps = p.progress()[1];
    setText(reference.replace("Math.floor(sum / size)", "Math.round(sum / size)"));
    await runTests();
    expect(p.progress()[1]).toBe(steps);
    p.toEnd();
    expect(p.texts("#avgs .box")).toEqual(["-1", "-1", "-1", "5", "4", "4", "-1", "-1", "-1"]);
  });
});

describe("after a run", () => {
  test("Reset clears the verdict about the discarded code", async () => {
    p = mountPage(mod);
    await openEditor();
    setText(reference.replace("Math.floor(sum / size)", "Math.round(sum / size)"));
    await runTests();
    expect(verdict().hidden).toBe(false);
    p.$<HTMLButtonElement>('[data-edit="reset"]').click();
    p.$<HTMLButtonElement>('[data-edit="discard"]').click();
    expect(verdict().hidden).toBe(true);
    expect(verdict().textContent).toBe("");
  });

  test("Step through this input animates the failing test's input", async () => {
    p = mountPage(mod);
    await openEditor();
    setText(reference.replace("Math.floor(sum / size)", "Math.round(sum / size)"));
    const v = await runTests();
    expect(v).toMatchObject({ kind: "WrongAnswer", test: { name: "sample/1" } });
    p.click("next"); p.click("next");
    p.$<HTMLButtonElement>('[data-judge="step-through"]').click();
    expect(p.$<HTMLInputElement>("#in-nums").value).toBe("7, 4, 3, 9, 1, 8, 5, 2, 6");
    expect(p.$<HTMLInputElement>("#in-k").value).toBe("3");
    expect(p.progress()[0]).toBe(1);
    expect(p.$(".verdict .step-through-note").textContent).toMatch(/now shows this input/);
  });

  test("Step through this input explains when the input is too big to animate", async () => {
    p = mountPage(mod);
    await openEditor();
    setText(lastIndexReplace("return avgs;", "if (n > 1000) avgs[0] = 7;\n    return avgs;"));
    expect(await runTests()).toMatchObject({ kind: "WrongAnswer", test: { category: "large" } });
    const before = p.$<HTMLInputElement>("#in-nums").value;
    p.$<HTMLButtonElement>('[data-judge="step-through"]').click();
    expect(p.$(".verdict .step-through-note").textContent).toMatch(/^This input is too big to animate here: nums must have between 1 and 12 numbers/);
    expect(p.$<HTMLInputElement>("#in-nums").value).toBe(before);
  });
});

describe("a page opened before the site was redeployed", () => {
  test("explains that the page is out of date, and Reload saves the edits first", async () => {
    const storage = new MemoryStorage();
    const reload = vi.fn();
    p = mountPage(mod, {
      storage, reload,
      loadJudge: () => Promise.reject(new TypeError("Failed to fetch dynamically imported module: https://example.test/assets/panel-OLD.js")),
    });
    await openEditor();
    setText(reference.replace("Math.floor(sum / size)", "Math.round(sum / size)"));
    expect(await runTests()).toBeNull();
    expect(verdict().textContent).toContain("The tests couldn't load. This page is out of date: the site was updated after you opened it.");
    const button = p.$<HTMLButtonElement>('.verdict [data-edit="reload"]');
    expect(button.textContent).toBe("Reload (your edits are saved)");
    button.click();
    expect(reload).toHaveBeenCalledOnce();
    expect(JSON.parse(storage.getItem("algorithm-visualizer:edit:k-radius-averages")!).code).toContain("Math.round");
  });

  test("other loading errors are reported as they are, without Reload", async () => {
    p = mountPage(mod, { loadJudge: () => Promise.reject(new Error("disk on fire")) });
    await openEditor();
    await runTests();
    expect(verdict().textContent).toBe("The tests couldn't run: disk on fire");
    expect(p.$('.verdict [data-edit="reload"]')).toBeNull();
  });
});
