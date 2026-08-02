import { SP48_IMPLEMENTATION } from "@emu/machines/zxSpectrum48/ZxSpectrum48Implementation";
import { describe, expect, it } from "vitest";
import { createZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum48WasmMachine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmMachine";

describe("ZX Spectrum 48K implementation selection", () => {
  it("uses the TypeScript implementation by default", () => {
    expect(createZxSpectrum48Machine()).toBeInstanceOf(ZxSpectrum48Machine);
    expect(createZxSpectrum48Machine()).not.toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("selects the WASM bootstrap facade when requested", () => {
    const machine = createZxSpectrum48Machine(undefined, { [SP48_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("also honors a model-level implementation selection", () => {
    const machine = createZxSpectrum48Machine({
      modelId: "test-wasm-model",
      displayName: "Test WASM model",
      config: { [SP48_IMPLEMENTATION]: "wasm" }
    });

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmMachine);
  });
});
