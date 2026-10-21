import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { algorithms, tsLibs } from "./build/vite-plugin.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // The site's HTML lives in site/; the built site goes to dist/, which is all GitHub Pages serves.
  root: "site",
  base: "./",
  plugins: [algorithms(), tsLibs()],
  // The type checker runs in a Web Worker, which has its own plugin pipeline.
  worker: { format: "es", plugins: () => [tsLibs()] },
  build: { outDir: "../dist", emptyOutDir: true },
  server: { fs: { allow: [root] } },
  test: {
    root,
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
