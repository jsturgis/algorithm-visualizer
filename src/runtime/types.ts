// Shapes shared by the build, the verifier, the problem packages and the browser runtime.

export type ParamType = "int" | "int[]";

/** One argument of the solution's entry function, with its constraints from problem.yaml. */
export interface Param {
  name: string;
  type: ParamType;
  /** Inclusive [min, max] array length (int[] only). */
  length?: [number, number];
  /** Inclusive [min, max] for the value, or for each element of an int[]. */
  value?: [number, number];
}

export type Input = Record<string, unknown>;

/** The judge's per-test limit in the browser is problem.yaml's limits.time_ms × this. Browsers are slower than
 * the machine the limit is set on (like ICPC's time multiplier). */
export const BROWSER_TIME_MULTIPLIER = 3;

/** The TypeScript type for a problem.yaml type. */
export const tsType = (t: ParamType) => (t === "int" ? "number" : "number[]");

/** The entry function every solution must provide: name, parameters and return type, as TypeScript. */
export interface Contract {
  entry: string;
  params: { name: string; type: string }[];
  returns: string;
}

export const contractOf = (meta: Pick<ProblemMeta, "entry" | "input" | "returns">): Contract => ({
  entry: meta.entry,
  params: meta.input.map(p => ({ name: p.name, type: tsType(p.type) })),
  returns: tsType(meta.returns),
});

/** "getAverages(nums: number[], k: number): number[]" */
export const signatureOf = (c: Contract) => `${c.entry}(${c.params.map(p => `${p.name}: ${p.type}`).join(", ")}): ${c.returns}`;

/** One snapshot in a visualization trace. */
export interface Step {
  /** A `// @line <label>` label from the accepted solution; that line is highlighted. */
  line: string;
  /** HTML explaining this step. */
  note: string;
  /** Values for the variable cards, keyed by VarSpec.key. */
  vars?: Record<string, unknown>;
  /** Which variable card to highlight. */
  flash?: string | null;
  /** The algorithm's answer. The last step must set it; the verifier checks it against the solution. */
  result?: unknown;
}

export interface VarSpec {
  key: string;
  label?: string;
  tone?: "low" | "goal" | "curve";
}

/** The page-specific picture for one algorithm (visualization/view.ts). */
export interface View<I = any, S extends Step = any> {
  /** HTML placed in the stage panel. */
  markup: string;
  vars: VarSpec[];
  /** Build the picture for a new input. `root` contains `markup`. */
  setup(root: HTMLElement, input: I): void;
  /** Update the picture for one step. */
  render(step: S): void;
  /** Optional clean-up of user input before validation, e.g. sorting. */
  prepare?(input: I): I;
}

/** The accepted solution as displayed: lines with `// @line` markers removed, and label → 1-based line number. */
export interface Code {
  lines: string[];
  labels: Record<string, number>;
}

export interface ProblemMeta {
  slug: string;
  title: string;
  summary: string;
  explanation: string;
  source?: string;
  tags: string[];
  complexity: { time: string; space: string };
  entry: string;
  limits: { time_ms: number };
  input: Param[];
  /** The entry function's return type. */
  returns: ParamType;
  constraints_note: string[];
  visualization: {
    default: Input;
    limits: Record<string, Pick<Param, "length" | "value">>;
    labels: Record<string, string>;
    code_note?: string;
  };
}

/** Everything a page needs for one algorithm, as produced by the build. */
export interface AlgorithmModule {
  /** The judge's test set; loaded the first time the learner clicks Run tests. */
  loadTestSet(): Promise<{ slug: string; tests: import("../judge/judge.ts").JudgeTest[] }>;
  meta: ProblemMeta;
  code: Code;
  buildTrace(input: any): Step[];
  view: View;
  validate?(input: any): string[];
}
