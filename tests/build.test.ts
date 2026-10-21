// Builds the site and checks the output is the site only: a page per package, and no source code.
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { build } from "vite";
import { loadPackages, ROOT } from "../build/package.ts";

const OUT = path.join(ROOT, "tests/.tmp/dist");
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(d => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.relative(OUT, path.join(dir, d.name))]));

let files: string[];
beforeAll(async () => {
  await build({ configFile: path.join(ROOT, "vite.config.ts"), logLevel: "silent", build: { outDir: OUT, emptyOutDir: true } });
  files = walk(OUT);
}, 120_000);
afterAll(() => rmSync(OUT, { recursive: true, force: true }));

describe("vite build", () => {
  test("writes the home page and one page per package, but not the template", () => {
    expect(files).toContain("index.html");
    for (const p of loadPackages()) expect(files).toContain(`algorithms/${p.slug}/index.html`);
    expect(files.some(f => f.includes("_template"))).toBe(false);
  });

  test("contains only HTML, CSS and JS", () => {
    expect(files.filter(f => !/\.(html|css|js)$/.test(f))).toEqual([]);
  });

  test("leaves out the source, tests and package data", () => {
    const leaked = files.filter(f => /(^|\/)(problems|tests|build|scripts|src|node_modules)\//.test(f) || /package(-lock)?\.json$/.test(f));
    expect(leaked).toEqual([]);
    expect(files.join("\n")).not.toMatch(/time_limit_exceeded|wrong_answer|brute_force/);
  });

  test("pages load their scripts with relative URLs, so the site works under /algorithm-visualizer/", () => {
    for (const f of files.filter(f => f.endsWith(".html"))) {
      const srcs = [...readFileSync(path.join(OUT, f), "utf8").matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
      for (const s of srcs) expect(s.startsWith("/") && !s.startsWith("//"), `${f}: ${s}`).toBe(false);
    }
  });

  test("each algorithm page's script bundle includes its code listing", () => {
    for (const p of loadPackages()) {
      const html = readFileSync(path.join(OUT, `algorithms/${p.slug}/index.html`), "utf8");
      const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => path.resolve(OUT, `algorithms/${p.slug}`, m[1]));
      expect(scripts.length).toBeGreaterThan(0);
      expect(scripts.every(existsSync)).toBe(true);
      const js = scripts.map(s => readFileSync(s, "utf8")).join("\n");
      expect(js).toContain(JSON.stringify(p.code.lines[0]).slice(1, -1));
    }
  });
});
