import { createZxSpectrumP3eMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory";
import { MC_DISK_SUPPORT, MC_SP3_ROM_SET } from "@common/machines/constants";
import { getModelConfig, machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";

describe("ZX Spectrum +2E/+3E implementation selection", () => {
  it("uses the WASM implementation by default", () => {
    expect(createZxSpectrumP3eMachine()).toBeInstanceOf(ZxSpectrumP3eWasmV2Machine);
  });

  it("preserves model disk support", () => {
    const model = machineRegistry
      .find(machine => machine.machineId === "spp3e")
      ?.models.find(model => model.modelId === "fdd2");

    const machine = createZxSpectrumP3eMachine(model);

    expect(machine).toBeInstanceOf(ZxSpectrumP3eWasmV2Machine);
    expect(machine.config[MC_DISK_SUPPORT]).toBe(2);
  });

  it("keeps the machine registry product-oriented", () => {
    const machine = machineRegistry.find(machine => machine.machineId === "spp3e");
    const models = machine?.models ?? [];

    expect(machine?.displayName).toBe("ZX Spectrum +2A/+3/+2E/+3E");
    expect(models.map(model => model.modelId)).toEqual([
      "nofdd",
      "fdd1",
      "fdd2",
      "plus2a",
      "plus2a-es",
      "plus3-fdd1",
      "plus3-fdd2",
      "plus3-v40-fdd1",
      "plus3-v40-fdd2",
      "plus3-es-fdd1",
      "plus3-es-fdd2"
    ]);
    expect(models.map(model => model.displayName)).toEqual([
      "ZX Spectrum +2E",
      "ZX Spectrum +3E (1 FDD)",
      "ZX Spectrum +3E (2 FDDs)",
      "ZX Spectrum +2A",
      "ZX Spectrum +2A (Spanish)",
      "ZX Spectrum +3 (1 FDD)",
      "ZX Spectrum +3 (2 FDDs)",
      "ZX Spectrum +3 v4.0 (1 FDD)",
      "ZX Spectrum +3 v4.0 (2 FDDs)",
      "ZX Spectrum +3 (Spanish, 1 FDD)",
      "ZX Spectrum +3 (Spanish, 2 FDDs)"
    ]);
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum +3E WASM");
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum +3E TypeScript");
  });

  it.each([
    ["nofdd", "spp3e", 0],
    ["fdd2", "spp3e", 2],
    ["plus2a", "spp3-41", 0],
    ["plus2a-es", "spp3-41es", 0],
    ["plus3-fdd1", "spp3-41", 1],
    ["plus3-v40-fdd2", "spp3-40", 2],
    ["plus3-es-fdd2", "spp3-41es", 2]
  ])("%s boots roms/%s-0..3.rom with %i drive(s)", (modelId, romId, drives) => {
    const model = machineRegistry.find(m => m.machineId === "spp3e")!.models!.find(m => m.modelId === modelId)!;
    const machine = createZxSpectrumP3eMachine(model);
    expect(machine.romId).toBe(romId);
    expect(machine.config[MC_DISK_SUPPORT]).toBe(drives);
  });

  it("records the ROM set in the model configuration a new project stores", () => {
    expect(getModelConfig("spp3e", "plus3-fdd1")).toEqual({ [MC_DISK_SUPPORT]: 1, [MC_SP3_ROM_SET]: "amstrad41" });
    expect(getModelConfig("spp3e", "plus2a-es")).toEqual({ [MC_DISK_SUPPORT]: 0, [MC_SP3_ROM_SET]: "amstrad41es" });
    expect(getModelConfig("spp3e", "fdd2")).toEqual({ [MC_DISK_SUPPORT]: 2, [MC_SP3_ROM_SET]: "plus3e" });
  });

  it("boots the +3E ROMs when the configuration names no ROM set (projects from before)", () => {
    const machine = createZxSpectrumP3eMachine(undefined, { [MC_DISK_SUPPORT]: 1 });
    expect(machine.romId).toBe("spp3e");
    expect(machine.romSet.id).toBe("plus3e");
  });

  it("a project's configuration overrides the model's ROM set", () => {
    const model = machineRegistry.find(m => m.machineId === "spp3e")!.models!.find(m => m.modelId === "fdd1")!;
    const machine = createZxSpectrumP3eMachine(model, { [MC_DISK_SUPPORT]: 1, [MC_SP3_ROM_SET]: "amstrad40" });
    expect(machine.romId).toBe("spp3-40");
  });
});
