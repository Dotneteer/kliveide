import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";

/*
 * The Z88 "LCD resolution" menu rebuilds the machine with the chosen LCD size. It must not change the
 * machine registry while doing so: `getModelConfig` used to hand out the registered model's own config
 * object, the handler assigned `MC_SCREEN_SIZE` into it, and from then on every use of that model -
 * switching to it again, creating a project for it - carried the last chosen size.
 */

const { getState, dispatch, setMachineType, saveKliveProject } = vi.hoisted(() => ({
  getState: vi.fn(),
  dispatch: vi.fn(),
  setMachineType: vi.fn(() => Promise.resolve(true)),
  saveKliveProject: vi.fn(() => Promise.resolve())
}));

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp") },
  BrowserWindow: vi.fn(),
  dialog: {}
}));
vi.mock("@main/main-store", () => ({ mainStore: { getState, dispatch } }));
vi.mock("@main/projects", () => ({ saveKliveProject }));
vi.mock("@main/registeredMachines", () => ({ setMachineType }));
vi.mock("@main/settings-utils", () => ({ getSettingValue: vi.fn(), setSettingValue: vi.fn() }));
vi.mock("@common/messaging/MainToEmuMessenger", () => ({ getEmuApi: vi.fn() }));

import { machineRegistry, getModelConfig } from "@common/machines/machine-registry";
import { MC_SCREEN_SIZE, MC_Z88_INTRAM } from "@common/machines/constants";
import { z88LcdRenderer } from "@main/machine-menus/z88-menus";

function lcdItem(label: string): MenuItemConstructorOptions {
  const [lcdMenu] = z88LcdRenderer({} as any, undefined, undefined);
  const item = (lcdMenu.submenu as MenuItemConstructorOptions[]).find((i) => i.label === label);
  if (!item) throw new Error(`No LCD menu item '${label}'`);
  return item;
}

const oz40 = () => machineRegistry.find((m) => m.machineId === "z88").models.find((m) => m.modelId === "OZ40");

describe("Z88 LCD resolution menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getState.mockReturnValue({ emulatorState: { machineId: "z88", modelId: "OZ40", config: {} } });
  });

  it("rebuilds the machine with the chosen LCD size and the rest of the model's configuration", async () => {
    await lcdItem("640 x 480").click!({} as any, undefined, {} as any);

    expect(setMachineType).toHaveBeenCalledTimes(1);
    const [machineId, modelId, config] = setMachineType.mock.calls[0] as unknown as [string, string, any];
    expect([machineId, modelId]).toEqual(["z88", "OZ40"]);
    expect(config).toEqual({ ...oz40().config, [MC_SCREEN_SIZE]: "640x480" });
    expect(saveKliveProject).toHaveBeenCalledTimes(1);
  });

  it("leaves the registered model's configuration unchanged", async () => {
    const before = structuredClone(oz40().config);

    await lcdItem("640 x 480").click!({} as any, undefined, {} as any);
    await lcdItem("640 x 320").click!({} as any, undefined, {} as any);

    expect(oz40().config).toEqual(before);
    expect(oz40().config[MC_SCREEN_SIZE]).toBeUndefined();
    const [, , config] = setMachineType.mock.calls[1] as unknown as [string, string, any];
    expect(config).not.toBe(oz40().config);
  });

  it("keeps every other key of the model's configuration", async () => {
    const model = oz40();
    const original = model.config;
    model.config = { ...original, [MC_Z88_INTRAM]: 0x07 };
    try {
      await lcdItem("640 x 320").click!({} as any, undefined, {} as any);
      const [, , config] = setMachineType.mock.calls[0] as unknown as [string, string, any];
      expect(config).toEqual({ ...original, [MC_Z88_INTRAM]: 0x07, [MC_SCREEN_SIZE]: "640x320" });
      expect(model.config[MC_SCREEN_SIZE]).toBeUndefined();
    } finally {
      model.config = original;
    }
  });
});

describe("getModelConfig", () => {
  it("returns a copy: changing it does not change the registry", () => {
    const config = getModelConfig("z88", "OZ40");
    expect(config).toEqual(oz40().config);
    expect(config).not.toBe(oz40().config);
    config[MC_SCREEN_SIZE] = "800x480";
    expect(oz40().config[MC_SCREEN_SIZE]).toBeUndefined();
  });

  it("answers undefined for an unknown machine or model", () => {
    expect(getModelConfig("no-such-machine", "OZ40")).toBeUndefined();
    expect(getModelConfig("z88", "no-such-model")).toBeUndefined();
  });
});
