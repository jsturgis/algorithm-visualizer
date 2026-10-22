// The `npm run new` wizard: asks for a package's contract one question at a time, optionally starting from a LeetCode
// problem, and returns the spec for newPackage(). It only talks through a Prompter, so it can be driven by a terminal
// (scripts/new.ts), by defaults alone (--yes), or by a script in tests.
import { PARAM_TYPES, RETURN_TYPES, type Param, type ParamType, type ReturnType } from "../src/runtime/types.ts";
import { fromLeetCode, type LeetCodeData, type LeetCodeImport, type Solution } from "./leetcode.ts";
import { checkSlug, DEFAULT_CHARS, DEFAULT_INNER, DEFAULT_LENGTH, DEFAULT_TIME_MS, DEFAULT_VALUE, type PackageSpec } from "./scaffold.ts";

export interface Question {
  /** For questions command-line flags can answer: "leetcode", "playgrounds". */
  id?: string;
  message: string;
  /** The answer used when the person just presses Enter (and with --yes). */
  default?: string | boolean;
  /** For select(): the allowed answers. */
  choices?: { value: string; label: string }[];
}

export interface Prompter {
  text(q: Question & { default?: string }): Promise<string>;
  select<T extends string>(q: Question & { choices: { value: T; label: string }[]; default?: T }): Promise<T>;
  confirm(q: Question & { default?: boolean }): Promise<boolean>;
  /** Show a line of output. */
  say(text: string): void;
}

export interface WizardDeps {
  fetchLeetCode(url: string, playgrounds: string[]): Promise<LeetCodeData>;
}

type Range = [number, number];

const IDENT = /^[A-Za-z_]\w*$/;
const words = (slug: string) => slug.replace(/^_/, "").split("-").filter(Boolean);
const titleOf = (slug: string) => words(slug).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
const camelOf = (slug: string) => words(slug).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join("");
const showRange = ([lo, hi]: Range) => `${lo}..${hi}`;
const describe = (p: Param) => [
  `${p.name}: ${p.type}`,
  p.length && `length ${showRange(p.length)}`,
  p.inner_length && `each ${showRange(p.inner_length)} long`,
  p.value && `values ${showRange(p.value)}`,
  p.chars && `chars ${p.chars}`,
].filter(Boolean).join(", ");

function parseRange(text: string): Range {
  const m = text.trim().match(/^(-?\d+)\s*(?:\.\.|,|\s)\s*(-?\d+)$/);
  if (!m) throw new Error(`Use min..max, like 1..100000`);
  const r: Range = [+m[1], +m[2]];
  if (r[0] > r[1]) throw new Error(`${r[0]} is bigger than ${r[1]}`);
  return r;
}

function parseChars(text: string) {
  const c = text.trim();
  try { new RegExp(`^${c}$`, "u"); } catch { throw new Error(`${c} isn't a regex character class, like [a-z]`); }
  return c;
}

/** Answers every question with its default (or a preset, by question id), for --yes. Throws at a question with neither. */
export function defaultsOnly(say: (text: string) => void, presets: Record<string, string> = {}): Prompter {
  const answer = <T>(q: Question & { default?: T }): T => {
    if (q.id && q.id in presets) return presets[q.id] as T;
    if (q.default === undefined) throw new Error(`--yes needs an answer for: ${q.message}`);
    return q.default;
  };
  const once = new Set<string>();
  return {
    text: async q => {
      // A failed answer would be asked again forever; with no one to answer, stop instead.
      if (once.has(q.message)) throw new Error(`--yes: the default for "${q.message}" didn't work`);
      once.add(q.message);
      return answer(q);
    },
    select: async q => answer(q),
    confirm: async q => answer(q),
    say,
  };
}

