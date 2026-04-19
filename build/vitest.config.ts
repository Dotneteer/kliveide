import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    root: resolve(__dirname, ".."),
    /**
     * By default, vitest search test files in all packages.
     * For e2e tests have sense search only is project root tests folder.
     * .test.ts  files run in Node (no DOM).
     * .test.tsx files run in jsdom (React components).
     */
    include: ["./test/**/*.test.ts", "./test/**/*.test.tsx"],

    /**
     * Apply jsdom only to component test files (.tsx). Pure logic tests
     * (.ts) continue to run in Node for speed.
     */
    environmentMatchGlobs: [["./test/**/*.test.tsx", "jsdom"]],

    /**
     * A default timeout of 5000ms is sometimes not enough for playwright.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./test/vitest.setup.ts"],
    alias: {
      "@styles": resolve(__dirname, "..", "src/renderer/assets/styles"),
      "@common": resolve(__dirname, "..", "src/common"),
      "@abstractions": resolve(__dirname, "..", "src/common/abstractions"),
      "@messaging": resolve(__dirname, "..", "src/common/messaging"),
      "@state": resolve(__dirname, "..", "src/common/state"),
      "@utils": resolve(__dirname, "..", "src/common/utils"),
      "@renderer": resolve(__dirname, "..", "src/renderer"),
      "@emu": resolve(__dirname, "..", "src/emu"),
      "@appIde": resolve(__dirname, "..", "src/renderer/appIde"),
      "@main": resolve(__dirname, "..", "src/main"),
      "@controls": resolve(__dirname, "..", "src/renderer/controls")
    }
  }
});

