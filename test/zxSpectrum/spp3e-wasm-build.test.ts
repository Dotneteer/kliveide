import { readFileSync } from "node:fs";

import packageJson from "../../package.json";
import {
  buildAllSpP3eWasm,
  buildSpP3eWasm,
  output,
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  productionOutput,
  productionOutputRelative,
  source,
  wasmDistDirectoryRelative
} from "../../scripts/build-spp3e-wasm.cjs";
import { DEFAULT_MAX_BYTES, parseMaxBytes } from "../../scripts/check-spp3e-wasm-size.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum +3E WASM build", () => {
  it("builds the V2 production artifact by default", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildSpP3eWasm({
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
    const results = buildAllSpP3eWasm({
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
    buildSpP3eWasm({
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
    expect(() => buildSpP3eWasm({
      compiler: "fake-c-compiler",
      mode: "v2",
      run: () => ({ status: 0 })
    })).toThrow("Expected: production");
  });

  it("declares the full normal-frame WASM size ceiling", () => {
    expect(DEFAULT_MAX_BYTES).toBe(352_000);
    expect(parseMaxBytes()).toBe(DEFAULT_MAX_BYTES);
    expect(parseMaxBytes("90000")).toBe(90_000);
    expect(() => parseMaxBytes("not-a-number")).toThrow("Invalid SPP3E_WASM_MAX_BYTES");
  });

  it("declares a package resource location for the WASM artifact", () => {
    expect(outputRelative).toBe("src/emu/machines/zxSpectrumP3e/wasm/dist/zx-spectrum-p3e.wasm");
    expect(productionOutputRelative).toBe(outputRelative);
    expect(packagedArtifactRelative).toBe("wasm/zxSpectrumP3e/zx-spectrum-p3e.wasm");
    expect(packageJson.build.extraResources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: wasmDistDirectoryRelative,
        to: packagedResourceDirectory,
        filter: ["**/*.wasm"]
      })
    ]));
  });

  it("instantiates the same artifact bytes that are copied into packaged Electron builds", async () => {
    buildSpP3eWasm();

    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const exports = instance.exports as Record<string, unknown>;

    expect(exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(typeof exports.spp3eExecuteFrame).toBe("function");
    expect(typeof exports.spp3eMemoryPtr).toBe("function");
    expect(packagedArtifactRelative.endsWith("/zx-spectrum-p3e.wasm")).toBe(true);
  });
});
