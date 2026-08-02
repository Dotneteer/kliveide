import { readFileSync } from "node:fs";

import { buildSp48Wasm, output } from "../../scripts/build-sp48-wasm.cjs";
import {
  loadSp48Wasm,
  resetSp48WasmModuleCache,
  type Sp48WasmExports,
  type Sp48WasmInstance
} from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";
import { SP48_WASM_ABI_VERSION, SP48_WASM_LAYOUT, SP48_WASM_LAYOUT_VALUE_ID } from "@emu/machines/zxSpectrum48/wasm/sp48-wasm-layout.generated";
import { afterEach, describe, expect, it } from "vitest";

describe("ZX Spectrum 48K WASM loader", () => {
  afterEach(() => resetSp48WasmModuleCache());

  it("loads and validates the built artifact with injected artifact bytes", async () => {
    buildSp48Wasm();
    const runtime = await loadSp48Wasm({
      artifactName: "test-built.wasm",
      readArtifact: async () => readFileSync(output)
    });

    expect(runtime.exports.sp48_abi_version()).toBe(SP48_WASM_ABI_VERSION);
    expect(runtime.exports.sp48_layout_value(SP48_WASM_LAYOUT_VALUE_ID.machineStateBlockSize)).toBe(SP48_WASM_LAYOUT.machineStateBlockSize);
  });

  it("reports a missing artifact with useful context", async () => {
    await expect(loadSp48Wasm({
      artifactName: "missing-sp48.wasm",
      readArtifact: async () => {
        throw new Error("ENOENT: no such file");
      }
    })).rejects.toThrow("ENOENT");
  });

  it("rejects incompatible ABI versions", async () => {
    await expect(loadSp48Wasm({
      artifactName: "bad-version.wasm",
      readArtifact: async () => new Uint8Array([0]),
      compile: async () => ({} as WebAssembly.Module),
      instantiate: async () => fakeInstance({ sp48_abi_version: () => 99 })
    })).rejects.toThrow("ABI version 99");
  });

  it("rejects incompatible layout values", async () => {
    await expect(loadSp48Wasm({
      artifactName: "bad-layout.wasm",
      readArtifact: async () => new Uint8Array([0]),
      compile: async () => ({} as WebAssembly.Module),
      instantiate: async () => fakeInstance({
        sp48_layout_value: (id: number) =>
          id === SP48_WASM_LAYOUT_VALUE_ID.machineStateBlockSize ? 1 : layoutValue(id)
      })
    })).rejects.toThrow("layout mismatch for machineStateBlockSize");
  });

  it("reuses a compiled module for the same artifact name", async () => {
    let compileCount = 0;
    let readCount = 0;
    const module = {} as WebAssembly.Module;
    const options = {
      artifactName: "cached-sp48.wasm",
      readArtifact: async () => {
        readCount++;
        return new Uint8Array([0]);
      },
      compile: async () => {
        compileCount++;
        return module;
      },
      instantiate: async () => fakeInstance()
    };

    await loadSp48Wasm(options);
    await loadSp48Wasm(options);

    expect(readCount).toBe(1);
    expect(compileCount).toBe(1);
  });
});

function fakeInstance(overrides: Partial<Sp48WasmExports> = {}): Promise<Sp48WasmInstance> {
  return Promise.resolve({
    exports: {
      memory: new WebAssembly.Memory({ initial: 1 }),
      sp48_abi_version: () => SP48_WASM_ABI_VERSION,
      sp48_layout_value: layoutValue,
      ...overrides
    } as Sp48WasmExports
  });
}

function layoutValue(id: number): number {
  const key = (Object.keys(SP48_WASM_LAYOUT_VALUE_ID) as Array<keyof typeof SP48_WASM_LAYOUT_VALUE_ID>)
    .find(candidate => SP48_WASM_LAYOUT_VALUE_ID[candidate] === id);
  return key == null ? 0 : SP48_WASM_LAYOUT[key];
}
