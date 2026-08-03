import { readFileSync } from "node:fs";

import packageJson from "../../package.json";
import {
  buildSp48Wasm,
  output,
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionOutput,
  productionOutputRelative,
  productionExports,
  source,
  testExports,
  testOutput,
  testOutputRelative,
  wasmDistDirectoryRelative,
  z80Source
} from "../../scripts/build-sp48-wasm.cjs";
import { DEFAULT_MAX_BYTES, parseMaxBytes } from "../../scripts/check-sp48-wasm-size.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum 48K WASM build", () => {
  it("builds the production artifact with the production ABI by default", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildSp48Wasm({
      compiler: "fake-c-compiler",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].compiler).toBe("fake-c-compiler");
    expect(calls[0].args).toContain(source);
    expect(calls[0].args).toContain(z80Source);
    expect(calls[0].args).toContain(productionOutput);
    for (const exportName of productionExports.filter(name => name !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${exportName}`);
    }
    expect(calls[0].args).not.toContain("-Wl,--export=z80_test_memory_ptr");
    expect(calls[0].args).toContain("-ffreestanding");
    expect(calls[0].args).toContain("-fno-builtin");
    expect(result.output).toBe(productionOutput);
    expect(result.mode).toBe("production");
  });

  it("can build a separate test artifact with standalone Z80 test exports", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildSp48Wasm({
      compiler: "fake-c-compiler",
      mode: "test",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls[0].args).toContain(testOutput);
    for (const exportName of testExports.filter(name => name !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${exportName}`);
    }
    expect(result.output).toBe(testOutput);
    expect(result.mode).toBe("test");
  });

  it("accepts explicit optimization profiles", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    buildSp48Wasm({
      compiler: "fake-c-compiler",
      optimization: "size",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls[0].args).toContain("-Oz");
    expect(calls[0].args).not.toContain("-O3");
  });

  it("declares the default production WASM size ceiling", () => {
    expect(DEFAULT_MAX_BYTES).toBe(85_000);
    expect(parseMaxBytes()).toBe(DEFAULT_MAX_BYTES);
    expect(parseMaxBytes("90000")).toBe(90_000);
    expect(() => parseMaxBytes("not-a-number")).toThrow("Invalid SP48_WASM_MAX_BYTES");
  });

  it("keeps separate production and test ABI manifests", () => {
    expect(productionExports).toContain("sp48_abi_version");
    expect(productionExports).toContain("sp48_layout_value");
    expect(productionExports).toContain("sp48_machine_state_block_ptr");
    expect(productionExports).toContain("sp48_diagnostics_reset");
    expect(productionExports).toContain("sp48_diagnostics_value");
    expect(productionExports).not.toContain("z80_test_memory_ptr");
    expect(testExports).toEqual(expect.arrayContaining(productionExports));
    expect(testExports).toContain("z80_execute_instruction");
    expect(testExports).toContain("z80_test_memory_ptr");
  });

  it("declares a package resource location for the WASM artifact", () => {
    expect(outputRelative).toBe("src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm");
    expect(productionOutputRelative).toBe(outputRelative);
    expect(testOutputRelative).toBe("src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-test.wasm");
    expect(packagedArtifactRelative).toBe("wasm/zxSpectrum48/zx-spectrum48.wasm");
    expect(packageJson.build.extraResources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: wasmDistDirectoryRelative,
        to: packagedResourceDirectory,
        filter: ["**/*.wasm"]
      })
    ]));
  });

  it("instantiates the same artifact bytes that are copied into packaged Electron builds", async () => {
    buildSp48Wasm();

    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const exports = instance.exports as Record<string, unknown>;

    expect(exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(typeof exports.sp48_abi_version).toBe("function");
    expect(packagedArtifactRelative.endsWith("/zx-spectrum48.wasm")).toBe(true);
  });
});
