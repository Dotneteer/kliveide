import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { E2E_CORE_TESTS, E2E_KBASIC_TESTS } from "./e2e-tests";

/** Run by their own config (`test/wasm/vitest.z80.config.ts`), and wall-clock budgets (`perf`). */
const ALWAYS_EXCLUDED = ["./test/wasm/z80/**/*.test.ts", "./test/**/*.perf.test.ts"];
const E2E = [...E2E_CORE_TESTS, ...E2E_KBASIC_TESTS].map((glob) => `./${glob}`);

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
      /**
       * The unit tier: everything that does not run a WASM machine core. `KLIVE_TEST_TIER` lets
       * `test/vitest.setup.ts` fail a test here that instantiates a core, so the e2e list in
       * `build/e2e-tests.ts` stays complete.
       */
      {
        extends: true,
        test: {
          name: "node",
          include: ["./test/**/*.test.ts"],
          exclude: [...ALWAYS_EXCLUDED, ...E2E],
          environment: "node",
          env: { KLIVE_TEST_TIER: "unit" }
        }
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          include: ["./test/**/*.test.tsx"],
          exclude: [...ALWAYS_EXCLUDED, ...E2E],
          environment: "jsdom",
          env: { KLIVE_TEST_TIER: "unit" }
        }
      },
      /**
       * The end-to-end tiers: tests that run the real WASM machine cores (see `build/e2e-tests.ts`).
       * `npm test` runs each only when its inputs changed since it last passed
       * (`scripts/run-tests.cjs`); `npm run test:e2e` / `npm run test:all` run them regardless.
       */
      {
        extends: true,
        test: {
          name: "e2e-cores",
          include: E2E_CORE_TESTS.map((glob) => `./${glob}`),
          exclude: ALWAYS_EXCLUDED,
          environment: "node"
        }
      },
      {
        extends: true,
        test: {
          name: "e2e-kbasic",
          include: E2E_KBASIC_TESTS.map((glob) => `./${glob}`),
          exclude: ALWAYS_EXCLUDED,
          environment: "node"
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
      "@controls": resolve(__dirname, "..", "src/renderer/controls"),
      "@mvc": resolve(__dirname, "..", "src/renderer/mvc")
    }
  }
});
