import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    root: resolve(__dirname, ".."),
    /**
     * By default, vitest search test files in all packages.
     * Search only in the project root tests folder.
     * .test.ts       files run in Node (no DOM).
     * .test.tsx      files run in jsdom (React components).
     * .perf.test.ts  files assert wall-clock budgets; see the "perf" project.
     */
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["./test/**/*.test.ts"],
          exclude: ["./test/wasm/z80/**/*.test.ts", "./test/**/*.perf.test.ts"],
          environment: "node"
        }
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          include: ["./test/**/*.test.tsx"],
          environment: "jsdom"
        }
      },
      /**
       * Tests that measure elapsed time against a fixed budget. They pass with a
       * comfortable margin on an idle machine and fail on a busy one, so they say
       * more about what else the box is doing than about this code: run them
       * deliberately (`npm run test:perf`) rather than in `npm test`, which is why
       * `test:unit` names the other two projects explicitly.
       *
       * A file belongs here purely by its name, so a new perf suite needs no
       * config change - only the `.perf.test.ts` suffix.
       */
      {
        extends: true,
        test: {
          name: "perf",
          include: ["./test/**/*.perf.test.ts"],
          environment: "node"
        }
      }
    ],

    /**
     * A default timeout of 5000ms is sometimes not enough for the slower suites.
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
