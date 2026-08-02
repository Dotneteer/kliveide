import {
  DEFAULT_SP48_IMPLEMENTATION,
  SP48_IMPLEMENTATION
} from "@emu/machines/zxSpectrum48/ZxSpectrum48Implementation";
import { describe, expect, it } from "vitest";
import { createZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum48WasmMachine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmMachine";

describe("ZX Spectrum 48K implementation selection", () => {
  it("uses the centralized WASM implementation switch by default", () => {
    expect(DEFAULT_SP48_IMPLEMENTATION).toBe("wasm");
    expect(createZxSpectrum48Machine()).toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("selects the WASM implementation when requested", () => {
    const machine = createZxSpectrum48Machine(undefined, { [SP48_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("can explicitly switch back to the TypeScript implementation", () => {
    const machine = createZxSpectrum48Machine(undefined, { [SP48_IMPLEMENTATION]: "typescript" });

    expect(machine).toBeInstanceOf(ZxSpectrum48Machine);
    expect(machine).not.toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("also honors a model-level implementation selection", () => {
    const machine = createZxSpectrum48Machine({
      modelId: "test-wasm-model",
      displayName: "Test WASM model",
      config: { [SP48_IMPLEMENTATION]: "wasm" }
    });

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("uses the centralized default for unknown selections", () => {
    const machine = createZxSpectrum48Machine(undefined, {
      [SP48_IMPLEMENTATION]: "experimental-native"
    } as any);

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("lets explicit config opt out of a model-level WASM experiment", () => {
    const machine = createZxSpectrum48Machine(
      {
        modelId: "test-wasm-model",
        displayName: "Test WASM model",
        config: { [SP48_IMPLEMENTATION]: "wasm" }
      },
      { [SP48_IMPLEMENTATION]: "typescript" }
    );

    expect(machine).toBeInstanceOf(ZxSpectrum48Machine);
    expect(machine).not.toBeInstanceOf(ZxSpectrum48WasmMachine);
  });
});
