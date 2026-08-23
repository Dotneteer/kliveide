import { machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { createZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";

describe("ZX Spectrum 48K implementation selection", () => {
  it("uses the V2 WASM implementation by default", () => {
    expect(createZxSpectrum48Machine()).toBeInstanceOf(ZxSpectrum48WasmV2Machine);
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
