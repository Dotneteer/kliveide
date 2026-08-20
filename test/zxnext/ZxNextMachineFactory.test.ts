import {
  DEFAULT_ZXNEXT_IMPLEMENTATION,
  ZXNEXT_IMPLEMENTATION
} from "@emu/machines/zxNext/ZxNextImplementation";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import { machineRegistry } from "@common/machines/machine-registry";
import { describe, expect, it } from "vitest";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

describe("ZX Spectrum Next implementation selection", () => {
  it("keeps the TypeScript implementation as the rollout default", () => {
    expect(DEFAULT_ZXNEXT_IMPLEMENTATION).toBe("typescript");
    expect(createZxNextMachine()).toBeInstanceOf(ZxNextMachine);
    expect(createZxNextMachine()).not.toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("selects the TypeScript implementation when requested", () => {
    const machine = createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "typescript" });

    expect(machine).toBeInstanceOf(ZxNextMachine);
    expect(machine).not.toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("selects the incomplete WASM scaffold only when requested", () => {
    const machine = createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "wasm" });

    expect(machine).toBeInstanceOf(ZxNextWasmV2Machine);
    expect((machine as ZxNextWasmV2Machine).implementation).toBe("wasm");
  });

  it("uses the centralized TypeScript default for unknown selections", () => {
    const machine = createZxNextMachine(undefined, {
      [ZXNEXT_IMPLEMENTATION]: "native"
    } as any);

    expect(machine).toBeInstanceOf(ZxNextMachine);
    expect(machine).not.toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("keeps the machine registry product-oriented", () => {
    const machine = machineRegistry.find(machine => machine.machineId === "zxnext");
    const models = machine?.models ?? [];

    expect(machine?.displayName).toBe("ZX Spectrum Next");
    expect(models.map(model => model.displayName)).toEqual([
      "ZX Spectrum Next",
      "ZX Spectrum Next Preview"
    ]);
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum Next TypeScript");
    expect(models.map(model => model.displayName)).not.toContain("ZX Spectrum Next WASM");
  });
});
