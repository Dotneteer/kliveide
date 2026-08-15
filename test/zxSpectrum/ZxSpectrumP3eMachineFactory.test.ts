import {
  DEFAULT_SPP3E_IMPLEMENTATION,
  SPP3E_IMPLEMENTATION
} from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation";
import { createZxSpectrumP3eMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory";
import { machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { ZxSpectrumP3EMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine";
import { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";

describe("ZX Spectrum +2E/+3E implementation selection", () => {
  it("uses the WASM implementation as the rollout default", () => {
    expect(DEFAULT_SPP3E_IMPLEMENTATION).toBe("wasm");
    expect(createZxSpectrumP3eMachine()).toBeInstanceOf(ZxSpectrumP3eWasmV2Machine);
  });

  it("selects the TypeScript implementation when requested", () => {
    const machine = createZxSpectrumP3eMachine(undefined, { [SPP3E_IMPLEMENTATION]: "typescript" });

    expect(machine).toBeInstanceOf(ZxSpectrumP3EMachine);
    expect(machine).not.toBeInstanceOf(ZxSpectrumP3eWasmV2Machine);
  });

  it("selects the WASM implementation when requested", () => {
    const machine = createZxSpectrumP3eMachine(undefined, { [SPP3E_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxSpectrumP3eWasmV2Machine);
    expect(machine.implementation).toBe("wasm");
  });

  it("uses the centralized WASM default for unknown selections", () => {
    const machine = createZxSpectrumP3eMachine(undefined, {
      [SPP3E_IMPLEMENTATION]: "native"
    } as any);

    expect(machine).toBeInstanceOf(ZxSpectrumP3eWasmV2Machine);
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
