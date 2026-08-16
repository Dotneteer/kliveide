import {
  DEFAULT_ZXNEXT_IMPLEMENTATION,
  getZxNextImplementation,
  ZXNEXT_IMPLEMENTATION
} from "@emu/machines/zxNext/ZxNextImplementation";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import { machineRegistry } from "@common/machines/machine-registry";
import { machineRendererRegistry } from "@common/machines/machine-renderer-registry";
import { describe, expect, it } from "vitest";
import { MI_ZXNEXT } from "@common/machines/constants";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

describe("ZX Spectrum Next implementation selection", () => {
  it("keeps the TypeScript implementation as the rollout default", () => {
    expect(DEFAULT_ZXNEXT_IMPLEMENTATION).toBe("typescript");
    expect(getZxNextImplementation()).toBe("typescript");
    expect(createZxNextMachine()).toBeInstanceOf(ZxNextMachine);
  });

  it("selects the TypeScript implementation when requested", () => {
    const machine = createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "typescript" });

    expect(getZxNextImplementation({ [ZXNEXT_IMPLEMENTATION]: "typescript" })).toBe("typescript");
    expect(machine).toBeInstanceOf(ZxNextMachine);
  });

  it("selects the WASM skeleton when requested", () => {
    const machine = createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "wasm" });

    expect(getZxNextImplementation({ [ZXNEXT_IMPLEMENTATION]: "wasm" })).toBe("wasm");
    expect(machine).toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("uses the centralized default for unknown selections", () => {
    const machine = createZxNextMachine(undefined, {
      [ZXNEXT_IMPLEMENTATION]: "native"
    } as any);

    expect(getZxNextImplementation({ [ZXNEXT_IMPLEMENTATION]: "native" } as any)).toBe(
      DEFAULT_ZXNEXT_IMPLEMENTATION
    );
    expect(machine).toBeInstanceOf(ZxNextMachine);
  });

  it("uses explicit config before model config", () => {
    const model = {
      modelId: "ks2",
      displayName: "ZX Spectrum Next",
      config: { [ZXNEXT_IMPLEMENTATION]: "wasm" }
    };

    expect(getZxNextImplementation(model.config)).toBe("wasm");
    expect(createZxNextMachine(model, { [ZXNEXT_IMPLEMENTATION]: "typescript" })).toBeInstanceOf(
      ZxNextMachine
    );
  });

  it("routes the renderer registry through the centralized factory", () => {
    const rendererInfo = machineRendererRegistry.find(machine => machine.machineId === MI_ZXNEXT);

    expect(rendererInfo?.factory({} as any, undefined, { [ZXNEXT_IMPLEMENTATION]: "wasm" })).toBeInstanceOf(
      ZxNextWasmV2Machine
    );
  });

  it("keeps the machine registry product-oriented", () => {
    const machine = machineRegistry.find(machine => machine.machineId === MI_ZXNEXT);

    expect(machine?.displayName).toBe("ZX Spectrum Next");
    expect(machine?.models?.map(model => model.displayName) ?? []).not.toEqual(
      expect.arrayContaining(["ZX Spectrum Next WASM", "ZX Spectrum Next TypeScript"])
    );
  });
});
