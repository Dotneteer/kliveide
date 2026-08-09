import { readFileSync } from "node:fs";

import packageJson from "../../package.json";
import {
  buildSp128Wasm,
  buildAllSp128Wasm,
  output,
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionOutput,
  productionOutputRelative,
  productionExports,
  source,
  wasmDistDirectoryRelative
} from "../../scripts/build-sp128-wasm.cjs";
import { DEFAULT_MAX_BYTES, parseMaxBytes } from "../../scripts/check-sp128-wasm-size.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum 128K WASM build", () => {
  it("builds the V2 production artifact by default", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildSp128Wasm({
      compiler: "fake-c-compiler",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].compiler).toBe("fake-c-compiler");
    expect(calls[0].args).toContain(source);
    expect(calls[0].args).toContain(productionOutput);
    expect(calls[0].args).toContain("-O3");
    expect(calls[0].args).toContain("-Wl,--strip-all");
    expect(calls[0].args).toContain("-Wl,--initial-memory=8388608");
    for (const exportName of productionExports.filter(name => name !== "memory")) {
      expect(calls[0].args).toContain(`-Wl,--export=${exportName}`);
    }
    expect(result.output).toBe(productionOutput);
    expect(result.mode).toBe("production");
  });

  it("builds only the production V2 artifact from the CLI helper", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const results = buildAllSp128Wasm({
      compiler: "fake-c-compiler",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls).toHaveLength(1);
    expect(results.map(result => result.mode)).toEqual(["production"]);
    expect(calls[0].args).toContain(productionOutput);
  });

  it("accepts explicit optimization profiles", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    buildSp128Wasm({
      compiler: "fake-c-compiler",
      optimization: "size",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls[0].args).toContain("-Oz");
    expect(calls[0].args).not.toContain("-O3");
    expect(calls[0].args).not.toContain("-Wl,--strip-all");
  });

  it("rejects removed non-production build modes", () => {
    expect(() => buildSp128Wasm({
      compiler: "fake-c-compiler",
      mode: "v2",
      run: () => ({ status: 0 })
    })).toThrow("Expected: production");
  });

  it("declares the default executable-backend WASM size ceiling", () => {
    expect(DEFAULT_MAX_BYTES).toBe(320_000);
    expect(parseMaxBytes()).toBe(DEFAULT_MAX_BYTES);
    expect(parseMaxBytes("90000")).toBe(90_000);
    expect(() => parseMaxBytes("not-a-number")).toThrow("Invalid SP128_WASM_MAX_BYTES");
  });

  it("declares a package resource location for the WASM artifact", () => {
    expect(outputRelative).toBe("src/emu/machines/zxSpectrum128/wasm/dist/zx-spectrum128.wasm");
    expect(productionOutputRelative).toBe(outputRelative);
    expect(packagedArtifactRelative).toBe("wasm/zxSpectrum128/zx-spectrum128.wasm");
    expect(packageJson.build.extraResources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: wasmDistDirectoryRelative,
        to: packagedResourceDirectory,
        filter: ["**/*.wasm"]
      })
    ]));
  });

  it("instantiates the same artifact bytes that are copied into packaged Electron builds", async () => {
    buildSp128Wasm();

    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const exports = instance.exports as Record<string, unknown>;

    expect(exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(typeof exports.sp128ExecuteFrame).toBe("function");
    expect(typeof exports.sp128MemoryPtr).toBe("function");
    expect(packagedArtifactRelative.endsWith("/zx-spectrum128.wasm")).toBe(true);
  });
});
