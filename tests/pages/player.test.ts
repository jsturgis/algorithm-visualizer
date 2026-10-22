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

  test("includes the statement, every sample and the constraints", () => {
    const statement = p.$(".statement").textContent!;
    expect(statement).toContain("Example 1");
    for (const param of mod.meta.input) expect(statement).toContain(param.name);
    if (mod.meta.source) expect(statement).toContain(mod.meta.source);
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
    // A different valid value for the first field: the default list without its last number.
    const shorter = () => (mod.meta.visualization.default[first.name] as number[]).slice(0, -1);
    const expectedSteps = (value: number[]) => {
      let input = { ...mod.meta.visualization.default, [first.name]: value };
      if (mod.view.prepare) input = mod.view.prepare(input);
      return mod.buildTrace(input).length;
    };

    test("redraws the animation for a valid new input without clicking Run, paused at step 1", async () => {
      p.click("next"); p.click("next");
      const value = shorter();
      type(value.join(", "));
      await vi.waitFor(() => expect(p.progress()).toEqual([1, expectedSteps(value)]));
      expect(p.button("play").textContent).toContain("Play");
      expect(p.error()).toBe("");
    });

    test("shows the error for invalid input and keeps the last valid animation", async () => {
      p.click("next");
      const before = p.progress();
      type("1, two");
      await vi.waitFor(() => expect(p.error()).toMatch(/whole number/));
      expect(p.progress()).toEqual(before);
    });

    test("doesn't restart when the text changes but the input doesn't", async () => {
      p.click("next"); p.click("next");
      type(field().value + ",  ");
      await new Promise(r => setTimeout(r, LIVE_INPUT_DELAY_MS + 100));
      expect(p.progress()[0]).toBe(3);
    });
  });

  test("Run with junk input shows an error and keeps the current run", () => {
    p.click("next");
    const before = p.progress();
    p.run({ [mod.meta.input[0].name]: "1, two, 3" });
    expect(p.error()).toMatch(/whole number/);
    expect(p.progress()).toEqual(before);
  });
});
