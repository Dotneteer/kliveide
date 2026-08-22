import {
  DEFAULT_ZXNEXT_IMPLEMENTATION,
  ZXNEXT_IMPLEMENTATION
} from "@emu/machines/zxNext/ZxNextImplementation";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import { MC_ZXNEXT_IMPLEMENTATION } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

describe("ZX Spectrum Next implementation selection", () => {
  it("uses the WASM implementation as the rollout default", () => {
    expect(DEFAULT_ZXNEXT_IMPLEMENTATION).toBe("wasm");
    expect(createZxNextMachine()).toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("selects the TypeScript implementation when requested", () => {
    const machine = createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "typescript" });

    expect(machine).toBeInstanceOf(ZxNextMachine);
    expect(machine).not.toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("selects the WASM backend when requested", () => {
    const machine = createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxNextWasmV2Machine);
    expect((machine as ZxNextWasmV2Machine).implementation).toBe("wasm");
  });

  it("uses the centralized WASM default for unknown selections", () => {
    const machine = createZxNextMachine(undefined, {
      [ZXNEXT_IMPLEMENTATION]: "native"
    } as any);

    expect(machine).toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("keeps the machine registry product-oriented", () => {
    const machine = machineRegistry.find(machine => machine.machineId === "zxnext");
    const models = machine?.models ?? [];

    expect(machine?.displayName).toBe("ZX Spectrum Next");
    expect(models.map(model => model.displayName)).toEqual([
      "ZX Spectrum Next",
      "ZX Spectrum Next Compatibility"
    ]);
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum Next TypeScript");
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum Next WASM");
  });

  it("keeps the TypeScript compatibility fallback reachable as the oracle", () => {
    const machine = machineRegistry.find(machine => machine.machineId === "zxnext");
    const models = machine?.models ?? [];
    const wasmModels = models.filter(model => model.config[MC_ZXNEXT_IMPLEMENTATION] === "wasm");
    const oracleModels = models.filter(model => model.config[MC_ZXNEXT_IMPLEMENTATION] === "typescript");
    const fallbackMachine = createZxNextMachine(undefined, {
      [ZXNEXT_IMPLEMENTATION]: "typescript"
    });

    expect(wasmModels.map(model => model.modelId)).toEqual(["standard"]);
    expect(oracleModels.map(model => model.modelId)).toEqual(["compatibility"]);
    expect(fallbackMachine).toBeInstanceOf(ZxNextMachine);
    expect(fallbackMachine).not.toBeInstanceOf(ZxNextWasmV2Machine);
  });
});
