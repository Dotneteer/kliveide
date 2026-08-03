import { readFileSync } from "node:fs";

import packageJson from "../../package.json";
import {
  buildSp48Wasm,
  buildAllSp48Wasm,
  fastZ80ReferenceExports,
  fastZ80ReferenceOutput,
  fastZ80ReferenceSource,
  fastZ80Sp48Source,
  fastZ80TestOutput,
  output,
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionOutput,
  productionOutputRelative,
  productionExports,
  source,
  standaloneZ80TestExports,
  testExports,
  testOutput,
  testOutputRelative,
  v2Exports,
  v2Output,
  v2OutputRelative,
  v2Source,
  wasmDistDirectoryRelative,
  z80StateSource
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
    expect(calls[0].args).toContain(z80StateSource);
    expect(calls[0].args).toContain(fastZ80Sp48Source);
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

  it("can build a non-production fast Z80 reference artifact", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildSp48Wasm({
      compiler: "fake-c-compiler",
      mode: "fast-z80-reference",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls[0].args).toContain(fastZ80ReferenceSource);
    expect(calls[0].args).toContain(fastZ80ReferenceOutput);
    expect(calls[0].args).not.toContain(source);
    for (const exportName of fastZ80ReferenceExports.filter(name => name !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${exportName}`);
    }
    expect(result.output).toBe(fastZ80ReferenceOutput);
    expect(result.mode).toBe("fast-z80-reference");
  });

  it("can build a standalone fast Z80 artifact with normal test ABI names", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildSp48Wasm({
      compiler: "fake-c-compiler",
      mode: "fast-z80-test",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls[0].args).toContain(fastZ80ReferenceSource);
    expect(calls[0].args).toContain(fastZ80TestOutput);
    expect(calls[0].args).not.toContain(source);
    for (const exportName of standaloneZ80TestExports.filter(name => name !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${exportName}`);
    }
    expect(result.output).toBe(fastZ80TestOutput);
    expect(result.mode).toBe("fast-z80-test");
  });

  it("can build the isolated v2 SP48 full-machine artifact", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildSp48Wasm({
      compiler: "fake-c-compiler",
      mode: "v2",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls[0].args).toContain(v2Source);
    expect(calls[0].args).toContain(v2Output);
    expect(calls[0].args).not.toContain(source);
    expect(calls[0].args).toContain("-Wl,--initial-memory=8388608");
    for (const exportName of v2Exports.filter(name => name !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${exportName}`);
    }
    expect(v2Exports).toContain("sp48ExecuteFrame");
    expect(v2Exports).toContain("sp48PixelBufferPtr");
    expect(v2Exports).toContain("sp48AudioSamplesPtr");
    expect(result.output).toBe(v2Output);
    expect(result.mode).toBe("v2");
  });

  it("builds production and v2 artifacts from the CLI helper", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const results = buildAllSp48Wasm({
      compiler: "fake-c-compiler",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls).toHaveLength(2);
    expect(results.map(result => result.mode)).toEqual(["production", "v2"]);
    expect(calls[0].args).toContain(productionOutput);
    expect(calls[1].args).toContain(v2Output);
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
    expect(DEFAULT_MAX_BYTES).toBe(240_000);
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
    expect(productionExports).not.toContain("fast_z80_test_memory_ptr");
    expect(testExports).toEqual(expect.arrayContaining(productionExports));
    expect(testExports).toContain("z80_execute_instruction");
    expect(testExports).toContain("z80_test_memory_ptr");
    expect(fastZ80ReferenceExports).toContain("fast_z80_execute_instruction");
    expect(fastZ80ReferenceExports).toContain("fast_z80_test_memory_ptr");
  });

  it("routes SP48 frame and debug execution through the fast Z80 SP48 adapter", () => {
    const sp48CoreSource = readFileSync(source, "utf8");
    const fastZ80Sp48SourceText = readFileSync(fastZ80Sp48Source, "utf8");

    expect(sp48CoreSource).toContain("fast_sp48_z80_execute_instruction()");
    expect(sp48CoreSource).toContain("fast_sp48_z80_execute_debug_instruction()");
    expect(sp48CoreSource).not.toContain("z80_cpu_execute_sp48_instruction()");
    expect(sp48CoreSource).not.toContain("z80_cpu_execute_sp48_debug_instruction()");
    expect(sp48CoreSource).not.toContain("z80_bus_mode");
    expect(fastZ80Sp48SourceText).toContain("#include \"fast_z80.c\"");
    expect(fastZ80Sp48SourceText).toContain("sp48_bus_delay_memory_read");
    expect(fastZ80Sp48SourceText).toContain("sp48_bus_write_port_value");
  });

  it("declares a package resource location for the WASM artifact", () => {
    expect(outputRelative).toBe("src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm");
    expect(productionOutputRelative).toBe(outputRelative);
    expect(testOutputRelative).toBe("src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-test.wasm");
    expect(v2OutputRelative).toBe("src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48-v2.wasm");
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
