import { readFileSync } from "node:fs";

import packageJson from "../../package.json";
import {
  buildSp48Wasm,
  output,
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  testExports,
  wasmDistDirectoryRelative,
  z80Source
} from "../../scripts/build-sp48-wasm.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum 48K WASM build", () => {
  it("passes the C core and required ABI exports to a fake compiler", () => {
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
    expect(calls[0].args).toContain(output);
    for (const exportName of testExports.filter(name => name !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${exportName}`);
    }
    expect(result.output).toBe(output);
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
