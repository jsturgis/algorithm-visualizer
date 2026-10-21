// How answers are compared, shared by the verifier and the in-browser judge so they always agree.
// Answers are compared as canonical JSON: the text form the .ans files use, with object keys sorted.
// So -0 equals 0 and key order doesn't matter, but [1, 2] differs from [2, 1].

export function canonical(value: unknown): string | undefined {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
      : v);
}

export const sameAnswer = (expected: unknown, actual: unknown) => canonical(expected) === canonical(actual);

/**
 * Where `actual` first differs from `expected`, as a path into the value: [] for the whole value,
 * [3] for index 3 of an array, ["a", 0] for a.0. null when they're the same.
 */
export function firstDifference(expected: unknown, actual: unknown, path: (string | number)[] = []): (string | number)[] | null {
  if (sameAnswer(expected, actual)) return null;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const n = Math.min(expected.length, actual.length);
    for (let i = 0; i < n; i++) {
      if (!sameAnswer(expected[i], actual[i])) return firstDifference(expected[i], actual[i], [...path, i]);
    }
    return [...path, n];   // one is a prefix of the other: they differ where the shorter one ends
  }
  if (isRecord(expected) && isRecord(actual)) {
    for (const k of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) {
      if (!sameAnswer(expected[k], actual[k])) return firstDifference(expected[k], actual[k], [...path, k]);
    }
  }
  return path;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** SHA-256 of the canonical JSON, as hex. Used to ship large tests' answers without the answers. */
export async function answerFingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value) ?? "undefined");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
