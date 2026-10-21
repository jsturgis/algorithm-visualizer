// Checks inputs against the constraints declared in problem.yaml. Used by the verifier (Node) and the page input row.
import type { Input, Param } from "./types.ts";

const range = ([lo, hi]: [number, number]) => `between ${lo.toLocaleString("en-US")} and ${hi.toLocaleString("en-US")}`;

/** Every constraint violation in `input`, as readable messages (empty when valid). */
export function checkInput(input: Input, params: Param[]): string[] {
  const errors: string[] = [];
  for (const p of params) {
    const v = input[p.name];
    if (p.type === "int") {
      if (!Number.isInteger(v)) { errors.push(`${p.name} must be a whole number.`); continue; }
      if (p.value && ((v as number) < p.value[0] || (v as number) > p.value[1])) errors.push(`${p.name} must be ${range(p.value)}.`);
    } else {
      if (!Array.isArray(v) || v.some(x => !Number.isInteger(x))) { errors.push(`${p.name} must be a list of whole numbers.`); continue; }
      if (p.length && (v.length < p.length[0] || v.length > p.length[1])) errors.push(`${p.name} must have ${range(p.length)} numbers.`);
      if (p.value && v.some(x => x < p.value![0] || x > p.value![1])) errors.push(`Every number in ${p.name} must be ${range(p.value)}.`);
    }
  }
  const extra = Object.keys(input).filter(k => !params.some(p => p.name === k));
  if (extra.length) errors.push(`Unexpected input: ${extra.join(", ")}.`);
  return errors;
}

/** The params with the visualization's tighter limits applied. */
export function withLimits(params: Param[], limits: Record<string, Pick<Param, "length" | "value">> = {}): Param[] {
  return params.map(p => ({ ...p, ...limits[p.name] }));
}

/** Text from an input field → value. Throws a readable Error. */
export function parseField(text: string, p: Param): unknown {
  if (p.type === "int") {
    const t = text.trim();
    const n = Number(t);
    if (t === "" || !Number.isInteger(n)) throw new Error(`${p.name} must be a whole number.`);
    return n;
  }
  const nums = text.split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.some(x => !Number.isInteger(x))) throw new Error(`Use whole numbers separated by commas for ${p.name}.`);
  return nums;
}

/** Value → text for an input field. */
export function formatField(value: unknown, p: Param): string {
  return p.type === "int[]" ? (value as number[]).join(", ") : String(value);
}
