// @vitest-environment jsdom
// Behaviour every algorithm page gets from the shared player and page shell. Runs once per package.
import { beforeEach, describe, expect, test, vi } from "vitest";
import modules from "virtual:all-algorithms";
import { LIVE_INPUT_DELAY_MS } from "../../src/runtime/player.ts";
import { mountPage, type Page } from "./helpers.ts";

describe.each(Object.values(modules))("$meta.title page", mod => {
  let p: Page;
  beforeEach(() => { p = mountPage(mod); });

  test("shows the title, tags and complexity from problem.yaml", () => {
    expect(p.$("h1").textContent).toBe(mod.meta.title);
    const tags = p.texts("header .tag");
    for (const t of mod.meta.tags) expect(tags).toContain(t);
    expect(tags).toContain(`${mod.meta.complexity.time} time`);
  });

  test("shows the accepted solution without @line markers", () => {
    expect(p.$$(".ln").map(l => l.textContent!.replace(/^\d+/, ""))).toEqual(mod.code.lines.map(l => l || " "));
    expect(p.$("[data-code]").textContent).not.toContain("@line");
  });

  test("the Problem tab has the approach, statement, every sample and the constraints", () => {
    const problem = p.$('[data-tab-panel="problem"]').textContent!;
    expect(problem).toContain("Approach");
    expect(problem).toContain("Example 1");
    for (const param of mod.meta.input) expect(problem).toContain(param.name);
    if (mod.meta.source) expect(problem).toContain(mod.meta.source);
  });

  test("is a workspace: Problem / Code tabs on the left, the animation on the right, controls in a bar", () => {
    const left = p.$(".pane-left"), right = p.$(".pane-right");
    expect(left.querySelector('[data-tab-panel="code"] [data-code]')).not.toBeNull();
    expect(left.querySelector('[data-tab-panel="code"] [data-edit="toggle"]')).not.toBeNull();   // Edit lives in the Code tab
    for (const sel of ["[data-stage]", "[data-note]", "[data-input]"]) expect(right.querySelector(sel), sel).not.toBeNull();
    expect(p.$(".control-bar").matches("[data-controls]")).toBe(true);
    expect(p.$(".control-bar").querySelector('[data-act="play"]')).not.toBeNull();
    // Reading order matches the layout: left pane, right pane, then the control bar.
    const order = [left, right, p.$(".control-bar")];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  test("links back to the home page", () => {
    expect(p.$$(".topbar a").map(a => a.getAttribute("href"))).toContain("../../");
  });

  test("starts on step 1 with Back disabled", () => {
    const [cur, total] = p.progress();
    expect(cur).toBe(1);
    expect(total).toBeGreaterThan(1);
    expect(p.button("prev").disabled).toBe(true);
    expect(p.button("next").disabled).toBe(false);
  });

  test("every step highlights one code line and explains itself", () => {
    const [, total] = p.progress();
    for (let k = 1; k <= total; k++) {
      expect(p.progress()[0]).toBe(k);
      expect(p.highlightedLine()).not.toBeNull();
      expect(p.note().trim()).not.toBe("");
      if (k < total) p.click("next");
    }
    expect(p.button("next").disabled).toBe(true);
  });

  test("Step, Back and Restart move through the trace", () => {
    p.click("next"); p.click("next");
    expect(p.progress()[0]).toBe(3);
    p.click("prev");
    expect(p.progress()[0]).toBe(2);
    p.click("reset");
    expect(p.progress()[0]).toBe(1);
  });

  test("keyboard shortcuts: → steps, ← goes back, R restarts", () => {
    p.press("ArrowRight"); p.press("ArrowRight");
    expect(p.progress()[0]).toBe(3);
    p.press("ArrowLeft");
    expect(p.progress()[0]).toBe(2);
    p.press("r");
    expect(p.progress()[0]).toBe(1);
  });

  test("Space on a focused button or tab presses it instead of playing", () => {
    for (const sel of ['[data-act="next"]', '[data-tab="code"]', '[data-act="reset"]']) {
      const el = p.$<HTMLElement>(sel);
      el.focus();
      el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      expect(p.button("play").getAttribute("aria-label"), sel).toBe("Play");
    }
  });

  test("arrow keys on the speed slider change the speed, not the step; on a button they still step", () => {
    const slider = p.$<HTMLInputElement>('[data-act="speed"]');
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(p.progress()[0]).toBe(1);
    p.button("next").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(p.progress()[0]).toBe(2);
  });

  test("the speed slider and the icon buttons have accessible names", () => {
    const slider = p.$<HTMLInputElement>('[data-act="speed"]');
    expect(slider.getAttribute("aria-label")).toBe("Speed");
    expect(slider.getAttribute("aria-valuetext")).toBe("Normal");
    slider.value = "5";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(slider.getAttribute("aria-valuetext")).toBe("Fastest");
    expect(["reset", "prev", "play", "next"].map(a => p.button(a).getAttribute("aria-label"))).toEqual(["Restart", "Back", "Play", "Step"]);
    p.click("play");
    expect(p.button("play").getAttribute("aria-label")).toBe("Pause");
    p.click("play");
  });

  test("the step note is announced to screen readers", () => {
    expect(p.$("[data-note]").getAttribute("aria-live")).toBe("polite");
  });

  test("the current code line is repeated beside the animation", () => {
    p.click("next"); p.click("next");
    const line = p.highlightedLine()!;
    expect(p.$("[data-current-line] .no").textContent).toBe(String(line));
    expect(p.$("[data-current-line] code").textContent).toBe(mod.code.lines[line - 1].trim());
  });

  test("Play switches to Pause, and Pause stops", () => {
    p.click("play");
    expect(p.button("play").textContent).toContain("Pause");
    p.click("play");
    expect(p.button("play").textContent).toContain("Play");
  });

  test("Play from the last step starts over", () => {
    p.toEnd();
    p.click("play");
    expect(p.progress()[0]).toBe(1);
    p.click("play");
  });

  test("has an input field per parameter, filled with the default input", () => {
    expect(p.$$("[data-input] input").map(i => i.id)).toEqual(mod.meta.input.map(i => `in-${i.name}`));
  });

  test("Run with the default input restarts from step 1 and clears errors", () => {
    p.click("next"); p.click("next");
    p.run({});
    expect(p.error()).toBe("");
    expect(p.progress()[0]).toBe(1);
  });

  describe("typing in the input fields", () => {
    const first = mod.meta.input[0];
    const field = () => p.$<HTMLInputElement>(`#in-${first.name}`);
    const type = (value: string) => {
      field().value = value;
      field().dispatchEvent(new Event("input", { bubbles: true }));
    };
    const edit = editsFor(first, mod.meta.visualization.default[first.name]);
    const expectedSteps = (value: unknown) => {
      let input = { ...mod.meta.visualization.default, [first.name]: value };
      if (mod.view.prepare) input = mod.view.prepare(input);
      return mod.buildTrace(input).length;
    };

    test("redraws the animation for a valid new input without clicking Run, paused at step 1", async () => {
      p.click("next"); p.click("next");
      const value = edit.valid;
      type(edit.validText);
      await vi.waitFor(() => expect(p.progress()).toEqual([1, expectedSteps(value)]));
      expect(p.button("play").textContent).toContain("Play");
      expect(p.error()).toBe("");
    });

    test("shows the error for invalid input and keeps the last valid animation", async () => {
      p.click("next");
      const before = p.progress();
      type(edit.invalidText);
      await vi.waitFor(() => expect(p.error()).not.toBe(""));
      expect(p.progress()).toEqual(before);
    });

    test.skipIf(edit.sameInputText === null)("doesn't restart when the text changes but the input doesn't", async () => {
      p.click("next"); p.click("next");
      type(edit.sameInputText!);
      await new Promise(r => setTimeout(r, LIVE_INPUT_DELAY_MS + 100));
      expect(p.progress()[0]).toBe(3);
    });
  });

  test("Run with junk input shows an error and keeps the current run", () => {
    p.click("next");
    const before = p.progress();
    const first = mod.meta.input[0];
    p.run({ [first.name]: editsFor(first, mod.meta.visualization.default[first.name]).invalidText });
    expect(p.error()).not.toBe("");
    expect(p.progress()).toEqual(before);
  });
});

/**
 * Ways to change an input field: a different valid value, an invalid one, and a text change that leaves
 * the input the same (null for strings, which are taken exactly as typed).
 */
function editsFor(param: { type: string; value?: [number, number] }, value: unknown): { valid: unknown; validText: string; invalidText: string; sameInputText: string | null } {
  switch (param.type) {
    case "int[]": {
      // Change the first number rather than the length, so rules that involve other inputs still hold
      // (k ≤ nums.length, query ranges). Lowering it keeps a sorted array sorted.
      const list = value as number[];
      const [lo, hi] = param.value ?? [-Infinity, Infinity];
      const first = list[0] - 1 >= lo ? list[0] - 1 : Math.min(list[0] + 1, hi);
      const valid = [first, ...list.slice(1)];
      return { valid, validText: valid.join(", "), invalidText: "1, two", sameInputText: list.join(", ") + ",  " };
    }
    case "string[]": {
      const list = value as unknown[];
      return {
        valid: list.slice(0, -1),
        validText: list.slice(0, -1).join(", "),
        invalidText: "ab, c",   // c is fine; "ab" isn't one character
        sameInputText: list.join(", ") + ",  ",
      };
    }
    case "string": {
      const text = value as string;
      return { valid: text.slice(0, -1), validText: text.slice(0, -1), invalidText: text + "!", sameInputText: null };
    }
    default:
      throw new Error(`No edits for input type ${param.type}`);
  }
}

describe("steps that run several lines at once", async () => {
  const { default: reverse } = await import("virtual:algorithm/reverse-string");
  const { buildTrace } = await import("../../problems/reverse-string/visualization/trace.ts");

  test("highlight the whole block in the code panel and the current-line strip", () => {
    const p = mountPage(reverse);
    p.until(() => p.note().startsWith("Move both pointers"));
    const lines = p.highlightedLines();
    expect(lines.map(n => reverse.code.lines[n - 1].trim())).toEqual(["left++;", "right--;"]);
    expect(p.$$("[data-current-line] code").map(c => c.textContent)).toEqual(["left++;", "right--;"]);
    p.player.destroy();
  });

  test("Reverse String swaps in three visible steps, so the temporary copy shows", () => {
    const steps = buildTrace({ s: ["a", "b"] });
    expect(steps.map(s => s.line)).toEqual(["init", "loop", "save", "put-right", "put-temp", "move", "loop", "return"]);
    expect(steps.find(s => s.line === "put-right")!.s).toEqual(["b", "b"]);   // both slots briefly hold "b"
    expect(steps.find(s => s.line === "put-temp")!.s).toEqual(["b", "a"]);
  });
});

