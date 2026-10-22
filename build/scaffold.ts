// Writes a new problem package (problems/<slug>/) from its contract: `npm run new`.
//
// Every file agrees with the contract (entry function, parameters, return type), so the package loads and passes
// the structural checks straight away. The submissions and the trace are stubs that throw or return a placeholder,
// so the package fails verification until the algorithm is written: a scaffold can never pass CI by accident.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Document } from "yaml";
import { checkInput, withLimits } from "../src/runtime/constraints.ts";
import { tsType, type Input, type Param, type ParamType, type ReturnType } from "../src/runtime/types.ts";
import { toDisplayCode } from "./code.ts";
import { MetaSchema, PROBLEMS, ROOT } from "./package.ts";

export interface PackageSpec {
  slug: string;
  title: string;
  summary?: string;
  tags?: string[];
  source?: string;
  entry: string;
  input: Param[];
  returns: ReturnType;
  complexity?: { time: string; space: string };
  time_ms?: number;
  /** Constraints that aren't ranges, as sentences. Enforce them in input_validators/validate.ts. */
  constraints_note?: string[];
  /** Also write input_validators/validate.ts. */
  validator?: boolean;
  /** problem_statement/statement.md (Markdown). */
  statement?: string;
  /** The page intro (Markdown). */
  explanation?: string;
  /** Examples for data/sample/. The first one that fits the page is the visualization's default input. */
  samples?: { input: Input; answer: unknown }[];
  /** The accepted solution (TypeScript). Lines without a `// @line` label get one. */
  solution?: string;
  /** A correct but slow solution (TypeScript): the oracle for the random tests. */
  bruteForce?: string;
  /** Code to port, in another language, shown in a comment above the solution stub. */
  reference?: { language: string; code: string };
}

type Range = [number, number];

// The template's defaults, for constraints the spec leaves out.
export const DEFAULT_LENGTH: Range = [1, 100_000];
export const DEFAULT_VALUE: Range = [-1_000_000, 1_000_000];
export const DEFAULT_INNER: Range = [1, 10];
export const DEFAULT_CHARS = "[a-z]";
export const DEFAULT_TIME_MS = 1000;
/** The page's custom input is capped at this length, so the picture fits. */
const PAGE_LENGTH: Range = [1, 12];
const PAGE_INNER: Range = [1, 6];
const PATTERN = [3, 1, 4, 1, 5, 9, 2, 6];

const clamp = (n: number, [lo, hi]: Range) => Math.min(hi, Math.max(lo, n));
const within = (r: Range, cap: Range): Range => [clamp(r[0], cap), clamp(Math.min(r[1], cap[1]), [r[0], r[1]])];

/** What the scaffold writes for one parameter type. Every value is a JS expression or a JSON-able value. */
interface Kind {
  /** Fills in the constraints the spec left out. */
  complete(p: Param): Param;
  /** The page's tighter limit for the custom input, if any. */
  page?(p: Param): { length: Range; inner_length?: Range };
  /** A fast-check arbitrary for small inputs, as source code. */
  arbitrary(p: Param): string;
  smallest(p: Param): unknown;
  /** A small, valid input that fits the page. */
  example(p: Param): unknown;
  /** Source for a maximum-size value. */
  largest(p: Param): string;
  /** Named values that break the constraints. */
  invalid(p: Param): Record<string, unknown>;
}

const ints = (p: Param, length: number, from = 0) =>
  Array.from({ length }, (_, i) => clamp(PATTERN[(from + i) % PATTERN.length], p.value!));
const grid = (p: Param, length: number, inner: number) => Array.from({ length }, (_, i) => ints(p, inner, i));

/** The printable ASCII characters `chars` allows, and the first one it doesn't (for an invalid input). */
function alphabet(chars: string) {
  const all = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
  const ok = (c: string) => new RegExp(`^${chars}$`, "u").test(c);
  const allowed = all.filter(ok);
  if (!allowed.length) throw new Error(`chars ${chars} allows no printable character`);
  return { allowed, banned: all.find(c => !ok(c) && c !== " ") };
}
const text = (chars: string, length: number, from = 0) => {
  const { allowed } = alphabet(chars);
  return Array.from({ length }, (_, i) => allowed[(from + i) % allowed.length]).join("");
};
const fcChars = (chars: string) => `fc.constantFrom(...${JSON.stringify(alphabet(chars).allowed.join(""))})`;

