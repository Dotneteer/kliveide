import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";

/*
 * The shape of the application menu (`.plans/MENU_REDESIGN_PLAN.md` §3, §7 Phase 1 step 7): the
 * menus and their first-level items for the machines whose menus differ most, and — because macOS
 * fires an accelerator only for an item that is in the menu — every keyboard shortcut.
 */

const env = vi.hoisted(() => ({
  state: {} as any,
  settings: {} as Record<string, unknown>,
  emuFocused: true,
  ideVisible: true
}));

vi.mock("electron", () => ({
  app: { name: "Klive", getPath: () => "/tmp", getVersion: () => "1.0" },
  dialog: {},
  shell: { openExternal: vi.fn() },
  Menu: {},
  BrowserWindow: class {
    static getFocusedWindow() {
      return null;
    }
  }
}));
vi.mock("@main/electron-utils", () => ({ __DARWIN__: true, __WIN32__: false }));
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => env.state, dispatch: vi.fn() } }));
vi.mock("@main/projects", () => ({ saveKliveProject: vi.fn(), openFolder: vi.fn(), openFolderByPath: vi.fn() }));
vi.mock("@main/settings-utils", async () => {
  const { KliveGlobalSettings } = await import("@common/settings/setting-definitions");
  return {
    appSettings: {},
    saveAppSettings: vi.fn(),
    getSettingDefinition: (id: string) => KliveGlobalSettings[id] ?? null,
    getSettingValue: (id: string) => env.settings[id] ?? KliveGlobalSettings[id]?.defaultValue,
    setSettingValue: vi.fn()
  };
});
vi.mock("@main/index", () => ({
  isEmuWindowFocused: () => env.emuFocused,
  isIdeWindowFocused: () => !env.emuFocused,
  isIdeWindowVisible: () => env.ideVisible,
  showIdeWindow: vi.fn(),
  focusEmuWindow: vi.fn(),
  getAppWindows: () => ({})
}));
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: vi.fn() }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: vi.fn() }));
vi.mock("@main/registeredMachines", () => ({ logEmuEvent: vi.fn(), setMachineType: vi.fn() }));
vi.mock("@main/file-watcher", () => ({ fileChangeWatcher: { stopWatching: vi.fn() } }));
vi.mock("@main/build", () => ({ collectedBuildTasks: [] }));
vi.mock("@main/emu-window-sizing", () => ({ fitEmuWindowToScreen: vi.fn() }));
vi.mock("@main/recording/window-recording/windowRecordingController", () => ({
  toggleWindowRecording: vi.fn()
}));

import { createMenuContext, createMenuTemplate } from "@main/app-menu";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { machineRegistry } from "@common/machines/machine-registry";
import { MC_DISK_SUPPORT } from "@common/machines/constants";

const window = { isDestroyed: () => false, isFullScreen: () => false, isFocused: () => true } as any;

function pentagonModelId(): string {
  const sp128 = machineRegistry.find((m) => m.machineId === "sp128")!;
  return sp128.models!.find((m) => (m.config?.[MC_DISK_SUPPORT] ?? 0) > 0)!.modelId;
}

function buildMenu(machineId: string, modelId?: string, focus: "emu" | "ide" = "emu") {
  env.emuFocused = focus === "emu";
  env.state = {
    ideFocused: focus === "ide",
    theme: "dark",
    emulatorState: {
      machineId,
      modelId,
      machineState: MachineControllerState.Paused,
      clockMultiplier: 1,
      soundLevel: 0.4,
      screenRecordingAvailable: true
    },
    media: {},
    project: {},
    ideView: { volatileDocs: {} }
  };
  return createMenuTemplate(createMenuContext(window, window));
}

const labels = (items: unknown) =>
  ((items as MenuItemConstructorOptions[]) ?? [])
    .filter((i) => i.type !== "separator" && i.visible !== false)
    .map((i) => i.label ?? i.role);

function menu(template: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] {
  const found = template.find((m) => m.label === label);
  if (!found) throw new Error(`No ${label} menu`);
  return found.submenu as MenuItemConstructorOptions[];
}

function submenu(items: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] {
  const found = items.find((m) => m.label === label);
  if (!found) throw new Error(`No ${label} submenu`);
  return found.submenu as MenuItemConstructorOptions[];
}

function accelerators(items: MenuItemConstructorOptions[]): string[] {
  return items.flatMap((i) => [
    ...(i.accelerator && i.visible !== false ? [i.accelerator as string] : []),
    ...(Array.isArray(i.submenu) ? accelerators(i.submenu) : [])
  ]);
}

