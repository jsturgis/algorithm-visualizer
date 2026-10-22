// The HTML shell for one algorithm page. The player and the package's view fill in the data-* placeholders.
import { marked } from "marked";
import type { Param } from "../src/runtime/types.ts";
import type { Package } from "./package.ts";

const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => n.toLocaleString("en-US");

function constraintLines(params: Param[]): string[] {
  return params.flatMap(p => {
    const out: string[] = [];
    if (p.length) out.push(`${num(p.length[0])} ≤ ${p.name}.length ≤ ${num(p.length[1])}`);
    if (p.inner_length) out.push(`${num(p.inner_length[0])} ≤ ${p.name}[i].length ≤ ${num(p.inner_length[1])}`);
    const element = p.type === "int[]" ? `${p.name}[i]` : p.type === "int[][]" ? `${p.name}[i][j]` : p.name;
    if (p.value) out.push(`${num(p.value[0])} ≤ ${element} ≤ ${num(p.value[1])}`);
    if (p.chars) out.push(`${p.type === "string[]" ? `Every ${p.name}[i]` : p.name} uses only the characters ${p.chars}`);
    return out;
  });
}

const show = (v: unknown) => JSON.stringify(v).replace(/,/g, ", ");

/** The page's <body> content, without scripts. Tests mount this directly. */
export function renderBody(pkg: Package): string {
  const { meta } = pkg;
  const examples = pkg.samples.map((t, i) => `
      <p><b>Example ${i + 1}</b></p>
      <pre>Input: ${esc(meta.input.map(p => `${p.name} = ${show(t.input[p.name])}`).join(", "))}
Output: ${esc(show(t.answer))}</pre>`).join("");

  // Desktop: a workspace that fills the window — tabs (Problem / Code) on the left, the animation on the
  // right, each scrolling on its own, and the player's controls in a bar along the bottom. Phones stack.
  return `
<div class="wrap workspace-page">
  <nav class="topbar"><a class="brand" href="../../">Algorithms, step by step</a><a href="../../">← All algorithms</a></nav>

  <header class="page-head">
    <h1>${esc(meta.title)}</h1>
    <div class="meta">${meta.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}<span class="tag mono">${esc(meta.complexity.time)} time</span><span class="tag mono">${esc(meta.complexity.space)} space</span></div>
  </header>

  <main class="workspace">
    <section class="pane pane-left" aria-label="Problem and code">
      <div class="tabs" role="tablist" aria-label="Problem and code">
        <button type="button" role="tab" id="tab-problem" data-tab="problem" aria-controls="panel-problem">Problem</button>${pkg.analogy ? `
        <button type="button" role="tab" id="tab-analogy" data-tab="analogy" aria-controls="panel-analogy">Analogy</button>` : ""}
        <button type="button" role="tab" id="tab-code" data-tab="code" aria-controls="panel-code">Code</button>
      </div>
      <div class="tab-panel statement" role="tabpanel" id="panel-problem" data-tab-panel="problem" aria-labelledby="tab-problem">
        <h3>Approach</h3>
        <p>${marked.parseInline(meta.explanation)}</p>
        <h3>Problem</h3>
        ${marked.parse(pkg.statement)}
        <h3>Examples</h3>${examples}
        <h3>Constraints</h3>
        <ul>${[...constraintLines(meta.input), ...meta.constraints_note].map(c => `<li>${marked.parseInline(c)}</li>`).join("")}</ul>
        ${meta.source ? `<p class="source">Source: ${esc(meta.source)}</p>` : ""}
      </div>
${pkg.analogy ? `      <div class="tab-panel statement analogy" role="tabpanel" id="panel-analogy" data-tab-panel="analogy" aria-labelledby="tab-analogy">
        <h3>Analogy</h3>
        ${marked.parse(pkg.analogy)}
      </div>
` : ""}      <div class="tab-panel" role="tabpanel" id="panel-code" data-tab-panel="code" aria-labelledby="tab-code">
        <div data-code></div>
      </div>
    </section>

    <section class="pane pane-right stage" aria-label="Animation">
      <p class="current-line" data-current-line aria-hidden="true"></p>
      <div data-stage></div>
      <p class="note" data-note aria-live="polite"></p>
      <div data-input></div>
    </section>

    <div class="control-bar" data-controls></div>
  </main>
</div>`;
}

export function renderPage(pkg: Package): string {
  const { meta } = pkg;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.summary)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
</head>
<body>${renderBody(pkg)}
<script type="module">import "virtual:algorithm-page/${meta.slug}";</script>
</body>
</html>
`;
}