const KINDS: Record<ParamType, Kind> = {
  int: {
    complete: p => ({ ...p, value: p.value ?? DEFAULT_VALUE }),
    arbitrary: p => `fc.integer({ min: ${p.value![0]}, max: ${p.value![1]} })`,
    smallest: p => p.value![0],
    example: p => clamp(3, p.value!),
    largest: p => `${p.value![1]}`,
    invalid: p => ({ [`${p.name}_too_big`]: p.value![1] + 1, [`${p.name}_not_a_number`]: "1" }),
  },
  "int[]": {
    complete: p => ({ ...p, length: p.length ?? DEFAULT_LENGTH, value: p.value ?? DEFAULT_VALUE }),
    page: p => ({ length: within(p.length!, PAGE_LENGTH) }),
    arbitrary: p => {
      const [lo, hi] = within(p.length!, PAGE_LENGTH);
      return `fc.array(fc.integer({ min: ${p.value![0]}, max: ${p.value![1]} }), { minLength: ${lo}, maxLength: ${hi} })`;
    },
    smallest: p => ints(p, p.length![0]),
    example: p => ints(p, clamp(5, within(p.length!, PAGE_LENGTH))),
    largest: p => {
      const [lo, hi] = p.value!;
      return `Array.from({ length: ${p.length![1]} }, (_, i) => ${lo} + (i * 7919) % ${hi - lo + 1})`;
    },
    invalid: p => {
      const out: Record<string, unknown> = {};
      if (p.length![0] > 0) out[`${p.name}_empty`] = [];
      const n = Math.max(p.length![0], 1);
      if (n <= p.length![1]) out[`${p.name}_number_too_big`] = [p.value![1] + 1, ...ints(p, n - 1)];
      return out;
    },
  },
  "int[][]": {
    complete: p => ({ ...p, length: p.length ?? DEFAULT_LENGTH, inner_length: p.inner_length ?? DEFAULT_INNER, value: p.value ?? DEFAULT_VALUE }),
    page: p => ({ length: within(p.length!, PAGE_LENGTH), inner_length: within(p.inner_length!, PAGE_INNER) }),
    arbitrary: p => {
      const [lo, hi] = within(p.length!, PAGE_LENGTH), [ilo, ihi] = within(p.inner_length!, PAGE_INNER);
      const inner = `fc.array(fc.integer({ min: ${p.value![0]}, max: ${p.value![1]} }), { minLength: ${ilo}, maxLength: ${ihi} })`;
      return `fc.array(${inner}, { minLength: ${lo}, maxLength: ${hi} })`;
    },
    smallest: p => grid(p, p.length![0], p.inner_length![0]),
    example: p => grid(p, clamp(3, within(p.length!, PAGE_LENGTH)), clamp(2, within(p.inner_length!, PAGE_INNER))),
    largest: p => {
      const [lo, hi] = p.value!;
      return `Array.from({ length: ${p.length![1]} }, (_, i) => Array.from({ length: ${p.inner_length![0]} }, (_, j) => ${lo} + (i * 7919 + j) % ${hi - lo + 1}))`;
    },
    invalid: p => {
      const out: Record<string, unknown> = {};
      if (p.length![0] > 0) out[`${p.name}_empty`] = [];
      const n = Math.max(p.length![0], 1), inner = Math.max(p.inner_length![0], 1);
      if (n <= p.length![1] && inner <= p.inner_length![1]) {
        const rows = grid(p, n, inner);
        rows[0][0] = p.value![1] + 1;
        out[`${p.name}_number_too_big`] = rows;
      }
      if (p.inner_length![1] < 100) out[`${p.name}_entry_too_long`] = grid(p, n, p.inner_length![1] + 1);
      return out;
    },
  },
  string: {
    complete: p => ({ ...p, length: p.length ?? DEFAULT_LENGTH, chars: p.chars ?? DEFAULT_CHARS }),
    page: p => ({ length: within(p.length!, PAGE_LENGTH) }),
    arbitrary: p => {
      const [lo, hi] = within(p.length!, PAGE_LENGTH);
      return `fc.string({ unit: ${fcChars(p.chars!)}, minLength: ${lo}, maxLength: ${hi} })`;
    },
    smallest: p => text(p.chars!, p.length![0]),
    example: p => text(p.chars!, clamp(5, within(p.length!, PAGE_LENGTH))),
    largest: p => `${JSON.stringify(alphabet(p.chars!).allowed.join(""))}.repeat(${p.length![1]}).slice(0, ${p.length![1]})`,
    invalid: p => {
      const out: Record<string, unknown> = {};
      if (p.length![0] > 0) out[`${p.name}_empty`] = "";
      const { banned } = alphabet(p.chars!);
      const n = Math.max(p.length![0], 1);
      if (banned && n <= p.length![1]) out[`${p.name}_bad_character`] = banned + text(p.chars!, n - 1);
      return out;
    },
  },
  "string[]": {
    complete: p => ({ ...p, length: p.length ?? DEFAULT_LENGTH, inner_length: p.inner_length ?? DEFAULT_INNER, chars: p.chars ?? DEFAULT_CHARS }),
    page: p => ({ length: within(p.length!, PAGE_LENGTH), inner_length: within(p.inner_length!, PAGE_INNER) }),
    arbitrary: p => {
      const [lo, hi] = within(p.length!, PAGE_LENGTH), [ilo, ihi] = within(p.inner_length!, PAGE_INNER);
      return `fc.array(fc.string({ unit: ${fcChars(p.chars!)}, minLength: ${ilo}, maxLength: ${ihi} }), { minLength: ${lo}, maxLength: ${hi} })`;
    },
    smallest: p => Array.from({ length: p.length![0] }, (_, i) => text(p.chars!, p.inner_length![0], i)),
    example: p => Array.from({ length: clamp(5, within(p.length!, PAGE_LENGTH)) }, (_, i) =>
      text(p.chars!, clamp(2, within(p.inner_length!, PAGE_INNER)), i)),
    largest: p => {
      const alpha = JSON.stringify(alphabet(p.chars!).allowed.join(""));
      return `Array.from({ length: ${p.length![1]} }, (_, i) => ${alpha}[i % ${alpha}.length].repeat(${p.inner_length![0]}))`;
    },
    invalid: p => {
      const out: Record<string, unknown> = {};
      if (p.length![0] > 0) out[`${p.name}_empty`] = [];
      const { banned } = alphabet(p.chars!);
      const n = Math.max(p.length![0], 1), inner = Math.max(p.inner_length![0], 1);
      if (banned && n <= p.length![1] && inner <= p.inner_length![1]) {
        out[`${p.name}_bad_character`] = Array.from({ length: n }, (_, i) => (i ? text(p.chars!, inner, i) : banned + text(p.chars!, inner - 1)));
      }
      return out;
    },
  },
};