export async function runWizard(prompt: Prompter, deps: WizardDeps): Promise<{ spec: PackageSpec }> {
  /** Ask until `parse` accepts the answer. */
  async function ask<T>(q: Question & { default?: string }, parse: (answer: string) => T): Promise<T> {
    for (;;) {
      const answer = await prompt.text(q);
      try { return parse(answer); }
      catch (e) { prompt.say(`  ${(e as Error).message}`); }
    }
  }
  const range = (message: string, def: Range) => ask({ message, default: showRange(def) }, parseRange);

  const lc = await leetCode();
  const from = lc?.spec;

  const slug = await ask({ message: "Package slug: the page's URL, like binary-search", default: from?.slug }, s => {
    checkSlug(s.trim());
    return s.trim();
  });
  const title = await ask({ message: "Title", default: from?.title ?? titleOf(slug) }, s => {
    if (!s.trim()) throw new Error("The title can't be empty");
    return s.trim();
  });
  const entry = await ask({ message: "Name of the entry function every submission exports", default: from?.entry ?? camelOf(slug) }, s => {
    if (!IDENT.test(s.trim())) throw new Error(`${s} isn't a valid function name`);
    return s.trim();
  });

  const input: Param[] = [];
  const imported = from?.input.length && await prompt.confirm({
    message: `Use these parameters from LeetCode? ${from.input.map(describe).join("; ")}`,
    default: true,
  });
  if (imported) input.push(...from.input);
  else for (;;) {
    const n = input.length + 1;
    const name = await ask({ message: `Parameter ${n} name${n > 1 ? " (Enter when done)" : ""}`, default: n > 1 ? "" : undefined }, s => {
      const t = s.trim();
      if (!t && n > 1) return "";
      if (!IDENT.test(t)) throw new Error(`${s} isn't a valid parameter name`);
      if (input.some(p => p.name === t)) throw new Error(`There's already a parameter called ${t}`);
      return t;
    });
    if (!name) break;
    const type = await prompt.select<ParamType>({
      message: `Type of ${name}`,
      choices: PARAM_TYPES.map(t => ({ value: t, label: t })),
      default: "int[]",
    });
    input.push(await constraints({ name, type }));
  }

  const returns = await prompt.select<ReturnType>({
    message: `What does ${entry} return?`,
    choices: RETURN_TYPES.map(t => ({ value: t, label: t })),
    default: from?.returns ?? "int",
  });
  const chosen = lc ? await pickSolutions(lc.solutions) : {};
  const approach = chosen.accepted ?? chosen.reference;
  const time = await ask({ message: "Time complexity", default: approach?.complexity?.time ?? "O(n)" }, s => s.trim());
  const space = await ask({ message: "Space complexity", default: approach?.complexity?.space ?? "O(1)" }, s => s.trim());
  const time_ms = await ask({ message: "Time limit for the large tests, in ms", default: String(DEFAULT_TIME_MS) }, s => {
    const n = Number(s);
    if (!Number.isInteger(n) || n <= 0) throw new Error("Use a whole number of milliseconds");
    return n;
  });
  const notes = from?.constraints_note ?? [];
  const validator = await prompt.confirm({
    message: notes.length
      ? `Add an input validator for the constraints that aren't ranges? ${notes.join(" ")}`
      : "Add an input validator for constraints that aren't ranges?",
    default: notes.length > 0,
  });

  const spec: PackageSpec = {
    ...from,
    slug, title, entry, input, returns, complexity: { time, space }, time_ms, validator,
    // LeetCode's examples only fit LeetCode's parameters.
    samples: imported ? from.samples : undefined,
    ...(approach?.explanation ? { explanation: approach.explanation } : {}),
    ...(chosen.accepted ? { solution: chosen.accepted.typescript } : {}),
    ...(chosen.bruteForce ? { bruteForce: chosen.bruteForce.typescript } : {}),
    ...(chosen.reference ? { reference: { language: chosen.reference.language, code: chosen.reference.code } } : {}),
  };
  if (!(await prompt.confirm({ message: `Create problems/${slug}/?`, default: true }))) throw new Error("Cancelled");
  return { spec };

  /** Asks for a LeetCode URL (and playgrounds) and imports it. Undefined when skipped. */
  async function leetCode(): Promise<LeetCodeImport | undefined> {
    for (;;) {
      const url = (await prompt.text({ id: "leetcode", message: "LeetCode problem to start from: its page, or its page in an explore card (optional, Enter to skip)", default: "" })).trim();
      if (!url) return undefined;
      const playgrounds = (await prompt.text({
        id: "playgrounds",
        message: "More solutions: LeetCode playground or explore article links (optional, space-separated)",
        default: "",
      })).split(/[\s,]+/).filter(Boolean);
      try {
        const lc = fromLeetCode(await deps.fetchLeetCode(url, playgrounds));
        const n = lc.solutions.length, js = lc.solutions.filter(x => x.typescript).length;
        prompt.say(`  Imported ${lc.spec.title}: ${lc.spec.samples?.length ?? 0} examples, ${n} solution${n === 1 ? "" : "s"} (${js} in JavaScript).`);
        for (const note of lc.notes) prompt.say(`  ${note}`);
        return lc;
      } catch (e) {
        prompt.say(`  ${(e as Error).message}`);
      }
    }
  }

  /** The accepted solution and brute force from the JavaScript ones, or else one to port. */
  async function pickSolutions(solutions: Solution[]): Promise<{ accepted?: Solution; bruteForce?: Solution; reference?: Solution }> {
    const MYSELF = { value: "", label: "None: I'll write it myself" };
    const choose = async (message: string, from: Solution[]) => {
      if (!from.length) return undefined;
      const title = await prompt.select({
        message,
        choices: [...from.map(x => ({ value: x.title, label: `${x.title} (${x.language})` })), MYSELF],
        default: from[0].title,
      });
      return from.find(x => x.title === title);
    };
    const ts = solutions.filter(x => x.typescript);
    if (ts.length) {
      const accepted = await choose("Accepted solution, shown on the page", ts);
      const bruteForce = await choose("Brute force (correct but slow), the oracle for the random tests", ts.filter(x => x !== accepted));
      return { accepted, bruteForce };
    }
    return { reference: await choose("Solution to port to TypeScript (it goes in a comment above the stub)", solutions) };
  }

  async function constraints(p: Param): Promise<Param> {
    const out: Param = { ...p };
    if (p.type !== "int") out.length = await range(`Allowed length of ${p.name} (min..max)`, p.length ?? DEFAULT_LENGTH);
    if (p.type === "int[][]") out.inner_length = await range(`Allowed length of each entry in ${p.name}`, p.inner_length ?? DEFAULT_INNER);
    if (p.type === "string[]") out.inner_length = await range(`Allowed length of each item in ${p.name}`, p.inner_length ?? DEFAULT_INNER);
    if (p.type.startsWith("int")) {
      out.value = await range(p.type === "int" ? `Allowed values of ${p.name}` : `Allowed values of each number in ${p.name}`, p.value ?? DEFAULT_VALUE);
    }
    if (p.type.startsWith("string")) {
      out.chars = await ask({ message: `Characters allowed in ${p.name} (a regex character class)`, default: p.chars ?? DEFAULT_CHARS }, parseChars);
    }
    return out;
  }
}
