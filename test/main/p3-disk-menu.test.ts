import { describe, expect, it, vi } from "vitest";
import type { MachineMenuItem } from "@common/machines/info-types";

/*
 * Machine | Floppy Disks on the +2A/+3/+2E/+3E models (`.plans/PLUS3_AMSTRAD_ROMS_PLAN.md` Phase 4):
 * the menu follows the model's drives, so it appears on the Amstrad +3 models and not on the +2As,
 * exactly as on the +3E and the +2E.
 */

vi.mock("electron", () => ({ app: {}, dialog: {}, BrowserWindow: class {} }));
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => ({ media: {} }), dispatch: vi.fn() } }));
vi.mock("@main/projects", () => ({ saveKliveProject: vi.fn() }));
vi.mock("@main/registeredMachines", () => ({ logEmuEvent: vi.fn(), setMachineType: vi.fn() }));
vi.mock("@main/app-menu", () => ({ createBooleanSettingsMenu: vi.fn() }));
vi.mock("@main/settings-utils", () => ({ appSettings: {}, saveAppSettings: vi.fn() }));
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: vi.fn() }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: vi.fn() }));

import { machineRegistry } from "@common/machines/machine-registry";
import { diskMenuRenderer } from "@main/machine-menus/zx-specrum-menus";

const p3 = machineRegistry.find((m) => m.machineId === "spp3e")!;

function driveItems(modelId: string): string[] {
  const model = p3.models!.find((m) => m.modelId === modelId)!;
  const items = diskMenuRenderer({ emuWindow: undefined } as any, p3, model);
  const floppy = items.find((i) => i.id === "floppy_menu");
  return ((floppy?.submenu as MachineMenuItem[]) ?? []).flatMap((i) => (i.id?.startsWith("protect_disk_") ? [i.id] : []));
}

describe("the Floppy Disks menu on the +2A/+3/+2E/+3E", () => {
  it.each([
    ["nofdd", []],
    ["plus2a", []],
    ["plus2a-es", []],
    ["fdd1", ["protect_disk_a"]],
    ["plus3-fdd1", ["protect_disk_a"]],
    ["plus3-es-fdd1", ["protect_disk_a"]],
    ["plus3-v40-fdd2", ["protect_disk_a", "protect_disk_b"]],
    ["fdd2", ["protect_disk_a", "protect_disk_b"]]
  ])("%s has drives %j", (modelId, drives) => {
    expect(driveItems(modelId)).toEqual(drives);
  });
});
