// Checks inputs against the constraints declared in problem.yaml. Used by the verifier (Node) and the page input row.
import type { Input, Param } from "./types.ts";

const range = ([lo, hi]: [number, number]) => `between ${lo.toLocaleString("en-US")} and ${hi.toLocaleString("en-US")}`;
const outside = (n: number, r?: [number, number]) => !!r && (n < r[0] || n > r[1]);
const isIntArray = (v: unknown): v is number[] => Array.isArray(v) && v.every(x => Number.isInteger(x));
const badChar = (s: string, chars?: string) => (chars ? [...s].find(c => !new RegExp(`^${chars}$`, "u").test(c)) : undefined);

/** Every constraint violation in `input`, as readable messages (empty when valid). */
export function checkInput(input: Input, params: Param[]): string[] {
  const errors: string[] = [];
  for (const p of params) {
    const v = input[p.name];
    switch (p.type) {
      case "int":
        if (!Number.isInteger(v)) { errors.push(`${p.name} must be a whole number.`); continue; }
        if (outside(v as number, p.value)) errors.push(`${p.name} must be ${range(p.value!)}.`);
        break;

      case "int[]":
        if (!isIntArray(v)) { errors.push(`${p.name} must be a list of whole numbers.`); continue; }
        if (outside(v.length, p.length)) errors.push(`${p.name} must have ${range(p.length!)} numbers.`);
        if (p.value && v.some(x => outside(x, p.value))) errors.push(`Every number in ${p.name} must be ${range(p.value)}.`);
        break;

      case "int[][]":
        if (!Array.isArray(v) || !v.every(isIntArray)) { errors.push(`${p.name} must be a list of lists of whole numbers.`); continue; }
        if (outside(v.length, p.length)) errors.push(`${p.name} must have ${range(p.length!)} entries.`);
        if (p.inner_length && v.some(a => outside(a.length, p.inner_length))) errors.push(`Every entry of ${p.name} must have ${range(p.inner_length)} numbers.`);
        if (p.value && v.some(a => a.some(x => outside(x, p.value)))) errors.push(`Every number in ${p.name} must be ${range(p.value)}.`);
        break;

      case "string": {
        if (typeof v !== "string") { errors.push(`${p.name} must be text.`); continue; }
        if (outside([...v].length, p.length)) errors.push(`${p.name} must have ${range(p.length!)} characters.`);
        const c = badChar(v, p.chars);
        if (c !== undefined) errors.push(`${p.name} can't contain ${JSON.stringify(c)}.`);
        break;
      }

      case "string[]": {
        if (!Array.isArray(v) || v.some(x => typeof x !== "string")) { errors.push(`${p.name} must be a list of text items.`); continue; }
        if (outside(v.length, p.length)) errors.push(`${p.name} must have ${range(p.length!)} items.`);
        if (p.inner_length && v.some(x => outside([...x].length, p.inner_length))) {
          errors.push(p.inner_length[0] === 1 && p.inner_length[1] === 1
            ? `Every item of ${p.name} must be a single character.`
            : `Every item of ${p.name} must have ${range(p.inner_length)} characters.`);
        }
        const c = v.map(x => badChar(x, p.chars)).find(x => x !== undefined);
        if (c !== undefined) errors.push(`${p.name} can't contain ${JSON.stringify(c)}.`);
        break;
      }
    }
  }
  const extra = Object.keys(input).filter(k => !params.some(p => p.name === k));
  if (extra.length) errors.push(`Unexpected input: ${extra.join(", ")}.`);
  return errors;
}

/** The params with the visualization's tighter limits applied. */
export function withLimits(params: Param[], limits: Record<string, Pick<Param, "length" | "value" | "inner_length">> = {}): Param[] {
  return params.map(p => ({ ...p, ...limits[p.name] }));
}

/** Text from an input field → value. Throws a readable Error. */
export function parseField(text: string, p: Param): unknown {
  switch (p.type) {
    case "int": {
      const t = text.trim();
      const n = Number(t);
      if (t === "" || !Number.isInteger(n)) throw new Error(`${p.name} must be a whole number.`);
      return n;
    }
    case "int[]": {
      const nums = text.split(/[\s,]+/).filter(Boolean).map(Number);
      if (nums.some(x => !Number.isInteger(x))) throw new Error(`Use whole numbers separated by commas for ${p.name}.`);
      return nums;
    }
    case "int[][]": {
      // "[0, 1], [2, 3]" or "[[0, 1], [2, 3]]"
      const t = text.trim();
      let value: unknown;
      try { value = JSON.parse(t.startsWith("[[") || t === "[]" ? t : `[${t}]`); }
      catch { throw new Error(`Write ${p.name} as lists in brackets, like [0, 1], [2, 3].`); }
      if (!Array.isArray(value) || !value.every(isIntArray)) throw new Error(`Write ${p.name} as lists of whole numbers, like [0, 1], [2, 3].`);
      return value;
    }
    case "string":
      return text;   // as typed: spaces can matter
    case "string[]":
      // Items are trimmed, and empty items (e.g. from a trailing comma) are ignored.
      return text.split(",").map(s => s.trim()).filter(s => s !== "");
  }
}

/** Value → text for an input field. */
export function formatField(value: unknown, p: Param): string {
  switch (p.type) {
    case "int[]":
    case "string[]":
      return (value as unknown[]).join(", ");
    case "int[][]":
      return (value as number[][]).map(a => `[${a.join(", ")}]`).join(", ");
    default:
      return String(value);
  }
}
