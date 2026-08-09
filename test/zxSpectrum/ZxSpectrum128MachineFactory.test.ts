import {
  DEFAULT_SP128_IMPLEMENTATION,
  SP128_IMPLEMENTATION
} from "@emu/machines/zxSpectrum128/ZxSpectrum128Implementation";
import { createZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory";
import { machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";

describe("ZX Spectrum 128K implementation selection", () => {
  it("uses the WASM implementation as the rollout default", () => {
    expect(DEFAULT_SP128_IMPLEMENTATION).toBe("wasm");
    expect(createZxSpectrum128Machine()).toBeInstanceOf(ZxSpectrum128Machine);
    expect(createZxSpectrum128Machine()).toBeInstanceOf(ZxSpectrum128WasmV2Machine);
  });

  it("selects the TypeScript implementation when requested", () => {
    const machine = createZxSpectrum128Machine(undefined, { [SP128_IMPLEMENTATION]: "typescript" });

    expect(machine).toBeInstanceOf(ZxSpectrum128Machine);
    expect(machine).not.toBeInstanceOf(ZxSpectrum128WasmV2Machine);
  });

  it("selects the WASM implementation when requested", () => {
    const machine = createZxSpectrum128Machine(undefined, { [SP128_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxSpectrum128WasmV2Machine);
    expect(machine.implementation).toBe("wasm");
  });

  it("uses the centralized default for unknown selections", () => {
    const machine = createZxSpectrum128Machine(undefined, {
      [SP128_IMPLEMENTATION]: "native"
    } as any);

    expect(machine).toBeInstanceOf(ZxSpectrum128Machine);
    expect(machine).toBeInstanceOf(ZxSpectrum128WasmV2Machine);
  });

  it("keeps the machine registry product-oriented", () => {
    const machine = machineRegistry.find(machine => machine.machineId === "sp128");
    const models = machine?.models ?? [];

    expect(machine?.displayName).toBe("ZX Spectrum 128K");
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum 128K WASM");
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum 128K TypeScript");
  });
});
