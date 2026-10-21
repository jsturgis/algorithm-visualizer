// Builds the site and checks the output is the site only: a page per package, and no source code.
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { build } from "vite";
import { loadPackages, ROOT } from "../build/package.ts";
import { loadSuite } from "../build/verify.ts";
import { answerFingerprint } from "../src/runtime/answers.ts";

const OUT = path.join(ROOT, "tests/.tmp/dist");
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(d => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.relative(OUT, path.join(dir, d.name))]));

let files: string[];
beforeAll(async () => {
  await build({ configFile: path.join(ROOT, "vite.config.ts"), logLevel: "silent", build: { outDir: OUT, emptyOutDir: true } });
  files = walk(OUT);
}, 120_000);
afterAll(() => rmSync(OUT, { recursive: true, force: true }));

const read = (f: string) => readFileSync(path.join(OUT, f), "utf8");
/** A script and everything it statically imports (not dynamic import()), as paths under OUT. */
function closure(start: string[]): string[] {
  const queue = [...start];
  const seen = new Set<string>();
  while (queue.length) {
    const f = path.normalize(queue.pop()!);
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of read(f).matchAll(/(?:^|[;}\s])import\s*(?:[\w$*{},\s]+from\s*)?["']([^"']+\.js)["']/g)) {
      queue.push(path.join(path.dirname(f), m[1]));
    }
  }
  return [...seen];
}
/** Everything a page loads before the learner clicks anything: its scripts and their static imports. */
const initial = (html: string) => closure([...read(html).matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(m => path.join(path.dirname(html), m[1])));

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

  test("the editor and the type checker are only loaded on demand", () => {
    const LANGUAGE_SERVICE = "createLanguageService", EDITOR = "cm-gutters";

    for (const html of files.filter(f => f.endsWith(".html"))) {
      for (const f of initial(html)) {
        expect(read(f).includes(LANGUAGE_SERVICE), `${html} loads ${f}`).toBe(false);
        expect(read(f).includes(EDITOR), `${html} loads ${f}`).toBe(false);
      }
    }
    const js = files.filter(f => f.endsWith(".js"));
    expect(js.filter(f => read(f).includes(LANGUAGE_SERVICE))).toEqual([expect.stringMatching(/checker\.worker-.*\.js$/)]);
    expect(js.some(f => /editor-.*\.js$/.test(f) && read(f).includes(EDITOR))).toBe(true);
  });

  // The judge's verdict renderer and each package's test set (tagged __testset__ by the build).
  const JUDGE = "Time Limit Exceeded", TEST_SET = "__testset__";

  test("every package ships a test set identical to the verifier's: same tests, order and answers", async () => {
    const chunks = files.filter(f => f.endsWith(".js") && read(f).includes(TEST_SET));
    for (const p of loadPackages()) {
      // The test set is one JSON string literal inside its chunk.
      const shipped = chunks.map(f => read(f).match(/JSON\.parse\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\)/))
        .filter(m => m).map(m => JSON.parse(new Function(`return ${m![1]}`)()))
        .find(d => d[TEST_SET] === p.slug);
      expect(shipped, p.slug).toBeDefined();
      const suite = await loadSuite(p);
      expect(shipped.tests.map((t: { name: string }) => t.name)).toEqual([...suite.corpus.map(t => t.name), ...suite.large.map(t => t.name)]);
      for (const [i, t] of suite.corpus.entries()) {
        expect(shipped.tests[i]).toEqual({ name: t.name, category: t.category, input: t.input, answer: suite.expected(t) });
      }
      for (const [i, t] of suite.large.entries()) {
        const s = shipped.tests[suite.corpus.length + i];
        expect(s).toEqual({ name: t.name, category: "large", answerHash: await answerFingerprint(suite.solution.run(t.make())) });
      }
    }
  });

  test("the judge and the test sets are only loaded on Run tests, not with the page or the editor", () => {
    const editorChunks = files.filter(f => /editor-.*\.js$/.test(f));
    expect(editorChunks.length).toBeGreaterThan(0);
    const preloaded = [...files.filter(f => f.endsWith(".html")).flatMap(initial), ...closure(editorChunks)];
    for (const f of preloaded) {
      expect(read(f).includes(JUDGE), f).toBe(false);
      expect(read(f).includes(TEST_SET), f).toBe(false);
      expect(/fast-check/.test(f), f).toBe(false);
    }
    expect(files.some(f => f.endsWith(".js") && read(f).includes(JUDGE))).toBe(true);
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
