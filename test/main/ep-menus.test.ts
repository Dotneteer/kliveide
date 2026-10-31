import { describe, expect, it, vi } from "vitest";
import type { MachineMenuItem } from "@common/machines/info-types";

/*
 * The Enterprise's Machine menu (`.plans/ENTERPRISE_PLAN.md` §11): the hardware switches (cartridge,
 * FILE: device and its folder, palette), the tape's items, and the EXDOS card's switch with its two
 * drives when the card is fitted.
 */

vi.mock("electron", () => ({ app: { getPath: () => "/tmp" }, dialog: {}, shell: {}, BrowserWindow: class {} }));
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => ({ media: {} }), dispatch: vi.fn() } }));
vi.mock("@main/projects", () => ({ saveKliveProject: vi.fn() }));
vi.mock("@main/registeredMachines", () => ({ logEmuEvent: vi.fn(), setMachineType: vi.fn() }));
vi.mock("@main/menus/menu-utils", () => ({ createBooleanSettingsMenu: vi.fn(() => ({ id: "fast_load" })) }));
vi.mock("@main/settings-utils", () => ({ appSettings: {}, saveAppSettings: vi.fn() }));
vi.mock("@main/portable", () => ({ getKliveHomeBase: () => "/tmp" }));
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: vi.fn() }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: vi.fn() }));

import { machineRegistry } from "@common/machines/machine-registry";
import { MC_EP_EXDOS, MI_ENTERPRISE } from "@common/machines/constants";
import { machineMenuRegistry } from "@main/machine-menus/machine-menu-registry";
import { epDiskMenuRenderer, epHardwareRenderer } from "@main/machine-menus/ep-menus";
import { epTapeMenuRenderer } from "@main/machine-menus/ep-tape-menus";

const ep = machineRegistry.find((m) => m.machineId === MI_ENTERPRISE)!;
const model = ep.models![0];
const ids = (items: MachineMenuItem[]) => items.flatMap((i) => (i.id ? [i.id] : []));

describe("the Enterprise's Machine menu", () => {
  it("is registered with its tape, disks, hardware and view items", () => {
    const info = machineMenuRegistry[MI_ENTERPRISE];
    expect(info.devices?.tape).toBe(epTapeMenuRenderer);
    expect(info.devices?.disks).toBe(epDiskMenuRenderer);
    expect(info.hardwareItems).toBe(epHardwareRenderer);
  });

  it("offers the cartridge, the FILE: device and its folder, and the palette", () => {
    expect(ids(epHardwareRenderer({} as any, ep, model))).toEqual(["ep_cartridge", "ep_hostfs", "ep_hostfs_folder", "ep_linear_palette"]);
  });

  it("offers the tape's items", () => {
    expect(ids(epTapeMenuRenderer({ emuWindow: undefined } as any, ep, model))).toEqual(
      expect.arrayContaining(["select_tape_file", "load_tape_program", "rewind_tape", "eject_tape"])
    );
  });

  it("offers EXDOS alone without the card, and the drives with it", () => {
    expect(ids(epDiskMenuRenderer({ emuWindow: undefined } as any, ep, model))).toEqual(["ep_exdos"]);
    const fitted = ids(epDiskMenuRenderer({ emuWindow: undefined } as any, ep, model, { [MC_EP_EXDOS]: true }));
    expect(fitted[0]).toBe("ep_exdos");
    expect(fitted).toEqual(expect.arrayContaining(["protect_disk_a", "protect_disk_b"]));
  });
});
