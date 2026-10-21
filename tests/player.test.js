// Behaviour every algorithm page gets from the shared player. Runs once per page in algorithms.js, plus the template.
import { describe, test, expect } from "vitest";
import { loadPage, registry } from "./helpers.js";

const pages = [
  ...registry().map(a => ({ name: a.title, path: `algorithms/${a.slug}/index.html`, title: a.title })),
  { name: "Template", path: "algorithms/_template/index.html", title: null },
];

describe.each(pages)("$name page", ({ path, title }) => {
  test("loads without script errors", async () => {
    const p = await loadPage(path);
    expect(p.errors).toEqual([]);
  });

  if (title) {
    test("heading and <title> match the home page entry", async () => {
      const p = await loadPage(path);
      expect(p.$("h1").textContent).toBe(title);
      expect(p.document.title).toBe(title);
    });
  }

  test("links back to the home page", async () => {
    const p = await loadPage(path);
    const hrefs = p.$$(".topbar a").map(a => a.getAttribute("href"));
    expect(hrefs).toContain("../../");
  });

  test("starts on step 1 with Back disabled", async () => {
    const p = await loadPage(path);
    const [cur, total] = p.progress();
    expect(cur).toBe(1);
    expect(total).toBeGreaterThan(1);
    expect(p.button("prev").disabled).toBe(true);
    expect(p.button("next").disabled).toBe(false);
  });

  test("every step highlights one code line and explains itself", async () => {
    const p = await loadPage(path);
    const lineCount = p.$$(".ln").length;
    const [, total] = p.progress();
    for (let k = 1; k <= total; k++) {
      expect(p.progress()[0]).toBe(k);
      const line = p.highlightedLine();
      expect(line).toBeGreaterThanOrEqual(1);
      expect(line).toBeLessThanOrEqual(lineCount);
      expect(p.note().trim()).not.toBe("");
      if (k < total) p.click("next");
    }
    expect(p.button("next").disabled).toBe(true);
  });

  test("Step, Back and Restart move through the trace", async () => {
    const p = await loadPage(path);
    p.click("next"); p.click("next");
    expect(p.progress()[0]).toBe(3);
    p.click("prev");
    expect(p.progress()[0]).toBe(2);
    p.click("reset");
    expect(p.progress()[0]).toBe(1);
  });

  test("keyboard shortcuts: → steps, ← goes back, R restarts", async () => {
    const p = await loadPage(path);
    p.press("ArrowRight"); p.press("ArrowRight");
    expect(p.progress()[0]).toBe(3);
    p.press("ArrowLeft");
    expect(p.progress()[0]).toBe(2);
    p.press("r");
    expect(p.progress()[0]).toBe(1);
  });

  test("Play switches to Pause, and Pause stops", async () => {
    const p = await loadPage(path);
    p.click("play");
    expect(p.button("play").textContent).toContain("Pause");
    p.click("play");
    expect(p.button("play").textContent).toContain("Play");
  });

  test("Play from the last step starts over", async () => {
    const p = await loadPage(path);
    p.toEnd();
    p.click("play");
    expect(p.progress()[0]).toBe(1);
    p.click("play");
  });

  test("Run with valid input restarts from step 1 and clears errors", async () => {
    const p = await loadPage(path);
    p.click("next"); p.click("next");
    const defaults = Object.fromEntries(p.$$("[data-input] input").map(i => [i.id.slice(3), i.value]));
    p.run(defaults);
    expect(p.error()).toBe("");
    expect(p.progress()[0]).toBe(1);
  });

  test("Run with junk input shows an error and keeps the current run", async () => {
    const p = await loadPage(path);
    p.click("next");
    const before = p.progress();
    p.run({ arr: "1, two, 3" });
    expect(p.error()).not.toBe("");
    expect(p.progress()).toEqual(before);
  });
});
