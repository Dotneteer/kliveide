import {
  DEFAULT_SP48_IMPLEMENTATION,
  SP48_IMPLEMENTATION
} from "@emu/machines/zxSpectrum48/ZxSpectrum48Implementation";
import { machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { createZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";

describe("ZX Spectrum 48K implementation selection", () => {
  it("uses the V2 WASM implementation behind the centralized WASM switch by default", () => {
    expect(DEFAULT_SP48_IMPLEMENTATION).toBe("wasm");
    expect(createZxSpectrum48Machine()).toBeInstanceOf(ZxSpectrum48WasmV2Machine);
  });

  it("selects the V2 WASM implementation when WASM is requested", () => {
    const machine = createZxSpectrum48Machine(undefined, { [SP48_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmV2Machine);
  });

  it("can explicitly switch back to the TypeScript implementation", () => {
    const machine = createZxSpectrum48Machine(undefined, { [SP48_IMPLEMENTATION]: "typescript" });

    expect(machine).toBeInstanceOf(ZxSpectrum48Machine);
    expect(machine).not.toBeInstanceOf(ZxSpectrum48WasmV2Machine);
  });

  it("uses the centralized default for unknown selections", () => {
    const machine = createZxSpectrum48Machine(undefined, {
      [SP48_IMPLEMENTATION]: "native"
    } as any);

    expect(machine).toBeInstanceOf(ZxSpectrum48WasmV2Machine);
  });

  it("shows only the requested ZX Spectrum 48K models", () => {
    const models = machineRegistry.find(machine => machine.machineId === "sp48")?.models ?? [];

    expect(models.map(model => model.modelId)).toEqual(["pal", "ntsc", "pal-16k"]);
    expect(models.map(model => model.displayName)).toEqual([
      "ZX Spectrum 48K",
      "ZX Spectrum 48K (NTSC)",
      "ZX Spectrum 16K"
    ]);
  });
});
