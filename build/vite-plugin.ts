// Builds the site from problems/*: writes one HTML page per package into site/algorithms/ (gitignored),
// adds them as build inputs, and provides the generated modules the pages import.
//
//   virtual:algorithms            every package's metadata (home page cards)
//   virtual:algorithm/<slug>      one package: meta, display code, trace, view, validator
//   virtual:algorithm-page/<slug> mounts that package on its page
//   virtual:testset/<slug>        the package's ordered test set for the judge (loaded on first Run tests)
//   virtual:all-algorithms        slug → package, for tests
//   virtual:home                  the home page script (site/ is the server root, so src/ can't be linked directly)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { loadPackages, PROBLEMS, ROOT, type Package } from "./package.ts";
import { renderPage } from "./render.ts";
import { buildTestSet } from "./testset.ts";
import { loadTsLibs } from "./ts-libs.ts";
import { answerFingerprint } from "../src/runtime/answers.ts";

export const SITE = path.join(ROOT, "site");
const RUNTIME = path.join(ROOT, "src/runtime/page.ts");
const HOME = path.join(ROOT, "src/home/home.ts");
const PREFIX = ["virtual:algorithms", "virtual:algorithm/", "virtual:algorithm-page/", "virtual:all-algorithms", "virtual:home", "virtual:testset/"];

const moduleSource = (p: Package) => `
import { buildTrace } from ${JSON.stringify(p.paths.trace)};
import view from ${JSON.stringify(p.paths.view)};
${p.paths.validator ? `import { validate } from ${JSON.stringify(p.paths.validator)};` : "const validate = undefined;"}
export default {
  meta: ${JSON.stringify(p.meta)}, code: ${JSON.stringify(p.code)}, buildTrace, view, validate,
  loadTestSet: () => import("virtual:testset/${p.slug}").then(m => m.default),
};
`;

/**
 * The judge's test set: samples, edge cases and random tests with their inputs and answers; large tests as
 * their generator plus a fingerprint of the answer, so 100,000-element inputs aren't downloaded.
 */
async function testSetSource(p: Package) {
  const tests = await Promise.all((await buildTestSet(p)).map(async t => t.category === "large"
    ? { name: t.name, category: t.category, answerHash: await answerFingerprint(t.answer) }
    : { name: t.name, category: t.category, input: t.input, answer: t.answer }));
  // Shipped as one JSON string (fast to parse, and findable in the build output by its __testset__ key).
  const data = JSON.stringify({ __testset__: p.slug, tests });
  return `import { large } from ${JSON.stringify(p.paths.generators)};
const data = JSON.parse(${JSON.stringify(data)});
export default {
  slug: data.__testset__,
  tests: data.tests.map(t => t.category === "large" ? { ...t, make: large[t.name.slice("large/".length)] } : t),
};
`;
}

/** virtual:ts-libs: the TypeScript standard-library declarations for the in-browser code checker. */
export function tsLibs(): Plugin {
  return {
    name: "ts-libs",
    resolveId: id => (id === "virtual:ts-libs" ? "\0virtual:ts-libs" : undefined),
    load: id => (id === "\0virtual:ts-libs" ? `export default ${JSON.stringify(loadTsLibs())};` : undefined),
  };
}

export function algorithms(): Plugin {
  let packages: Package[] = [];
  const find = (slug: string) => {
    const p = packages.find(p => p.slug === slug);
    if (!p) throw new Error(`No problem package "${slug}"`);
    return p;
  };

  return {
    name: "algorithms",

    config() {
      packages = loadPackages();
      const outDir = path.join(SITE, "algorithms");
      rmSync(outDir, { recursive: true, force: true });
      const input: Record<string, string> = { index: path.join(SITE, "index.html") };
      for (const p of packages) {
        const file = path.join(outDir, p.slug, "index.html");
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, renderPage(p));
        input[p.slug] = file;
      }
      return { build: { rolldownOptions: { input } } };
    },

    resolveId(id) {
      if (PREFIX.some(prefix => id.startsWith(prefix))) return "\0" + id;
    },

    async load(id) {
      if (!id.startsWith("\0virtual:")) return;
      const name = id.slice("\0".length);
      if (name === "virtual:home") return `import ${JSON.stringify(HOME)};`;
      if (name === "virtual:algorithms") return `export default ${JSON.stringify(packages.map(p => p.meta))};`;
      if (name === "virtual:all-algorithms") {
        return packages.map((p, i) => `import m${i} from "virtual:algorithm/${p.slug}";`).join("\n") +
          `\nexport default { ${packages.map((p, i) => `${JSON.stringify(p.slug)}: m${i}`).join(", ")} };`;
      }
      if (name.startsWith("virtual:testset/")) return testSetSource(find(name.slice("virtual:testset/".length)));
      if (name.startsWith("virtual:algorithm/")) return moduleSource(find(name.slice("virtual:algorithm/".length)));
      if (name.startsWith("virtual:algorithm-page/")) {
        const slug = name.slice("virtual:algorithm-page/".length);
        find(slug);
        return `import mod from "virtual:algorithm/${slug}";
import { mountAlgorithm } from ${JSON.stringify(RUNTIME)};
mountAlgorithm(mod);`;
      }
    },

    configureServer(server) {
      // problem.yaml, statements and samples are read at startup; restart the dev server when they change.
      server.watcher.add(PROBLEMS);
      server.watcher.on("change", file => {
        if (file.startsWith(PROBLEMS) && /\.(ya?ml|md|in|ans)$/.test(file) || file.endsWith("solution.ts")) server.restart();
      });
    },
  };
}
