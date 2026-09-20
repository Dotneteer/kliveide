import { describe, expect, it } from "vitest";

import createAppStore from "@state/store";
import { setMachineConfigAction } from "@state/actions";
import { getMachineName, machineRegistry, resolveModelId } from "@common/machines/machine-registry";
import { createMachineService } from "@renderer/appEmu/MachineService";
import { ResolvingMessenger } from "../harness/z88";
import { machineRendererRegistry } from "@common/machines/machine-renderer-registry";
import { createModelTwins } from "@common/machines/model-twins";
import { MC_SCREEN_SIZE, MC_Z88_IMPLEMENTATION, MC_Z88_INTRAM, MC_Z88_SLOT0, MC_Z88_SLOT2 } from "@common/machines/constants";
import {
  DEFAULT_Z88_IMPLEMENTATION,
  getZ88Implementation,
  Z88_IMPLEMENTATION
} from "@emu/machines/z88/Z88Implementation";
import { createZ88Machine } from "@emu/machines/z88/Z88MachineFactory";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";
import { Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";
import { configWithSlot0 } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardModel";
import { applyCardStateChange } from "@renderer/appEmu/machines/z88Cards";

/*
 * The Cambridge Z88 backend switch, its factory and the model twins of the comparison period
 * (Steps 3, 9 and 14 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`): WASM is the default, and the
 * "Cambridge Z88 (TypeScript)" twins keep the TypeScript backend in the machine menu.
 */

const z88Entry = () => machineRegistry.find((m) => m.machineId === "z88");

/** The original models: the ones that select no backend and have no menu group */
const z88Models = () => z88Entry().models.filter((m) => m.menuGroup === undefined);

/** The twins the registry holds since Step 14 */
const tsTwins = () =>
  createModelTwins(z88Models(), {
    configKey: MC_Z88_IMPLEMENTATION,
    implementation: "typescript",
    menuGroup: "Cambridge Z88 (TypeScript)",
    idSuffix: "-ts",
    nameSuffix: " - TypeScript"
  });

/** Twins selecting WASM explicitly: the "WASM preview" group of Steps 9-13, now a saved-project alias */
const wasmTwins = () =>
  createModelTwins(z88Models(), {
    configKey: MC_Z88_IMPLEMENTATION,
    implementation: "wasm",
    menuGroup: "Cambridge Z88 (WASM preview)",
    idSuffix: "-wasm",
    nameSuffix: " - WASM preview"
  });

describe("Cambridge Z88 implementation selection", () => {
  it("the switch key is z88Implementation, and WASM is the default since Step 14", () => {
    expect(Z88_IMPLEMENTATION).toBe("z88Implementation");
    expect(MC_Z88_IMPLEMENTATION).toBe(Z88_IMPLEMENTATION);
    expect(DEFAULT_Z88_IMPLEMENTATION).toBe("wasm");
    expect(getZ88Implementation()).toBe("wasm");
    expect(createZ88Machine()).toBeInstanceOf(Z88WasmV2Machine);
  });

  it("selects the WASM backend when the configuration asks for it", () => {
    const machine = createZ88Machine(undefined, { [Z88_IMPLEMENTATION]: "wasm" });
    expect(machine).toBeInstanceOf(Z88WasmV2Machine);
    expect((machine as Z88WasmV2Machine).implementation).toBe("wasm");
  });

  it("selects the TypeScript backend when the configuration asks for it", () => {
    const machine = createZ88Machine(undefined, { [Z88_IMPLEMENTATION]: "typescript" });
    expect(machine).toBeInstanceOf(Z88Machine);
    expect(machine).not.toBeInstanceOf(Z88WasmV2Machine);
  });

  it.each(["native", "", 42, null])("an unknown selection (%j) uses the default", (value) => {
    expect(getZ88Implementation({ [Z88_IMPLEMENTATION]: value })).toBe(DEFAULT_Z88_IMPLEMENTATION);
  });

  it("falls back to the model's selection key by key, when the configuration lacks the key", () => {
    const twin = tsTwins()[0];
    // --- A configuration rebuilt without the key (e.g. a dialog's) keeps the model's backend
    const rebuilt = { [MC_Z88_INTRAM]: 0x07 };
    expect(getZ88Implementation(rebuilt, twin)).toBe("typescript");
    expect(createZ88Machine(twin, rebuilt)).toBeInstanceOf(Z88Machine);
    // --- An explicit selection in the configuration wins
    expect(getZ88Implementation({ [Z88_IMPLEMENTATION]: "wasm" }, twin)).toBe("wasm");
  });

  it("passes the model and configuration to the WASM machine", () => {
    const twin = wasmTwins()[2];
    const config = { ...twin.config, [MC_SCREEN_SIZE]: "640x480" };
    const machine = createZ88Machine(twin, config) as Z88WasmV2Machine;
    expect(machine.modelInfo).toBe(twin);
    expect(machine.config).toBe(config);
    expect(machine.internalRam.sizeInBytes).toBe(0x2_0000);
  });

  it("the renderer creates the Z88 through the factory", () => {
    const factory = machineRendererRegistry.find((r) => r.machineId === "z88").factory;
    const model = z88Models()[0];
    expect(factory(undefined, model, model.config, undefined)).toBeInstanceOf(Z88WasmV2Machine);
    const twin = tsTwins()[0];
    expect(factory(undefined, twin, twin.config, undefined)).toBeInstanceOf(Z88Machine);
  });
});

describe("Cambridge Z88 backend selection survives the configuration paths", () => {
  // --- A TypeScript twin: losing the key would switch it to the default (WASM) without a word
  const twin = () => tsTwins()[0];

  it("the slot-0 card dialog (configWithSlot0)", () => {
    const config = configWithSlot0(twin().config, { size: 512, cardType: "AMDF29F040B", file: "x" } as any);
    expect(config[Z88_IMPLEMENTATION]).toBe("typescript");
    expect(config[MC_Z88_SLOT0]).toMatchObject({ cardType: "AMDF29F040B" });
  });

  it("card hot-plug (applyCardStateChange)", async () => {
    const store = createAppStore("emu");
    store.dispatch(setMachineConfigAction({ ...twin().config }), "emu");
    const machine: { dynamicConfig?: unknown; configure: () => Promise<void> } = { configure: async () => {} };
    await applyCardStateChange(store, { machine } as any, "slot2", { size: 32, cardType: "RAM32" } as any);
    const config = store.getState().emulatorState.config;
    expect(config[Z88_IMPLEMENTATION]).toBe("typescript");
    expect(config[MC_Z88_SLOT2]).toMatchObject({ cardType: "RAM32" });
    expect(machine.dynamicConfig).toEqual(config);
  });

  it("the RAM dialog and the LCD menu (a spread of the current or model configuration)", () => {
    // --- Z88ChangeRamController: { ...state.env.config, [MC_Z88_INTRAM]: ramMask }
    expect(getZ88Implementation({ ...twin().config, [MC_Z88_INTRAM]: 0x07 }, twin())).toBe("typescript");
    // --- z88LcdRenderer: getModelConfig(machineId, modelId) + MC_SCREEN_SIZE
    expect(getZ88Implementation({ ...twin().config, [MC_SCREEN_SIZE]: "640x320" }, twin())).toBe("typescript");
  });
});

describe("Cambridge Z88 models", () => {
  it("the registered models follow the default backend: none selects one", () => {
    for (const model of z88Models()) {
      expect(model.config[Z88_IMPLEMENTATION], model.modelId).toBeUndefined();
      expect(model.menuGroup, model.modelId).toBeUndefined();
    }
  });

  it("the TypeScript twins are registered after the originals, one per model", () => {
    const all = z88Entry().models;
    const originals = z88Models();
    expect(originals.map((m) => m.modelId)).toEqual([
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
    expect(all).toEqual([...originals, ...tsTwins()]);
  });

  it("each registered twin creates the TypeScript machine, each original the WASM one", () => {
    const factory = machineRendererRegistry.find((r) => r.machineId === "z88").factory;
    for (const model of z88Entry().models) {
      const machine = factory(undefined, model, model.config, undefined);
      expect(machine, model.modelId).toBeInstanceOf(model.menuGroup ? Z88Machine : Z88WasmV2Machine);
    }
  });

  it("twins select their backend, keep the original configuration and join one menu group", () => {
    const models = z88Models();
    const twins = tsTwins();
    expect(twins).toHaveLength(models.length);
    twins.forEach((twin, i) => {
      expect(twin.modelId).toBe(`${models[i].modelId}-ts`);
      expect(twin.displayName).toBe(`${models[i].displayName} - TypeScript`);
      expect(twin.menuGroup).toBe("Cambridge Z88 (TypeScript)");
      expect(twin.config).toEqual({ ...models[i].config, [Z88_IMPLEMENTATION]: "typescript" });
      // --- The original is not touched
      expect(models[i].config[Z88_IMPLEMENTATION]).toBeUndefined();
    });
  });
});

describe("Cambridge Z88: the WASM preview model ids of Steps 9-13", () => {
  it("each resolves to its original, which now runs on WASM", () => {
    for (const model of z88Models()) {
      expect(resolveModelId("z88", `${model.modelId}-wasm`)).toBe(model.modelId);
      expect(getMachineName("z88", `${model.modelId}-wasm`)).toBe(model.displayName);
    }
    expect(z88Entry().models.some((m) => m.modelId.endsWith("-wasm"))).toBe(false);
  });

  it("other ids and other machines are left alone", () => {
    expect(resolveModelId("z88", "OZ50")).toBe("OZ50");
    expect(resolveModelId("z88", "OZ50-ts")).toBe("OZ50-ts");
    expect(resolveModelId("z88", undefined)).toBeUndefined();
    expect(resolveModelId("sp48", "OZ50-wasm")).toBe("OZ50-wasm");
  });

  it("a project saved with a preview model opens on its original, keeping its configuration", async () => {
    const store = createAppStore("emu");
    const service = createMachineService(store, new ResolvingMessenger(), "emu");
    const saved = { ...wasmTwins()[0].config };
    // --- The machine is created, not set up: the test checks what the service resolves
    const factory = machineRendererRegistry.find((r) => r.machineId === "z88")!;
    const originalFactory = factory.factory;
    const created: unknown[] = [];
    factory.factory = (s, model, config, messenger) => {
      created.push([model?.modelId, config]);
      return { setMachineProperty() {}, setup: async () => {}, hardReset: async () => {}, dispose() {} } as any;
    };
    try {
      await service.setMachineType("z88", "OZ50-wasm", saved);
    } catch {
      /* --- the stub machine cannot run a controller; the resolution happened before */
    } finally {
      factory.factory = originalFactory;
    }
    expect(created[0]).toEqual(["OZ50", saved]);
  });
});