describe("the application menu", () => {
  beforeEach(() => {
    env.settings = {};
    env.ideVisible = true;
  });

  it("has the menus of the redesign, and no IDE menu", () => {
    expect(buildMenu("sp48").map((m) => m.label)).toEqual([
      "Klive",
      "File",
      "Edit",
      "View",
      "Machine",
      "Debug",
      "Help"
    ]);
  });

  it("opens every emulator file from one File item, without the old duplicates", () => {
    const file = labels(menu(buildMenu("sp48"), "File"));
    expect(file).toContain("Open File...");
    expect(file).not.toContain("Load ZX Spectrum Snapshot...");
    expect(file).not.toContain("Play RZX Recording...");
    expect(file).not.toContain("Load Machine State...");
    expect(file).toEqual([
      "New Project...",
      "Open Folder...",
      "Open File...",
      "Save Snapshot...",
      "Save Machine State...",
      "Quick Save State",
      "Quick Restore State",
      "Close Folder"
    ]);
  });

  it("gives a ZX Spectrum 48K a Tape submenu and RZX in Record", () => {
    const machine = menu(buildMenu("sp48"), "Machine");
    expect(labels(machine)).toEqual([
      "Machine Type",
      "Start",
      "Pause",
      "Stop",
      "Restart",
      "Speed",
      "Sound",
      "Tape",
      "Input",
      "Record"
    ]);
    expect(labels(submenu(machine, "Tape"))).toEqual(["Rewind", "Insert Tape...", "Eject", "Fast load"]);
    expect(labels(submenu(machine, "Record"))).toEqual([
      "Start Video Recording",
      "Pause Video Recording",
      "Start IDE + Emulator recording",
      "RZX: Record",
      "RZX: Stop and Save...",
      "RZX: Insert Rollback Point",
      "RZX: Roll Back",
      "RZX: Render a Recording to Video...",
      "Recording Settings..."
    ]);
  });

  it("gives the Pentagon a Disks submenu that holds the drives directly", () => {
    const machine = menu(buildMenu("sp128", pentagonModelId()), "Machine");
    expect(labels(machine)).toContain("Disks");
    const disks = labels(submenu(machine, "Disks"));
    expect(disks).toContain("Create Disk File...");
    expect(disks).not.toContain("Floppy Disks");
    expect(labels(machine)).not.toContain("TR-DOS ROM");
  });

  it("gives the Next its SD card, input and hardware submenus, and Step Copper in Debug", () => {
    const template = buildMenu("zxnext");
    const machine = menu(template, "Machine");
    expect(labels(machine)).toEqual([
      "Machine Type",
      "Start",
      "Pause",
      "Stop",
      "Restart",
      // --- No Speed: the Next sets its own CPU speed (MF_ALLOW_CLOCK_MULTIPLIER)
      "Sound",
      "SD Card",
      "Input",
      "ZX Spectrum Next",
      "Record"
    ]);
    expect(labels(submenu(machine, "Input"))).toEqual(["Joystick", "Mouse", "Input Settings..."]);
    expect(labels(submenu(machine, "ZX Spectrum Next"))[0]).toMatch(/^F1 /);
    expect(labels(machine)).not.toContain("Layers");
    expect(labels(menu(template, "Debug"))).toContain("Step Copper");
    // --- Every machine with MF_EXEC_HISTORY (EXECUTION_HISTORY_VIEWER_PLAN §4.5): the Next today
    expect(labels(menu(template, "Debug"))).toContain("Execution History");
    expect(labels(menu(buildMenu("sp48"), "Debug"))).not.toContain("Execution History");
    expect(labels(submenu(menu(template, "View"), "Machine Views"))).toEqual([
      "Memory",
      "Disassembly",
      "BASIC Listing",
      "Copper List",
      "Sprite Inspector",
      "Tilemap Inspector",
      "Layer 2 Inspector",
      "Layers"
    ]);
  });

  it("gives the Z88 its hardware actions and help links, and no setup items", () => {
    const template = buildMenu("z88");
    const machine = menu(template, "Machine");
    expect(labels(machine)).not.toContain("Keyboard layout");
    expect(labels(machine)).not.toContain("LCD resolution");
    const hardware = machine.find((i) => i.id === "machine_hardware")!;
    expect(labels(hardware.submenu)).toEqual([
      "Soft Reset",
      "Hard Reset",
      "Press Both SHIFT Keys",
      "Raise Battery Low Signal"
    ]);
    expect(labels(menu(template, "Help"))).toContain("Cambridge Z88 Resources");
  });

  it("keeps no machine's Machine or View menu over twelve first-level items", () => {
    for (const [machineId, modelId] of [
      ["sp48"],
      ["sp128", pentagonModelId()],
      ["zxnext"],
      ["z88"],
      ["zx81"]
    ] as [string, string?][]) {
      for (const focus of ["emu", "ide"] as const) {
        const template = buildMenu(machineId, modelId, focus);
        expect(labels(menu(template, "Machine")).length, `${machineId} Machine`).toBeLessThanOrEqual(12);
        expect(labels(menu(template, "View")).length, `${machineId} View`).toBeLessThanOrEqual(12);
      }
    }
  });

  it("shows the parts of the focused window in View", () => {
    expect(labels(menu(buildMenu("sp48", undefined, "emu"), "View"))).toContain("Virtual Keyboard");
    const ideView = labels(menu(buildMenu("sp48", undefined, "ide"), "View"));
    expect(ideView).toContain("Sidebar");
    expect(ideView).toContain("Command and Output");
    expect(ideView).not.toContain("Virtual Keyboard");
  });

  it("keeps navigation in View for both windows, as its shortcuts work from the emulator", () => {
    expect(labels(menu(buildMenu("sp48", undefined, "emu"), "View"))).toContain("Go Back");
    expect(labels(menu(buildMenu("sp48", undefined, "ide"), "View"))).toContain("Go Forward");
  });

  it("keeps every keyboard shortcut the menu had", () => {
    const keys = (machineId: string) => new Set(buildMenu(machineId).flatMap((m) => accelerators([m])));
    const common = [
      "F5", // Start
      "Shift+F5", // Pause
      "F4", // Stop
      "Shift+F4", // Restart
      "Ctrl+F5", // Start with Debugging
      "F12", // Step Into (macOS)
      "F10", // Step Over
      "Shift+F12", // Step Out (macOS)
      "Shift+F10", // Step Over Line
      "CmdOrCtrl+Shift+M", // Select machine…
      "CmdOrCtrl+Alt+S", // Quick Save State
      "CmdOrCtrl+Alt+L", // Quick Restore State
      "Ctrl+Shift+F7", // IDE + Emulator recording
      "Ctrl+Shift+F9" // Toggle Full Screen
    ];
    for (const key of common) expect(keys("zxnext"), key).toContain(key);
    for (const key of ["F6", "F8", "F9"]) expect(keys("z88"), key).toContain(key);
  });
});
