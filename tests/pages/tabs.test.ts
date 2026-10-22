// @vitest-environment jsdom
// The Problem / Code tabs in the left pane.
import { afterEach, describe, expect, test } from "vitest";
import modules from "virtual:all-algorithms";
import mod from "virtual:algorithm/k-radius-averages";
import { MemoryStorage, mountPage, type Page } from "./helpers.ts";

let p: Page;
afterEach(() => p?.player.destroy());

const tab = (name: string) => p.$<HTMLButtonElement>(`[data-tab="${name}"]`);
const panel = (name: string) => p.$(`[data-tab-panel="${name}"]`);
const showing = () => ({
  selected: ["problem", "code"].filter(n => tab(n).getAttribute("aria-selected") === "true"),
  visible: ["problem", "code"].filter(n => !panel(n).hidden),
});

describe("Problem / Code tabs", () => {
  test("the first visit to an algorithm opens on Problem", () => {
    p = mountPage(mod, { storage: new MemoryStorage() });
    expect(showing()).toEqual({ selected: ["problem"], visible: ["problem"] });
    expect(p.player.tabs.current()).toBe("problem");
  });

  test("are a labelled tablist whose tabs control their panels", () => {
    p = mountPage(mod, { storage: new MemoryStorage() });
    expect(p.$('[role="tablist"]').getAttribute("aria-label")).toBe("Problem and code");
    for (const n of ["problem", "code"]) {
      expect(tab(n).getAttribute("role")).toBe("tab");
      expect(panel(n).id).toBe(tab(n).getAttribute("aria-controls"));
      expect(panel(n).getAttribute("aria-labelledby")).toBe(tab(n).id);
    }
  });

  test("clicking a tab switches panels, and the choice is remembered per algorithm", () => {
    const storage = new MemoryStorage();
    p = mountPage(mod, { storage });
    tab("code").click();
    expect(showing()).toEqual({ selected: ["code"], visible: ["code"] });

    p = mountPage(mod, { storage });
    expect(showing()).toEqual({ selected: ["code"], visible: ["code"] });

    p = mountPage(modules["binary-search"], { storage });
    expect(showing().selected).toEqual(["problem"]);
  });

  test("work when storage is unavailable", () => {
    const broken = new MemoryStorage();
    broken.getItem = broken.setItem = () => { throw new Error("SecurityError"); };
    p = mountPage(mod, { storage: broken });
    expect(showing().selected).toEqual(["problem"]);
    tab("code").click();
    expect(showing().selected).toEqual(["code"]);
  });

  test("both tabs stay keyboard-focusable, and ← / → still step the player", () => {
    p = mountPage(mod, { storage: new MemoryStorage() });
    for (const n of ["problem", "code"]) expect(tab(n).tabIndex).toBe(0);
    tab("code").focus();
    tab("code").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(p.progress()[0]).toBe(2);
    expect(showing().selected).toEqual(["problem"]);   // arrows don't switch tabs
  });
});
