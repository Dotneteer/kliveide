import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import {
  buildAllZ88Wasm,
  buildLockPath,
  buildZ88Wasm,
  output,
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  productionOutput,
  productionOutputRelative,
  source,
  wasmDistDirectoryRelative,
  Z88_WASM_MEMORY_BYTES
} from "../../scripts/build-z88-wasm.cjs";
import { checkZ88WasmSize, DEFAULT_MAX_BYTES, parseMaxBytes } from "../../scripts/check-z88-wasm-size.cjs";
import { z88WasmV2RequiredExports } from "@emu/machines/z88/wasm/Z88WasmV2Loader";
import { z88WasmArtifactBytes } from "../harness/z88";

/*
 * The Cambridge Z88 WASM build (Step 1 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
 */

type Call = { compiler: string; args: string[] };

function fakeRun(calls: Call[]) {
  return (compiler: string, args: string[]) => {
    calls.push({ compiler, args });
    return { status: 0 };
  };
}

describe("Cambridge Z88 WASM build", () => {
  // --- The fake-compiler cases check the artifact exists after "compiling": build it for real once
  beforeAll(() => {
    z88WasmArtifactBytes();
  });

  it("builds the production artifact from z88.c with the speed profile by default", () => {
    const calls: Call[] = [];
    const result = buildZ88Wasm({ compiler: "fake-c-compiler", run: fakeRun(calls) });

    expect(calls).toHaveLength(1);
    expect(calls[0].compiler).toBe("fake-c-compiler");
    expect(calls[0].args).toContain(source);
    expect(calls[0].args).toContain(productionOutput);
    expect(calls[0].args).toContain("--target=wasm32");
    expect(calls[0].args).toContain("-O3");
    expect(calls[0].args).toContain("-Wl,--strip-all");
    expect(calls[0].args).toContain("-nostdlib");
    expect(calls[0].args).toContain(`-Wl,--initial-memory=${Z88_WASM_MEMORY_BYTES}`);
    expect(calls[0].args).toContain(`-Wl,--max-memory=${Z88_WASM_MEMORY_BYTES}`);
    for (const exportName of productionExports.filter((name) => name !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${exportName}`);
    }
    expect(result.output).toBe(productionOutput);
    expect(result.mode).toBe("production");
    expect(result.optimization).toBe("speed");
  });

  it("reserves 8 MiB of linear memory", () => {
    expect(Z88_WASM_MEMORY_BYTES).toBe(8 * 1024 * 1024);
  });

  it("builds only the production artifact from the CLI helper", () => {
    const calls: Call[] = [];
    const results = buildAllZ88Wasm({ compiler: "fake-c-compiler", run: fakeRun(calls) });
    expect(calls).toHaveLength(1);
    expect(results.map((r) => r.mode)).toEqual(["production"]);
  });

  it.each([
    ["size", "-Oz"],
    ["lto", "-flto"]
  ])("accepts the %s optimization profile", (optimization, flag) => {
    const calls: Call[] = [];
    buildZ88Wasm({ compiler: "fake-c-compiler", optimization, run: fakeRun(calls) });
    expect(calls[0].args).toContain(flag);
  });

  it("rejects unknown build modes and optimization profiles", () => {
    expect(() => buildZ88Wasm({ compiler: "fake", mode: "v2", run: () => ({ status: 0 }) })).toThrow(
      "Expected: production"
    );
    expect(() => buildZ88Wasm({ compiler: "fake", optimization: "fast", run: () => ({ status: 0 }) })).toThrow(
      "Expected one of: speed, size, lto"
    );
  });

  it("reports a failing compiler", () => {
    expect(() => buildZ88Wasm({ compiler: "fake", run: () => ({ status: 1 }) })).toThrow(
      "Cambridge Z88 WASM compilation failed (1)"
    );
  });

  it("exports every non-static function of the C core, and nothing else", () => {
    const folder = dirname(source);
    const cFunctions = readdirSync(folder)
      .filter((f) => f.endsWith(".c"))
      .flatMap((f) => [...readFileSync(join(folder, f), "utf8").matchAll(/^(?:uint32_t|void) (z88[A-Za-z0-9]+)\([^)]*\)\s*\{/gm)])
      .map((m) => m[1])
      .sort();
    expect(productionExports.filter((name) => name !== "memory").sort()).toEqual(cFunctions);
  });

  it("exports everything the loader requires", () => {
    for (const name of z88WasmV2RequiredExports) {
      expect(productionExports).toContain(name);
    }
  });

  it("declares the size ceiling", () => {
    expect(DEFAULT_MAX_BYTES).toBe(200_000);
    expect(parseMaxBytes()).toBe(DEFAULT_MAX_BYTES);
    expect(parseMaxBytes("90000")).toBe(90_000);
    expect(() => parseMaxBytes("not-a-number")).toThrow("Invalid Z88_WASM_MAX_BYTES");
  });

  it("the size check measures the artifact against the ceiling", () => {
    const report = checkZ88WasmSize({ build: () => undefined });
    expect(report.actualBytes).toBeGreaterThan(0);
    expect(report.withinLimit).toBe(true);
    expect(() => checkZ88WasmSize({ build: () => undefined, maxBytes: 10 })).toThrow(
      "maximum allowed is 10 bytes"
    );
  });

  it("declares a package resource location for the artifact", () => {
    expect(outputRelative).toBe("src/emu/machines/z88/wasm/dist/cambridge-z88.wasm");
    expect(productionOutputRelative).toBe(outputRelative);
    expect(packagedArtifactRelative).toBe("wasm/z88/cambridge-z88.wasm");
    expect(packageJson.build.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: wasmDistDirectoryRelative,
          to: packagedResourceDirectory,
          filter: ["**/*.wasm"]
        })
      ])
    );
  });

  it("is part of the platform builds", () => {
    expect(packageJson.scripts["build:all-wasm"]).toContain("npm run build:z88-wasm");
    expect(packageJson.scripts["build:z88-wasm"]).toBe("node scripts/build-z88-wasm.cjs");
    expect(packageJson.scripts["check:z88-wasm-size"]).toBe("node scripts/check-z88-wasm-size.cjs");
  });

  it("releases the build lock after a real build", () => {
    buildZ88Wasm();
    expect(existsSync(buildLockPath)).toBe(false);
  });

  it("instantiates the artifact that packaged builds copy", async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const exports = instance.exports as Record<string, unknown>;
    expect(exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect((exports.memory as WebAssembly.Memory).buffer.byteLength).toBe(Z88_WASM_MEMORY_BYTES);
    for (const name of productionExports.filter((n) => n !== "memory")) {
      expect(typeof exports[name]).toBe("function");
    }
  });
});
