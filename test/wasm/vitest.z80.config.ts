import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: resolve(__dirname, "../.."),
    include: ["./test/wasm/z80/**/*.test.ts"],
    exclude: ["./test/wasm/z80/memoryOp.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./test/vitest.setup.ts"],
    alias: {
      "@emu/z80/Z80Cpu": resolve(__dirname, "z80/Z80Cpu.ts"),
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
      "@controls": resolve(__dirname, "../..", "src/renderer/controls")
    }
  }
});
