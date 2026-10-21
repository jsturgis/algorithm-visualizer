// Runs every problem-package check (build/verify.ts) as a test, for every package including the template.
import { describe, expect, test } from "vitest";
import { loadPackages } from "../build/package.ts";
import { verifyPackage } from "../build/verify.ts";

const results = await Promise.all(loadPackages({ templates: true }).map(async pkg => ({ slug: pkg.slug, checks: await verifyPackage(pkg) })));

describe.each(results)("problems/$slug", ({ checks }) => {
  test.each(checks)("$name", check => {
    expect(check.ok, check.detail).toBe(true);
  });
});
