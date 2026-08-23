import { createZxSpectrumP3eMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory";
import { MC_DISK_SUPPORT } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
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

    expect(machine?.displayName).toBe("ZX Spectrum +2E/+3E");
    expect(models.map(model => model.modelId)).toEqual(["nofdd", "fdd1", "fdd2"]);
    expect(models.map(model => model.displayName)).toEqual([
      "ZX Spectrum +2E",
      "ZX Spectrum +3E (1 FDD)",
      "ZX Spectrum +3E (2 FDDs)"
    ]);
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum +3E WASM");
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum +3E TypeScript");
  });
});
