import { readFileSync } from "node:fs";

import packageJson from "../../package.json";
import {
  buildAllZxNextWasm,
  buildZxNextWasm,
  output,
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  productionOutput,
  productionOutputRelative,
  source,
  wasmDistDirectoryRelative
} from "../../scripts/build-zxnext-wasm.cjs";
import { DEFAULT_MAX_BYTES, parseMaxBytes } from "../../scripts/check-zxnext-wasm-size.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM build", () => {
  it("builds the production artifact by default", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildZxNextWasm({
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

  it("builds only the production artifact from the CLI helper", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const results = buildAllZxNextWasm({
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

  it("rejects non-production build modes", () => {
    expect(() =>
      buildZxNextWasm({
        compiler: "fake-c-compiler",
        mode: "v2",
        run: () => ({ status: 0 })
      })
    ).toThrow("Expected: production");
  });

  it("declares the skeleton WASM size ceiling", () => {
    expect(DEFAULT_MAX_BYTES).toBe(80_000);
    expect(parseMaxBytes()).toBe(DEFAULT_MAX_BYTES);
    expect(parseMaxBytes("90000")).toBe(90_000);
    expect(() => parseMaxBytes("not-a-number")).toThrow("Invalid ZXNEXT_WASM_MAX_BYTES");
  });

  it("declares a package resource location for the WASM artifact", () => {
    expect(outputRelative).toBe("src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");
    expect(productionOutputRelative).toBe(outputRelative);
    expect(packagedArtifactRelative).toBe("wasm/zxNext/zx-spectrum-next.wasm");
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

  it("instantiates the same artifact bytes that are copied into packaged Electron builds", async () => {
    buildZxNextWasm();

    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const exports = instance.exports as Record<string, unknown>;

    expect(exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(typeof exports.zxnextHardReset).toBe("function");
    expect(typeof exports.zxnextMemoryPtr).toBe("function");
    expect(typeof exports.zxnextSramPtr).toBe("function");
    expect(packagedArtifactRelative.endsWith("/zx-spectrum-next.wasm")).toBe(true);
  });
});
