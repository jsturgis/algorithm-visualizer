// Reads a problem package (problems/<slug>/), ICPC problem-package style:
//
//   problem.yaml                          metadata, constraints, visualization settings
//   problem_statement/statement.md
//   data/sample/*.in, *.ans               examples (JSON): input object / expected answer
//   data/invalid_input/*.in               inputs the validator must reject
//   generators/generators.ts              `random` (fast-check arbitrary), `edge`, `large`
//   input_validators/validate.ts          optional checks beyond problem.yaml's ranges
//   submissions/accepted/solution.ts      the displayed solution (plus any other accepted ones)
//   submissions/time_limit_exceeded/*.ts  correct but slow (brute force): the test oracle
//   submissions/wrong_answer/*.ts         must fail at least one test
//   visualization/trace.ts, view.ts       the page
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { Code, Input, ProblemMeta } from "../src/runtime/types.ts";
import { toDisplayCode } from "./code.ts";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PROBLEMS = path.join(ROOT, "problems");

const Range = z.tuple([z.number(), z.number()]).refine(([lo, hi]) => lo <= hi, "range must be [min, max]");
const Param = z.strictObject({
  name: z.string().regex(/^[A-Za-z_]\w*$/),
  type: z.enum(["int", "int[]"]),
  length: Range.optional(),
  value: Range.optional(),
});

const MetaSchema = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1),
  explanation: z.string().min(1),
  source: z.string().optional(),
  tags: z.array(z.string()).min(1),
  complexity: z.strictObject({ time: z.string(), space: z.string() }),
  entry: z.string().regex(/^[A-Za-z_]\w*$/),
  limits: z.strictObject({ time_ms: z.number().positive() }).default({ time_ms: 1000 }),
  input: z.array(Param).min(1),
  constraints_note: z.array(z.string()).default([]),
  visualization: z.strictObject({
    default: z.record(z.string(), z.unknown()),
    limits: z.record(z.string(), Param.pick({ length: true, value: true }).strict()).default({}),
    labels: z.record(z.string(), z.string()).default({}),
    code_note: z.string().optional(),
  }),
});

export interface TestCase {
  name: string;
  input: Input;
  answer?: unknown;
}

export interface Package {
  slug: string;
  dir: string;
  meta: ProblemMeta;
  statement: string;
  samples: TestCase[];
  invalid: TestCase[];
  code: Code;
  paths: {
    generators: string;
    validator?: string;
    trace: string;
    view: string;
    accepted: string[];
    timeLimitExceeded: string[];
    wrongAnswer: string[];
  };
}

const byName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
const files = (dir: string, ext: string) =>
  existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(ext)).sort(byName).map(f => path.join(dir, f)) : [];
const json = (file: string) => {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { throw new Error(`${path.relative(ROOT, file)}: ${(e as Error).message}`); }
};
const required = (file: string) => {
  if (!existsSync(file)) throw new Error(`Missing ${path.relative(ROOT, file)}`);
  return file;
};

export function loadPackage(dir: string): Package {
  const slug = path.basename(dir);
  const rel = (p: string) => path.join(dir, p);

  const parsed = MetaSchema.safeParse(parseYaml(readFileSync(required(rel("problem.yaml")), "utf8")));
  if (!parsed.success) {
    throw new Error(`${slug}/problem.yaml: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const meta: ProblemMeta = { slug, ...parsed.data };
  for (const name of Object.keys(meta.visualization.limits)) {
    if (!meta.input.some(p => p.name === name)) throw new Error(`${slug}/problem.yaml: visualization.limits.${name} is not an input`);
  }

  const samples = files(rel("data/sample"), ".in").map(f => ({
    name: `sample/${path.basename(f, ".in")}`,
    input: json(f),
    answer: json(required(f.replace(/\.in$/, ".ans"))),
  }));
  if (!samples.length) throw new Error(`${slug}: data/sample has no tests`);

  const solution = required(rel("submissions/accepted/solution.ts"));
  const validator = rel("input_validators/validate.ts");

  return {
    slug,
    dir,
    meta,
    statement: readFileSync(required(rel("problem_statement/statement.md")), "utf8"),
    samples,
    invalid: files(rel("data/invalid_input"), ".in").map(f => ({ name: `invalid_input/${path.basename(f, ".in")}`, input: json(f) })),
    code: toDisplayCode(readFileSync(solution, "utf8")),
    paths: {
      generators: required(rel("generators/generators.ts")),
      validator: existsSync(validator) ? validator : undefined,
      trace: required(rel("visualization/trace.ts")),
      view: required(rel("visualization/view.ts")),
      accepted: files(rel("submissions/accepted"), ".ts"),
      timeLimitExceeded: files(rel("submissions/time_limit_exceeded"), ".ts"),
      wrongAnswer: files(rel("submissions/wrong_answer"), ".ts"),
    },
  };
}

/** Package folders. Folders starting with "_" (the template) are skipped unless asked for. */
export function packageDirs({ templates = false, root = PROBLEMS } = {}): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && (templates || !d.name.startsWith("_")))
    .map(d => path.join(root, d.name))
    .sort(byName);
}

export const loadPackages = (opts?: { templates?: boolean }) => packageDirs(opts).map(loadPackage);
