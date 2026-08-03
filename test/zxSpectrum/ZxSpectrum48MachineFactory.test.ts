import {
  DEFAULT_SP48_IMPLEMENTATION,
  SP48_IMPLEMENTATION
} from "@emu/machines/zxSpectrum48/ZxSpectrum48Implementation";
import { getModelConfig } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { createZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum48WasmMachine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmMachine";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";

describe("ZX Spectrum 48K implementation selection", () => {
  it("uses the centralized WASM v2 implementation switch by default", () => {
    expect(DEFAULT_SP48_IMPLEMENTATION).toBe("wasm-v2");
    expect(createZxSpectrum48Machine()).toBeInstanceOf(ZxSpectrum48WasmV2Machine);
  });

  it("selects the WASM implementation when requested", () => {
    const machine = createZxSpectrum48Machine(undefined, { [SP48_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("selects the experimental WASM v2 implementation when requested", () => {
    const machine = createZxSpectrum48Machine(undefined, { [SP48_IMPLEMENTATION]: "wasm-v2" });

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmV2Machine);
    expect(machine).not.toBeInstanceOf(ZxSpectrum48WasmMachine);
  });

  it("exposes a PAL WASM v2 model for manual dev selection", () => {
    const config = getModelConfig("sp48", "pal-v2");

    expect(config?.[SP48_IMPLEMENTATION]).toBe("wasm-v2");
    expect(createZxSpectrum48Machine(undefined, config)).toBeInstanceOf(ZxSpectrum48WasmV2Machine);
  });

  it("exposes explicit PAL fallback models for manual backend comparisons", () => {
    const stableWasmConfig = getModelConfig("sp48", "pal-wasm");
    const typeScriptConfig = getModelConfig("sp48", "pal-typescript");

    expect(stableWasmConfig?.[SP48_IMPLEMENTATION]).toBe("wasm");
    expect(createZxSpectrum48Machine(undefined, stableWasmConfig)).toBeInstanceOf(ZxSpectrum48WasmMachine);
    expect(typeScriptConfig?.[SP48_IMPLEMENTATION]).toBe("typescript");
    expect(createZxSpectrum48Machine(undefined, typeScriptConfig)).toBeInstanceOf(ZxSpectrum48Machine);
    expect(createZxSpectrum48Machine(undefined, typeScriptConfig)).not.toBeInstanceOf(ZxSpectrum48WasmMachine);
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

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmV2Machine);
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
