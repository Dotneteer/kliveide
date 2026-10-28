import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";

/*
 * Debug › ROM Annotations (`.plans/ROM_ANNOTATIONS_MENU_PLAN.md`): a submenu per machine type with
 * ROMs, in registry order, its ROM sets separated; an item runs `rom-ann-open ... -create` in the IDE.
 */

const env = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  showMessageBox: vi.fn(async () => ({ response: 0 })),
  dispatch: vi.fn()
}));

vi.mock("electron", () => ({ dialog: { showMessageBox: env.showMessageBox } }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: () => ({ executeCommand: env.executeCommand }) }));
vi.mock("@main/main-store", () => ({ mainStore: { dispatch: env.dispatch } }));

import type { MachineInfo } from "@common/machines/info-types";
import { machineRegistry } from "@common/machines/machine-registry";
import { setLanguage } from "@common/i18n/i18n";
import {
  createRomAnnotationsMenu,
  openRomAnnotations,
  ROM_ANNOTATIONS_MENU_ID
} from "@main/menus/rom-annotations-menu";

const submenu = (item: MenuItemConstructorOptions) => item.submenu as MenuItemConstructorOptions[];
const shape = (items: MenuItemConstructorOptions[]) => items.map((i) => (i.type === "separator" ? "---" : i.label));

describe("createRomAnnotationsMenu", () => {
  beforeEach(() => {
    setLanguage("en");
    vi.clearAllMocks();
  });

  it("lists the machine types that have ROMs, in registry order, by their names", () => {
    const menu = createRomAnnotationsMenu(machineRegistry, vi.fn());
    expect(menu.id).toBe(ROM_ANNOTATIONS_MENU_ID);
    expect(menu.label).toBe("ROM Annotations");
    expect(shape(submenu(menu))).toEqual([
      "ZX Spectrum 48K",
      "ZX Spectrum 128K",
      "ZX Spectrum +2A/+3/+2E/+3E",
      "ZX Spectrum Next",
      "Sinclair ZX81",
      "Sinclair ZX80",
      "HT-1080Z",
      "Videoton TVC"
    ]);
  });

  it("separates the ROM sets, and names a page of a multi-page file", () => {
    const menu = createRomAnnotationsMenu(machineRegistry, vi.fn());
    const next = submenu(submenu(menu).find((item) => item.label === "ZX Spectrum Next")!);
    expect(shape(next)).toEqual([
      "enNextZX.rom, page 0",
      "enNextZX.rom, page 1",
      "enNextZX.rom, page 2",
      "enNextZX.rom, page 3",
      "---",
      "enNextLG.rom, page 0",
      "enNextLG.rom, page 1",
      "enNextLG.rom, page 2",
      "enNextLG.rom, page 3",
      "---",
      "enAltZX.rom, page 0",
      "enAltZX.rom, page 1",
      "---",
      "enNxtmmc.rom",
      "enNextMf.rom"
    ]);
    const sp128 = submenu(submenu(menu).find((item) => item.label === "ZX Spectrum 128K")!);
    expect(shape(sp128)).toEqual(["sp128-0.rom", "sp128-1.rom"]);
  });

  it("skips a machine type with no ROMs, and passes the picked page on", async () => {
    const registry: MachineInfo[] = [
      { machineId: "none", displayName: "No ROMs", charSet: {}, features: {} },
      { machineId: "some", displayName: "Some ROMs", charSet: {}, features: {} }
    ];
    const open = vi.fn(async () => {});
    const menu = createRomAnnotationsMenu(registry, open, [
      { machineId: "some", groups: [[{ file: "a.rom" }], [{ file: "b.rom", page: 1 }]] }
    ]);
    expect(shape(submenu(menu))).toEqual(["Some ROMs"]);
    const items = submenu(submenu(menu)[0]);
    expect(items.map((item) => item.id)).toEqual(["rom_ann_some_a.rom", undefined, "rom_ann_some_b.rom_1"]);
    await (items[2].click as any)();
    expect(open).toHaveBeenCalledWith({ file: "b.rom", page: 1 });
  });
});

describe("openRomAnnotations", () => {
  const window = {} as any;

  beforeEach(() => {
    setLanguage("en");
    vi.clearAllMocks();
  });

  it("shows the IDE and runs rom-ann-open with -create", async () => {
    env.executeCommand.mockResolvedValue({ success: true });
    const ensureIdeWindow = vi.fn();
    await openRomAnnotations({ file: "enNextZX.rom", page: 3 }, ensureIdeWindow, window);
    expect(ensureIdeWindow).toHaveBeenCalled();
    expect(env.executeCommand).toHaveBeenCalledWith("rom-ann-open enNextZX.rom -page 3 -create");
    expect(env.showMessageBox).not.toHaveBeenCalled();
  });

  it("says why in a message box when the command fails, with the menu dimmed meanwhile", async () => {
    env.executeCommand.mockResolvedValue({ success: false, finalMessage: "Cannot write the working copy." });
    await openRomAnnotations({ file: "sp48.rom" }, vi.fn(), window);
    expect(env.showMessageBox).toHaveBeenCalledWith(window, {
      type: "error",
      title: "ROM Annotations",
      message: "Cannot write the working copy."
    });
    expect(env.dispatch).toHaveBeenCalledTimes(2);
  });
});
