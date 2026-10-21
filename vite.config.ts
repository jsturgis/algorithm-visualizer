import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { algorithms } from "./build/vite-plugin.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // The site's HTML lives in site/; the built site goes to dist/, which is all GitHub Pages serves.
  root: "site",
  base: "./",
  plugins: [algorithms()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { fs: { allow: [root] } },
  test: {
    root,
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
