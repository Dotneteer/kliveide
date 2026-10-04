import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import {
  buildLockPath,
  buildZx8081Wasm,
  output,
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  productionOutputRelative,
  source,
  wasmDistDirectoryRelative,
  ZX8081_WASM_MEMORY_BYTES
} from "../../scripts/build-zx8081-wasm.cjs";
import { checkZx8081WasmSize, DEFAULT_MAX_BYTES, parseMaxBytes } from "../../scripts/check-zx8081-wasm-size.cjs";
import { zx8081WasmV2RequiredExports } from "@emu/machines/zx8081/wasm/Zx8081WasmV2Loader";

/* The Sinclair ZX80/ZX81 WASM build (`.plans/ZX8081_WASM_PLAN.md`) */

type Call = { compiler: string; args: string[] };
const fakeRun = (calls: Call[]) => (compiler: string, args: string[]) => {
  calls.push({ compiler, args });
  return { status: 0 };
};

describe("ZX80/ZX81 WASM build", () => {
  it("builds the artifact from zx8081.c with the speed profile and the export allow-list", () => {
    const calls: Call[] = [];
    buildZx8081Wasm();
    buildZx8081Wasm({ compiler: "fake-c-compiler", run: fakeRun(calls) });
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain(source);
    expect(calls[0].args).toContain("-O3");
    expect(calls[0].args).toContain(`-Wl,--initial-memory=${ZX8081_WASM_MEMORY_BYTES}`);
    for (const name of productionExports.filter((n) => n !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${name}`);
    }
  });

  it("exports every non-static function of the C core (the keyboard's through its aliases), and nothing else", () => {
    const folder = dirname(source);
    const cFunctions = readdirSync(folder)
      .filter((f) => f.endsWith(".c"))
      .flatMap((f) => [...readFileSync(join(folder, f), "utf8").matchAll(/^(?:uint32_t|void) (zx8081[A-Za-z0-9]+)\([^)]*\)\s*\{/gm)])
      .map((m) => m[1]);
    const evaluator = readFileSync(join(folder, "../../../../z80/wasm/z80-condition.c"), "utf8");
    const condFunctions = [...evaluator.matchAll(/^(?:uint32_t|int64_t|void) (cond[A-Za-z0-9]+)\([^)]*\)\s*\{/gm)].map((m) => m[1]);
    expect(productionExports.filter((n) => n !== "memory").sort()).toEqual(
      [...cFunctions, ...condFunctions, "zx8081SetKeyStatus", "zx8081GetKeyboardLine"].sort()
    );
  });

  it("exports everything the loader requires", () => {
    for (const name of zx8081WasmV2RequiredExports) expect(productionExports).toContain(name);
  });

  it("checks the size ceiling", () => {
    expect(parseMaxBytes()).toBe(DEFAULT_MAX_BYTES);
    expect(checkZx8081WasmSize({ build: () => undefined }).withinLimit).toBe(true);
    expect(() => checkZx8081WasmSize({ build: () => undefined, maxBytes: 10 })).toThrow("maximum allowed is 10 bytes");
  });

  it("is packaged and part of the platform builds", () => {
    expect(outputRelative).toBe("src/emu/machines/zx8081/wasm/dist/zx8081.wasm");
    expect(productionOutputRelative).toBe(outputRelative);
    expect(packagedArtifactRelative).toBe("wasm/zx8081/zx8081.wasm");
    expect(packageJson.build.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: wasmDistDirectoryRelative, to: packagedResourceDirectory, filter: ["**/*.wasm"] })
      ])
    );
    expect(packageJson.scripts["build:all-wasm"]).toContain("npm run build:zx8081-wasm");
    expect(packageJson.scripts["build:zx8081-wasm"]).toBe("node scripts/build-zx8081-wasm.cjs");
    expect(packageJson.scripts["check:zx8081-wasm-size"]).toBe("node scripts/check-zx8081-wasm-size.cjs");
  });

  it("releases the build lock and instantiates the artifact", async () => {
    buildZx8081Wasm();
    expect(existsSync(buildLockPath)).toBe(false);
    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const exports = instance.exports as Record<string, unknown>;
    expect((exports.memory as WebAssembly.Memory).buffer.byteLength).toBe(ZX8081_WASM_MEMORY_BYTES);
    for (const name of productionExports.filter((n) => n !== "memory")) expect(typeof exports[name]).toBe("function");
  });
});
