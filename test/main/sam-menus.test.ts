import { describe, expect, it, vi } from "vitest";
import type { MachineMenuItem } from "@common/machines/info-types";

/*
 * The SAM Coupé's Machine menu (`dev/plans/SAM_COUPE_PLAN.md` §11): the tape's items, the number of
 * internal drives with the fitted drives' items, and the hardware switches (the mouse, the ROM version).
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
import { MC_SAM_DRIVES, MC_SAM_MOUSE, MC_SAM_ROM, MI_SAM_COUPE } from "@common/machines/constants";
import { machineMenuRegistry } from "@main/machine-menus/machine-menu-registry";
import { samDiskMenuRenderer, samHardwareRenderer, samTapeMenuRenderer } from "@main/machine-menus/sam-menus";

const sam = machineRegistry.find((m) => m.machineId === MI_SAM_COUPE)!;
const model = sam.models![0];
const ids = (items: MachineMenuItem[]) => items.flatMap((i) => (i.id ? [i.id] : []));
const checked = (items: MachineMenuItem[]) => items.filter((i) => i.checked).map((i) => i.id);

describe("the SAM Coupé's Machine menu", () => {
  it("is registered with its tape, disks, hardware and view items", () => {
    const info = machineMenuRegistry[MI_SAM_COUPE];
    expect(info.devices?.tape).toBe(samTapeMenuRenderer);
    expect(info.devices?.disks).toBe(samDiskMenuRenderer);
    expect(info.hardwareItems).toBe(samHardwareRenderer);
    expect(info.viewItems).toBeDefined();
  });

  it("offers the tape's items", () => {
    expect(ids(samTapeMenuRenderer({ emuWindow: undefined } as any, sam, model))).toEqual(
      expect.arrayContaining(["select_tape_file", "load_tape_program", "rewind_tape", "eject_tape"])
    );
  });

  it("offers one drive by default, and the drives' items for the drives fitted", () => {
    const one = samDiskMenuRenderer({ emuWindow: undefined } as any, sam, model, {});
    expect(checked(one)).toEqual(["sam_drives_1"]);
    expect(ids(one)).toEqual(expect.arrayContaining(["insert_disk_a", "protect_disk_a"]));
    expect(ids(one)).not.toContain("insert_disk_b");
    expect(ids(one)).not.toContain("create_disk_file");

    const two = samDiskMenuRenderer({ emuWindow: undefined } as any, sam, model, { [MC_SAM_DRIVES]: 2 });
    expect(checked(two)).toEqual(["sam_drives_2"]);
    expect(ids(two)).toEqual(expect.arrayContaining(["insert_disk_a", "insert_disk_b", "protect_disk_b"]));

    const none = samDiskMenuRenderer({ emuWindow: undefined } as any, sam, model, { [MC_SAM_DRIVES]: 0 });
    expect(ids(none)).toEqual(["sam_drives_0", "sam_drives_1", "sam_drives_2"]);
  });

  it("offers the mouse and the ROM version", () => {
    const items = samHardwareRenderer({} as any, sam, model, {});
    expect(ids(items)).toEqual(["sam_mouse", "sam_rom_30", "sam_rom_31"]);
    expect(checked(items)).toEqual(["sam_mouse", "sam_rom_30"]);
    expect(checked(samHardwareRenderer({} as any, sam, model, { [MC_SAM_MOUSE]: false, [MC_SAM_ROM]: "31" }))).toEqual(["sam_rom_31"]);
  });
});
