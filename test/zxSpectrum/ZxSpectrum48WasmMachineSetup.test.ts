import type { Sp48WasmExports, Sp48WasmInstance, Sp48WasmLoaderOptions } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";

import { ZxSpectrum48WasmMachine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmMachine";
import { SP48_WASM_ABI_VERSION, SP48_WASM_LAYOUT, SP48_WASM_LAYOUT_VALUE_ID } from "@emu/machines/zxSpectrum48/wasm/sp48-wasm-layout.generated";
import { describe, expect, it } from "vitest";

class TestWasmMachine extends ZxSpectrum48WasmMachine {
  romLoads = 0;

  constructor(loaderOptions: Sp48WasmLoaderOptions) {
    super(undefined, undefined, loaderOptions);
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    this.romLoads++;
    return new Uint8Array(0x4000);
  }
}

describe("ZX Spectrum 48K WASM machine setup", () => {
  it("loads and validates the WASM artifact before TypeScript ROM setup", async () => {
    const machine = new TestWasmMachine(fakeLoaderOptions());

    await machine.setup();

    expect(machine.wasmRuntime?.exports.sp48_abi_version()).toBe(SP48_WASM_ABI_VERSION);
    expect(machine.romLoads).toBe(1);
  });

  it("reports an incompatible WASM artifact instead of silently falling back", async () => {
    const machine = new TestWasmMachine(fakeLoaderOptions({
      sp48_abi_version: () => 99
    }));

    await expect(machine.setup()).rejects.toThrow("ABI version 99");
    expect(machine.romLoads).toBe(0);
  });
});

function fakeLoaderOptions(overrides: Partial<Sp48WasmExports> = {}): Sp48WasmLoaderOptions {
  return {
    artifactName: "setup-test.wasm",
    readArtifact: async () => new Uint8Array([0]),
    compile: async () => ({} as WebAssembly.Module),
    instantiate: async () => fakeInstance(overrides)
  };
}

function fakeInstance(overrides: Partial<Sp48WasmExports>): Promise<Sp48WasmInstance> {
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
