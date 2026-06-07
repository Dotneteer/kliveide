import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@abstractions": resolve(__dirname, "../src/common/abstractions"),
      "@emu": resolve(__dirname, "../src/emu")
    }
  },
  test: {
    root: resolve(__dirname, ".."),
    include: ["./test/**/*.test.ts", "./test/**/*.test.tsx"],
    environmentMatchGlobs: [["./test/**/*.test.tsx", "jsdom"]],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./test/vitest.setup.ts"]
  }
});
