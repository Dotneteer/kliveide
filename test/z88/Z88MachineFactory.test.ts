import { describe, expect, it } from "vitest";

import createAppStore from "@state/store";
import { getMachineName, machineRegistry, resolveModelId } from "@common/machines/machine-registry";
import { createMachineService } from "@renderer/appEmu/MachineService";
import { ResolvingMessenger } from "../harness/z88";
import { machineRendererRegistry } from "@common/machines/machine-renderer-registry";
import { MC_SCREEN_SIZE } from "@common/machines/constants";
import { createZ88Machine } from "@emu/machines/z88/Z88MachineFactory";
import { Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";

/*
 * The Cambridge Z88 factory and models. The WASM core is the only Z88 emulation since the TypeScript
 * one was removed (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`); the model ids of the comparison
 * period (`<id>-ts`, and the `<id>-wasm` "WASM preview" ids before them) are aliases of the originals,
 * so a saved project or last session that names one still opens.
 */

const z88Entry = () => machineRegistry.find((m) => m.machineId === "z88");
const z88Models = () => z88Entry().models;

/** The configuration key the comparison period's models selected the backend with */
const LEFTOVER_BACKEND_KEY = "z88Implementation";

describe("Cambridge Z88 factory", () => {
  it("creates the WASM machine", () => {
    const machine = createZ88Machine();
    expect(machine).toBeInstanceOf(Z88WasmV2Machine);
    expect(machine.implementation).toBe("wasm");
  });

  it("passes the model and configuration to the machine", () => {
    const model = z88Models()[2];
    const config = { ...model.config, [MC_SCREEN_SIZE]: "640x480" };
    const machine = createZ88Machine(model, config);
    expect(machine.modelInfo).toBe(model);
    expect(machine.config).toBe(config);
    expect(machine.internalRam.sizeInBytes).toBe(0x2_0000);
  });

  it("ignores a leftover backend selection in the configuration", () => {
    expect(createZ88Machine(undefined, { [LEFTOVER_BACKEND_KEY]: "typescript" })).toBeInstanceOf(Z88WasmV2Machine);
  });

  it("the renderer creates every registered model through the factory, on WASM", () => {
    const factory = machineRendererRegistry.find((r) => r.machineId === "z88").factory;
    for (const model of z88Models()) {
      expect(factory(undefined, model, model.config, undefined), model.modelId).toBeInstanceOf(Z88WasmV2Machine);
    }
  });
});

describe("Cambridge Z88 models", () => {
  it("are the ten OZ models, and no backend twins", () => {
    expect(z88Models().map((m) => m.modelId)).toEqual([
      "OZ50",
      "OZ47",
      "OZ40",
      "OZ40FI",
      "OZ30",
      "OZ323IT",
      "OZ326FR",
      "OZ319ES",
      "OZ321DK",
      "OZ318DE"
    ]);
    for (const model of z88Models()) {
      expect(model.config[LEFTOVER_BACKEND_KEY], model.modelId).toBeUndefined();
    }
  });
});

describe("Cambridge Z88: the model ids of the comparison period", () => {
  it.each(["-ts", "-wasm"])("each <id>%s resolves to its original", (suffix) => {
    for (const model of z88Models()) {
      expect(resolveModelId("z88", `${model.modelId}${suffix}`)).toBe(model.modelId);
      expect(getMachineName("z88", `${model.modelId}${suffix}`)).toBe(model.displayName);
    }
    expect(z88Models().some((m) => m.modelId.endsWith(suffix))).toBe(false);
  });

  it("other ids and other machines are left alone", () => {
    expect(resolveModelId("z88", "OZ50")).toBe("OZ50");
    expect(resolveModelId("z88", "OZ50-xx")).toBe("OZ50-xx");
    expect(resolveModelId("z88", undefined)).toBeUndefined();
    expect(resolveModelId("sp48", "OZ50-wasm")).toBe("OZ50-wasm");
    expect(resolveModelId("sp48", "OZ50-ts")).toBe("OZ50-ts");
  });

  it.each([
    ["OZ50-ts", "typescript"],
    ["OZ40-wasm", "wasm"]
  ])("a project saved with %s opens on the original model, keeping its configuration", async (saved, backend) => {
    const store = createAppStore("emu");
    const service = createMachineService(store, new ResolvingMessenger(), "emu");
    const original = saved.replace(/-(ts|wasm)$/, "");
    const savedConfig = { ...z88Models().find((m) => m.modelId === original).config, [LEFTOVER_BACKEND_KEY]: backend };
    // --- The machine is created, not set up: the test checks what the service resolves
    const factory = machineRendererRegistry.find((r) => r.machineId === "z88")!;
    const originalFactory = factory.factory;
    const created: unknown[] = [];
    factory.factory = (s, model, config, messenger) => {
      created.push([model?.modelId, config, originalFactory(s, model, config, messenger)]);
      return { setMachineProperty() {}, setup: async () => {}, hardReset: async () => {}, dispose() {} } as any;
    };
    try {
      await service.setMachineType("z88", saved, savedConfig);
    } catch {
      /* --- the stub machine cannot run a controller; the resolution happened before */
    } finally {
      factory.factory = originalFactory;
    }
    const [modelId, config, machine] = created[0] as [string, unknown, unknown];
    expect([modelId, config]).toEqual([original, savedConfig]);
    // --- The leftover key selects nothing: the real factory made the WASM machine
    expect(machine).toBeInstanceOf(Z88WasmV2Machine);
  });
});
