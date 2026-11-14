import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The application menu while a floating document window has the focus
 * (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.6). On macOS the menu's submenus are filled only for
 * the focused window: a focused floating window used to leave the whole menu bar empty, and its
 * accelerators with it. Elsewhere each window has its own menu, and a floating window had none.
 */

const env = vi.hoisted(() => ({
  darwin: true,
  floats: [] as { slot: number; window: any }[],
  built: [] as any[],
  appMenus: [] as any[]
}));

vi.mock("electron", () => ({
  app: { name: "Klive", getPath: () => "/tmp", getVersion: () => "1.0" },
  dialog: {},
  shell: { openExternal: vi.fn() },
  Menu: {
    buildFromTemplate: (template: any) => {
      const menu = { template: template.map((i: any) => ({ label: i.label, submenu: i.submenu })) };
      env.built.push(menu);
      return menu;
    },
    setApplicationMenu: (menu: any) => env.appMenus.push(menu)
  },
  BrowserWindow: class {
    static getFocusedWindow() {
      return null;
    }
  }
}));
vi.mock("@main/electron-utils", () => ({
  get __DARWIN__() {
    return env.darwin;
  },
  __WIN32__: false,
  __LINUX__: false
}));
vi.mock("@main/main-store", () => ({
  mainStore: { getState: () => ({ theme: "dark", ideFocused: true, emulatorState: { machineId: "sp48" } }), dispatch: vi.fn() }
}));
vi.mock("@main/projects", () => ({ saveKliveProject: vi.fn(), openFolder: vi.fn(), openFolderByPath: vi.fn() }));
vi.mock("@main/settings-utils", async () => {
  const { KliveGlobalSettings } = await import("@common/settings/setting-definitions");
  return {
    appSettings: {},
    saveAppSettings: vi.fn(),
    getSettingDefinition: (id: string) => KliveGlobalSettings[id] ?? null,
    getSettingValue: (id: string) => KliveGlobalSettings[id]?.defaultValue,
    setSettingValue: vi.fn()
  };
});
vi.mock("@main/index", () => ({
  isEmuWindowFocused: () => false,
  isIdeWindowFocused: () => true,
  isIdeWindowVisible: () => true,
  showIdeWindow: vi.fn(),
  hideIdeWindow: vi.fn(),
  focusEmuWindow: vi.fn(),
  getAppWindows: () => ({})
}));
vi.mock("@main/floating-windows-host", () => ({
  getFloatingWindows: () => ({
    windows: env.floats,
    getFocusedWindow: () => env.floats.find((f) => f.window.isFocused())?.window
  })
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

import { invalidateMenuCache, setupMenu } from "@main/app-menu";

function win(focused: boolean) {
  return {
    isDestroyed: () => false,
    isFullScreen: () => false,
    isFocused: () => focused,
    setMenu: vi.fn()
  } as any;
}

const filled = (menu: any) => menu.template.filter((i: any) => Array.isArray(i.submenu) && i.submenu.length > 0).length;

beforeEach(() => {
  env.built = [];
  env.appMenus = [];
  env.floats = [];
  invalidateMenuCache();
});

describe("the menu while a floating window has the focus", () => {
  it("macOS: is complete, not empty", () => {
    env.darwin = true;
    env.floats = [{ slot: 1, window: win(true) }];
    setupMenu(win(false), win(false));
    const menu = env.appMenus.at(-1);
    expect(menu).toBeDefined();
    expect(filled(menu)).toBeGreaterThan(3);
  });

  it("macOS: stays empty when no window of the app has the focus, as before", () => {
    env.darwin = true;
    env.floats = [{ slot: 1, window: win(false) }];
    setupMenu(win(false), win(false));
    expect(filled(env.appMenus.at(-1))).toBe(0);
  });

  it("Windows and Linux: every floating window gets the menu, filled while it has the focus", () => {
    env.darwin = false;
    const focused = win(true);
    const other = win(false);
    env.floats = [
      { slot: 1, window: focused },
      { slot: 2, window: other }
    ];
    setupMenu(win(false), win(false));
    expect(focused.setMenu).toHaveBeenCalledTimes(1);
    expect(other.setMenu).toHaveBeenCalledTimes(1);
    expect(filled(focused.setMenu.mock.calls[0][0])).toBeGreaterThan(3);
    expect(filled(other.setMenu.mock.calls[0][0])).toBe(0);
  });
});
