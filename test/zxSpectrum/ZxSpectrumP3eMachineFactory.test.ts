import {
  DEFAULT_SPP3E_IMPLEMENTATION,
  SPP3E_IMPLEMENTATION
} from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation";
import { createZxSpectrumP3eMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory";
import { MC_DISK_SUPPORT } from "@common/machines/constants";
import { MEDIA_DISK_A } from "@common/structs/project-const";
import { machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

  it("preserves model disk support when overriding only the implementation", () => {
    const model = machineRegistry
      .find(machine => machine.machineId === "spp3e")
      ?.models.find(model => model.modelId === "fdd2");

    const machine = createZxSpectrumP3eMachine(model, { [SPP3E_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxSpectrumP3eWasmV2Machine);
    expect(machine.config[MC_DISK_SUPPORT]).toBe(2);
    expect(machine.config[SPP3E_IMPLEMENTATION]).toBe("wasm");
  });

  it("keeps TypeScript disk media attached across machine reset", () => {
    const machine = createZxSpectrumP3eMachine(undefined, {
      [SPP3E_IMPLEMENTATION]: "typescript",
      [MC_DISK_SUPPORT]: 2
    }) as ZxSpectrumP3EMachine;
    const disk = new Uint8Array(readFileSync("test/testfiles/blank180K.dsk"));

    machine.setMachineProperty(MEDIA_DISK_A, disk);
    expect(machine.floppyDevice.driveA?.hasDiskLoaded).toBe(true);

    machine.reset();

    expect(machine.getMachineProperty(MEDIA_DISK_A)).toBe(disk);
    expect(machine.floppyDevice.driveA?.hasDiskLoaded).toBe(true);
    expect(machine.floppyDevice.driveA?.contents).toBe(disk);
    expect(machine.floppyDevice.driveA?.motorOn).toBe(false);
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
