import { resolve } from "path";
import { defineConfig } from "vitest/config";

/*
 * The Klive side of F1 (.plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md §8): run only by
 * `node test/vhdl/f1/run-f1.cjs`, never by `npm test`. Its files end in `.f1.ts`, which no other
 * vitest config includes.
 */
export default defineConfig({
  test: {
    root: resolve(__dirname, "../.."),
    include: ["./test/vhdl/f1/**/*.f1.ts"],
    environment: "node",
    testTimeout: 3_600_000,
    hookTimeout: 60_000,
    setupFiles: ["./test/vitest.setup.ts"],
    alias: {
      "@styles": resolve(__dirname, "../..", "src/renderer/assets/styles"),
      "@common": resolve(__dirname, "../..", "src/common"),
      "@abstractions": resolve(__dirname, "../..", "src/common/abstractions"),
      "@messaging": resolve(__dirname, "../..", "src/common/messaging"),
      "@state": resolve(__dirname, "../..", "src/common/state"),
      "@utils": resolve(__dirname, "../..", "src/common/utils"),
      "@renderer": resolve(__dirname, "../..", "src/renderer"),
      "@emu": resolve(__dirname, "../..", "src/emu"),
      "@appIde": resolve(__dirname, "../..", "src/renderer/appIde"),
      "@main": resolve(__dirname, "../..", "src/main"),
      "@controls": resolve(__dirname, "../..", "src/renderer/controls"),
      "@mvc": resolve(__dirname, "../..", "src/renderer/mvc")
    }
  }
});
