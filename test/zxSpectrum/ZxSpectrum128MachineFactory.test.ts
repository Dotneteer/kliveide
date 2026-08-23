import { createZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory";
import { machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";

describe("ZX Spectrum 128K implementation selection", () => {
  it("uses the WASM implementation by default", () => {
    expect(createZxSpectrum128Machine()).toBeInstanceOf(ZxSpectrum128WasmV2Machine);
  });

  it("keeps the machine registry product-oriented", () => {
    const machine = machineRegistry.find(machine => machine.machineId === "sp128");
    const models = machine?.models ?? [];

    expect(machine?.displayName).toBe("ZX Spectrum 128K");
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum 128K WASM");
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum 128K TypeScript");
  });
});
