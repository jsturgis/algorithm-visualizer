// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import algorithms from "virtual:algorithms";
import { ROOT } from "../../build/package.ts";
import { mountHome } from "../../src/home/home.ts";

const html = readFileSync(path.join(ROOT, "site/index.html"), "utf8");
const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!;
const $$ = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const cardTitles = () => $$(".card h2").map(h => h.textContent);
const chip = (tag: string) => $$(".chip").find(c => c.dataset.tag === tag)!;
const search = (text: string) => {
  const q = $("#q") as HTMLInputElement;
  q.value = text;
  q.dispatchEvent(new Event("input"));
};

beforeEach(() => {
  document.body.innerHTML = html.slice(html.indexOf("<body>") + 6, html.indexOf("<script"));
  mountHome();
});

describe("home page", () => {
  test("shows a card for every package except the template, alphabetically", () => {
    const titles = algorithms.map(a => a.title).sort((a, b) => a.localeCompare(b));
    expect(titles.length).toBeGreaterThan(0);
    expect(algorithms.some(a => a.slug.startsWith("_"))).toBe(false);
    expect(cardTitles()).toEqual(titles);
    expect($("#count").textContent).toBe(`${algorithms.length} of ${algorithms.length} algorithms`);
  });

  test("each card links to its algorithm's page and shows its time complexity", () => {
    for (const a of algorithms) {
      const card = $$(".card").find(c => c.querySelector("h2")!.textContent === a.title)!;
      expect(card.getAttribute("href")).toBe(`algorithms/${a.slug}/`);
      expect(card.textContent).toContain(a.complexity.time);
    }
  });

  test("has a chip for All plus every tag", () => {
    const tags = [...new Set(algorithms.flatMap(a => a.tags))].sort();
    expect($$(".chip").map(c => c.dataset.tag)).toEqual(["All", ...tags]);
    expect(chip("All").getAttribute("aria-pressed")).toBe("true");
  });

  test("clicking a tag shows only algorithms with that tag", () => {
    chip("Prefix sum").click();
    const expected = algorithms.filter(a => a.tags.includes("Prefix sum")).map(a => a.title).sort();
    expect(cardTitles().sort()).toEqual(expected);
    expect(chip("Prefix sum").getAttribute("aria-pressed")).toBe("true");
    expect(chip("All").getAttribute("aria-pressed")).toBe("false");
    chip("All").click();
    expect(cardTitles()).toHaveLength(algorithms.length);
  });

  test("search matches titles, summaries and tags, ignoring case", () => {
    search("BINARY");
    expect(cardTitles()).toEqual(["Binary Search"]);
    search("halving");
    expect(cardTitles()).toEqual(["Binary Search"]);
    search("prefix sum");
    expect(cardTitles().sort()).toEqual(algorithms.filter(a => a.tags.includes("Prefix sum")).map(a => a.title).sort());
  });

  test("search and tag filters combine", () => {
    chip("Searching").click();
    search("minimum");
    expect(cardTitles()).toEqual([]);
  });

  test("says so when nothing matches", () => {
    search("no such algorithm");
    expect($(".empty").textContent).toContain("No algorithms match");
    expect($("#count").textContent).toBe(`0 of ${algorithms.length} algorithms`);
  });
});