const kind = (t: ParamType) => KINDS[t];

const json = (v: unknown) => JSON.stringify(v) + "\n";
const obj = (entries: [string, string][]) => `{ ${entries.map(([k, v]) => `${k}: ${v}`).join(", ")} }`;
// Lines the verifier lets go without a label: braces, `} else {`, comments and blank lines (see build/verify.ts).
const STRUCTURAL = /^\s*(\{|\}|\}\s*else\s*\{|\/\/.*)?\s*$/;
const MARKER = /\/\/\s*@line\s+[\w-]+\s*$/;

/** `code` as an exported module, with a `// @line l<n>` label on every line after the signature that needs one. */
function labelled(code: string) {
  return code.replace(/\r\n/g, "\n").trim().split("\n").map((line, i) => {
    if (i === 0) return line.replace(/^(?!export )(?=function )/, "export ");
    return STRUCTURAL.test(line) || MARKER.test(line) ? line : `${line} // @line l${i + 1}`;
  }).join("\n") + "\n";
}
const exported = (code: string) => code.replace(/\r\n/g, "\n").trim().replace(/^(?!export )(?=function )/m, "export ") + "\n";
const comment = (code: string) => code.trimEnd().split("\n").map(l => `// ${l}`.trimEnd()).join("\n");

const pascal = (s: string) => s.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Every file of the package, path → contents. */
function render(spec: PackageSpec, dir: string): Record<string, string> {
  const input = spec.input.map(p => kind(p.type).complete(p));
  const sig = `${spec.entry}(${input.map(p => `${p.name}: ${tsType(p.type)}`).join(", ")}): ${tsType(spec.returns)}`;
  const inputOf = (f: (p: Param) => unknown) => Object.fromEntries(input.map(p => [p.name, f(p)]));
  const example = inputOf(p => kind(p.type).example(p));
  const src = path.relative(path.join(dir, "visualization"), path.join(ROOT, "src"));
  const stepType = `${pascal(spec.entry)}Step`;
  const inputType = `{ ${input.map(p => `${p.name}: ${tsType(p.type)}`).join("; ")} }`;
  const todo = (file: string) => `throw new Error("TODO: write ${file}");`;

  const limits = Object.fromEntries(input.flatMap(p => (kind(p.type).page ? [[p.name, kind(p.type).page!(p)]] : [])));
  const samples = spec.samples?.length ? spec.samples : [{ input: example, answer: null }];
  const fits = samples.find(s => !checkInput(s.input, withLimits(input, limits)).length);
  const meta = {
    title: spec.title,
    summary: spec.summary ?? `TODO: one line on how ${spec.title} works.`,
    explanation: spec.explanation ?? `TODO: explain the approach. Markdown allowed.`,
    ...(spec.source ? { source: spec.source } : {}),
    tags: spec.tags?.length ? spec.tags : ["TODO"],
    complexity: spec.complexity ?? { time: "O(n)", space: "O(1)" },
    entry: spec.entry,
    limits: { time_ms: spec.time_ms ?? DEFAULT_TIME_MS },
    input,
    returns: spec.returns,
    constraints_note: spec.constraints_note ?? [],
    visualization: { default: fits?.input ?? example, limits, labels: {} },
  };
  const parsed = MetaSchema.safeParse(meta);
  if (!parsed.success) throw new Error(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));

  const doc = new Document(meta, { aliasDuplicateObjects: false });
  for (const key of [["tags"], ["complexity"], ["limits"], ["visualization", "default"], ...input.map((_, i) => ["input", i])]) {
    (doc.getIn(key, true) as { flow: boolean }).flow = true;
  }
  for (const name of Object.keys(limits)) (doc.getIn(["visualization", "limits", name], true) as { flow: boolean }).flow = true;

  const invalid = input.flatMap(p => Object.entries(kind(p.type).invalid(p)).map(([name, v]) => [name, { ...example, [p.name]: v }] as const));
  const params = input.map(p => p.name).join(", ");
  const label = spec.solution ? Object.keys(toDisplayCode(labelled(spec.solution)).labels)[0] ?? "todo" : "todo";

  return {
    "problem.yaml": doc.toString({ lineWidth: 0, flowCollectionPadding: false }),
    "problem_statement/statement.md": spec.statement?.trim()
      ? spec.statement.trim() + "\n"
      : `TODO: Given ${input.map(p => `\`${p.name}\``).join(" and ")}, return ... (\`${spec.returns}\`).\n`,
    ...Object.fromEntries(samples.flatMap((s, i) => [[`data/sample/${i + 1}.in`, json(s.input)], [`data/sample/${i + 1}.ans`, json(s.answer)]])),
    ...Object.fromEntries(invalid.map(([name, v]) => [`data/invalid_input/${name}.in`, json(v)])),
    ...(spec.validator ? {
      "input_validators/validate.ts": [
        `// Constraints problem.yaml can't express as ranges${spec.constraints_note?.length ? `: ${spec.constraints_note.join(" ")}` : "."}`,
        `// Return a message for each one \`input\` breaks.`,
        `export function validate(input: ${inputType}): string[] {`,
        `  // TODO: write input_validators/validate.ts`,
        `  return [];`,
        `}`,
        ``,
      ].join("\n"),
    } : {}),
    "generators/generators.ts": [
      `// \`random\`: a fast-check arbitrary for small inputs (seeded random tests + the property test against the brute force).`,
      `// \`edge\`: named cases you want checked every time. \`large\`: maximum-size inputs for the time limit.`,
      `import fc from "fast-check";`,
      ``,
      `export const random = fc.record({`,
      ...input.map(p => `  ${p.name}: ${kind(p.type).arbitrary(p)},`),
      `});`,
      ``,
      `export const edge = {`,
      `  smallest: ${JSON.stringify(inputOf(p => kind(p.type).smallest(p)))},`,
      `};`,
      ``,
      `export const large = {`,
      `  largest: () => (${obj(input.map(p => [p.name, kind(p.type).largest(p)]))}),`,
      `};`,
      ``,
    ].join("\n"),
    "submissions/accepted/solution.ts": spec.solution ? labelled(spec.solution) : [
      ...(spec.reference ? [`// TODO: port this ${spec.reference.language} solution, then delete this comment.`, comment(spec.reference.code)] : []),
      `export function ${sig} {`,
      `  ${todo("submissions/accepted/solution.ts")} // @line todo`,
      `}`,
      ``,
    ].join("\n"),
    "submissions/time_limit_exceeded/brute_force.ts": spec.bruteForce
      ? `// Correct but slow: the oracle for the random tests.\n${exported(spec.bruteForce)}`
      : [
      `// TODO: a correct but slow (brute force) solution. It's the oracle for the random tests.`,
      `export function ${sig} {`,
      `  ${todo("submissions/time_limit_exceeded/brute_force.ts")}`,
      `}`,
      ``,
    ].join("\n"),
    "submissions/wrong_answer/todo.ts": [
      `// TODO: a realistic bug the tests must catch. Rename this file after the bug, and say what it is here.`,
      `export function ${sig} {`,
      `  ${todo("submissions/wrong_answer/todo.ts")}`,
      `}`,
      ``,
    ].join("\n"),
    "visualization/trace.ts": [
      `// Run the algorithm once and record a snapshot per step.`,
      `// \`line\` is a \`// @line\` label from submissions/accepted/solution.ts; the last step must set \`result\`.`,
      `// \`vars\` fills the variable cards, \`flash\` highlights one; any other fields are yours to use in view.ts.`,
      `import type { Step } from "${src}/runtime/types.ts";`,
      ``,
      `export interface Input ${inputType}`,
      `export interface ${stepType} extends Step {}`,
      ``,
      `export function buildTrace({ ${params} }: Input): ${stepType}[] {`,
      `  // TODO: write visualization/trace.ts`,
      `  return [`,
      `    { line: "${label}", note: "TODO: write visualization/trace.ts", vars: { ${params} } },`,
      `    { line: "${label}", note: "TODO: the last step sets <b>result</b>.", result: null },`,
      `  ];`,
      `}`,
      ``,
    ].join("\n"),
    "visualization/view.ts": [
      `// The picture: \`markup\` goes in the stage panel, \`setup\` builds it for an input, \`render\` updates it per step.`,
      `import { drawStrip } from "${src}/runtime/strip.ts";`,
      `import type { View } from "${src}/runtime/types.ts";`,
      `import type { Input, ${stepType} } from "./trace.ts";`,
      ``,
      `let root: HTMLElement;`,
      `let input: Input;`,
      ``,
      `const view: View<Input, ${stepType}> = {`,
      `  markup: \``,
      `    <div>`,
      ...input.filter(p => p.type.endsWith("]")).map(p =>
        `      <p class="label">${p.name}</p><div class="strip-scroll"><div class="strip" id="${p.name}"></div></div>`),
      `    </div>\`,`,
      ``,
      `  vars: [${input.map(p => `{ key: "${p.name}" }`).join(", ")}],`,
      ``,
      `  setup(el, inp) {`,
      `    root = el;`,
      `    input = inp;`,
      `  },`,
      ``,
      `  // TODO: draw each step.`,
      `  render() {`,
      ...input.filter(p => p.type.endsWith("]")).map(p =>
        `    drawStrip(root.querySelector<HTMLElement>("#${p.name}")!, { values: [...input.${p.name}] });`),
      `  },`,
      `};`,
      ``,
      `export default view;`,
      ``,
    ].join("\n"),
  };
}

/** Throws unless `slug` is lowercase kebab-case. A leading "_" (a template, left off the site) only when asked for. */
export function checkSlug(slug: string, { template = false } = {}) {
  const body = template ? slug.replace(/^_/, "") : slug;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(body)) {
    throw new Error(`slug "${slug}" must be lowercase words separated by hyphens, like "binary-search"`);
  }
}

/** Write problems/<slug>/ (under `root`) from `spec`. Nothing is written if the spec is invalid. Returns the paths written. */
export function newPackage(
  spec: PackageSpec,
  { root = PROBLEMS, template = false, dryRun = false }: { root?: string; template?: boolean; dryRun?: boolean } = {},
): string[] {
  checkSlug(spec.slug, { template });
  const dir = path.join(root, spec.slug);
  if (existsSync(dir)) throw new Error(`${path.relative(ROOT, dir)} already exists`);
  const files = render(spec, dir);
  if (!dryRun) for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  return Object.keys(files).map(rel => path.join(dir, rel));
}
