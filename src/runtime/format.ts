// Small helpers for writing step notes.

/** Wrap negatives in parentheses so "3 + (-2)" reads correctly. */
export const fmt = (v: number) => (v < 0 ? `(${v})` : `${v}`);

/** a / b to at most two decimals, without trailing zeros: 37 / 7 → "5.29", 8 / 4 → "2". */
export const frac = (a: number, b: number) => (a / b).toFixed(2).replace(/\.?0+$/, "");
