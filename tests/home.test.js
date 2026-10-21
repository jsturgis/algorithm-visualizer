import { describe, test, expect, beforeEach } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { loadPage, registry, ROOT } from "./helpers.js";

const algorithms = registry();
const cardTitles = p => p.$$(".card h2").map(h => h.textContent);
const search = (p, text) => {
  const q = p.$("#q");
  q.value = text;
  q.dispatchEvent(new p.window.Event("input"));
};
const chip = (p, tag) => p.$$(".chip").find(c => c.dataset.tag === tag);

describe("algorithms.js", () => {
  test("every entry has the fields the home page needs", () => {
    for (const a of algorithms) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(a.title).toBeTruthy();
      expect(a.summary).toBeTruthy();
      expect(a.tags.length).toBeGreaterThan(0);
    }
  });

  test("slugs are unique", () => {
    const slugs = algorithms.map(a => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every entry has a page, and every page has an entry", () => {
    for (const a of algorithms) {
      expect(existsSync(path.join(ROOT, "algorithms", a.slug, "index.html")), a.slug).toBe(true);
    }
    const folders = readdirSync(path.join(ROOT, "algorithms"), { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith("_")).map(d => d.name);
    expect(folders.sort()).toEqual(algorithms.map(a => a.slug).sort());
  });
});

describe("home page", () => {
  let p;
  beforeEach(async () => { p = await loadPage("index.html"); });

  test("loads without script errors", () => {
    expect(p.errors).toEqual([]);
  });

  test("shows a card for every algorithm, alphabetically", () => {
    const titles = algorithms.map(a => a.title).sort((a, b) => a.localeCompare(b));
    expect(cardTitles(p)).toEqual(titles);
    expect(p.$("#count").textContent).toBe(`${algorithms.length} of ${algorithms.length} algorithms`);
  });

  test("each card links to its algorithm's folder", () => {
    for (const a of algorithms) {
      const card = p.$$(".card").find(c => c.querySelector("h2").textContent === a.title);
      expect(card.getAttribute("href")).toBe(`algorithms/${a.slug}/`);
    }
  });

  test("has a chip for All plus every tag", () => {
    const tags = [...new Set(algorithms.flatMap(a => a.tags))].sort();
    expect(p.$$(".chip").map(c => c.dataset.tag)).toEqual(["All", ...tags]);
    expect(chip(p, "All").getAttribute("aria-pressed")).toBe("true");
  });

  test("clicking a tag shows only algorithms with that tag", () => {
    const tag = "Prefix sum";
    chip(p, tag).click();
    const expected = algorithms.filter(a => a.tags.includes(tag)).map(a => a.title).sort();
    expect(cardTitles(p).sort()).toEqual(expected);
    expect(chip(p, tag).getAttribute("aria-pressed")).toBe("true");
    expect(chip(p, "All").getAttribute("aria-pressed")).toBe("false");

    chip(p, "All").click();
    expect(cardTitles(p)).toHaveLength(algorithms.length);
  });

  test("search matches titles, summaries and tags, ignoring case", () => {
    search(p, "BINARY");
    expect(cardTitles(p)).toEqual(["Binary Search"]);
    search(p, "halving");
    expect(cardTitles(p)).toEqual(["Binary Search"]);
    search(p, "prefix sum");
    expect(cardTitles(p).sort()).toEqual(algorithms.filter(a => a.tags.includes("Prefix sum")).map(a => a.title).sort());
  });

  test("search and tag filters combine", () => {
    chip(p, "Searching").click();
    search(p, "minimum");
    expect(cardTitles(p)).toEqual([]);
  });

  test("says so when nothing matches", () => {
    search(p, "no such algorithm");
    expect(cardTitles(p)).toEqual([]);
    expect(p.$(".empty").textContent).toContain("No algorithms match");
    expect(p.$("#count").textContent).toBe(`0 of ${algorithms.length} algorithms`);
  });
});
