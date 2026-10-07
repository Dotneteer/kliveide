/*
 * The application menu (`.plans/MENU_REDESIGN_PLAN.md`). Each top-level menu has its own builder in
 * `./menus/`; this module creates the context they read, puts them in order, and installs the result
 * — only when it differs from the menu already installed.
 */
import { BrowserWindow, Menu, MenuItem, MenuItemConstructorOptions, dialog } from "electron";

import { __DARWIN__ } from "./electron-utils";
import { mainStore } from "./main-store";
import { dimMenuAction } from "@state/actions";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { readNavigationShortcuts } from "@common/utils/navigationShortcuts";
import { readRecordIdeEmuShortcut } from "@common/utils/recordingShortcuts";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { machineRegistry } from "@common/machines/machine-registry";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { machineMenuRegistry } from "./machine-menus/machine-menu-registry";
import { collectedBuildTasks } from "./build";
import { openMachineSelector, openSettingsDialog, selectMachineType } from "./ui-actions";
import { isEmuWindowFocused, isIdeWindowVisible, showIdeWindow } from ".";
import type { MenuContext } from "./menus/menu-context";
import { createFileMenu } from "./menus/file-menu";
import { createViewMenu } from "./menus/view-menu";
import { createMachineMenu } from "./menus/machine-menu";
import { createDebugMenu } from "./menus/debug-menu";
import { createAppMenu, createHelpMenu, SYSTEM_MENU_ID } from "./menus/help-menu";

/**
 * Creates the context the menu builders read
 */
export function createMenuContext(emuWindow: BrowserWindow, ideWindow: BrowserWindow): MenuContext {
  const appState = mainStore.getState();
  const machineId = appState?.emulatorState?.machineId;
  const modelId = appState?.emulatorState?.modelId;
  const currentMachine = machineRegistry.find((m) => m.machineId === machineId);
  const currentModel = currentMachine?.models?.find((m) => m.modelId === modelId);
  const settingsReader = createSettingsReader(appState);
  const devToolsValue = settingsReader.readSetting("devTools.allow");
  const navigationShortcuts = readNavigationShortcuts(appState, __DARWIN__);
  const ideFocus = !!appState?.ideFocused;

  return {
    appState,
    emuWindow,
    ideWindow,
    isMac: __DARWIN__,
    ideFocus,
    emuWindowFocused: isEmuWindowFocused(),
    ideWindowVisible: isIdeWindowVisible(),
    allowDevTools: devToolsValue === "1" || devToolsValue === "true",
    currentMachine,
    currentModel,
    machineMenus: machineMenuRegistry[machineId],
    shortcuts: {
      fullScreen: settingsReader.readSetting("shortcuts.fullScreen") ?? "Ctrl+Shift+F9",
      stepInto: settingsReader.readSetting("shortcuts.stepInto") ?? (__DARWIN__ ? "F12" : "F11"),
      stepOver: settingsReader.readSetting("shortcuts.stepOver") ?? "F10",
      stepOut:
        settingsReader.readSetting("shortcuts.stepOut") ?? (__DARWIN__ ? "Shift+F12" : "Shift+F11"),
      stepOverLine: settingsReader.readSetting("shortcuts.stepOverLine") ?? "Shift+F10",
      navBack: navigationShortcuts.back,
      navForward: navigationShortcuts.forward,
      recordIdeEmu: readRecordIdeEmuShortcut(appState)
    },
    focusedWindow: () => BrowserWindow.getFocusedWindow() ?? emuWindow,
    ensureIdeWindow: showIdeWindow,
    openSettings: (page) => openSettingsDialog(page),
    openMachineSelector: () => openMachineSelector(),
    selectMachineType
  };
}

/**
 * The Build menu: the build tasks of a Klive project's build file
 */
function createBuildMenu(context: MenuContext): MenuItemConstructorOptions | undefined {
  const project = context.appState?.project;
  if (!project?.isKliveProject || !project.hasBuildFile) return undefined;
  const buildTasks: MenuItemConstructorOptions[] = [];
  for (const task of collectedBuildTasks) {
    if (task.separatorBefore) {
      buildTasks.push({ type: "separator" });
    }
    buildTasks.push({
      id: `BF_${task.id}`,
      label: task.displayName,
      click: async () => {
        const commandResult = await executeIdeCommand(
          context.ideWindow,
          `run-build-function ${task.id}`,
          undefined,
          true
        );
        if (!commandResult.success) {
          if (task.id !== "exportCode") {
            await executeIdeCommand(context.ideWindow, "outp build", undefined, true);
          }
        }
      }
    });
  }
  return buildTasks.length > 0 ? { label: "Build", submenu: buildTasks } : undefined;
}

/**
 * The whole menu template, in menu-bar order
 */
export function createMenuTemplate(context: MenuContext): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];
  if (context.isMac) template.push(createAppMenu(context));
  template.push(createFileMenu(context));
  if (context.isMac) {
    template.push({
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" }
      ]
    });
  }
  template.push(createViewMenu(context), createMachineMenu(context), createDebugMenu(context));
  const build = createBuildMenu(context);
  if (build) template.push(build);
  template.push(createHelpMenu(context));
  return template;
}

/**
 * Creates and sets the main menu of the app
 */
export function setupMenu(emuWindow: BrowserWindow, ideWindow: BrowserWindow): void {
  const context = createMenuContext(emuWindow, ideWindow);
  const template: (MenuItemConstructorOptions | MenuItem)[] = createMenuTemplate(context);

  // --- If we show dialogs, the all menu item should be disabled
  if (context.appState?.dimMenu) {
    disableAllMenuItems(template);
  }

  // Preserve the submenus as a dedicated array.
  const submenus = template.map((i) => i.submenu);

  // --- Set the menu. `setupMenu` runs on *every* state change, and most of those changes do not
  // --- alter the menu at all. Handing an unchanged menu to the OS is not free: on macOS every
  // --- `Menu.setApplicationMenu` call replaces the single global NSMenu, which makes an
  // --- auto-hidden menu bar (System Settings > "Automatically hide and show the menu bar", or
  // --- full-screen mode) tear down and re-reveal itself - the menu bar visibly flashes while the
  // --- pointer rests at the top of the screen. So only touch the native menu when the rendered
  // --- menu really differs from the one already installed.
  if (__DARWIN__) {
    const windowFocused = isEmuWindowFocused() ? emuWindow : ideWindow;
    if (!windowFocused.isDestroyed()) {
      template.forEach(templateTransform(windowFocused));
      if (menuChanged("app", template)) {
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
      }
    }
  } else {
    if (emuWindow && !emuWindow.isDestroyed()) {
      template.forEach(templateTransform(emuWindow));
      if (menuChanged("emu", template)) {
        emuWindow.setMenu(Menu.buildFromTemplate(template));
      }
    }
    if (ideWindow && !ideWindow.isDestroyed()) {
      template.forEach(templateTransform(ideWindow));
      if (menuChanged("ide", template)) {
        ideWindow.setMenu(Menu.buildFromTemplate(template));
      }
    }
  }

  function templateTransform(wnd: BrowserWindow) {
    return wnd.isFocused()
      ? (
          i: { submenu: Electron.MenuItemConstructorOptions[] | Electron.Menu },
          idx: string | number
        ) => (i.submenu = submenus[idx])
      : (i: { submenu: null }) => (i.submenu = null);
  }
}

/**
 * The signature of the menu last handed to the OS, per menu target ("app" on macOS, "emu"/"ide"
 * elsewhere). Used to suppress redundant native menu updates.
 */
const lastMenuSignatures = new Map<string, string>();

/**
 * Counts the menu updates suppressed since the last real rebuild, per target. Reported only when
 * the KLIVE_MENU_DEBUG environment variable is set.
 */
const suppressedMenuUpdates = new Map<string, number>();

/**
 * Serializes the visible shape of a menu template: everything that can make the rendered menu look
 * or behave differently (labels, ids, roles, types, accelerators, enabled/visible/checked flags and
 * the nesting of submenus). Click handlers are deliberately excluded: they are freshly created
 * closures on every build, so comparing them would never report an unchanged menu.
 */
function menuSignature(items: (MenuItemConstructorOptions | MenuItem)[] | Electron.Menu): string {
  return JSON.stringify(items, (key, value) =>
    typeof value === "function" || key === "icon" || key === "sharingItem" ? undefined : value
  );
}

/**
 * Tests whether the given menu template differs from the one most recently installed for the
 * specified target, and remembers it when it does.
 * @param target Menu target key
 * @param template The template about to be installed
 * @returns True if the native menu needs to be replaced
 */
function menuChanged(
  target: string,
  template: (MenuItemConstructorOptions | MenuItem)[]
): boolean {
  let signature: string;
  try {
    signature = menuSignature(template);
  } catch {
    // --- A template we cannot serialize (unexpected cyclic value) must never suppress an update.
    lastMenuSignatures.delete(target);
    return true;
  }
  if (lastMenuSignatures.get(target) === signature) {
    suppressedMenuUpdates.set(target, (suppressedMenuUpdates.get(target) ?? 0) + 1);
    return false;
  }
  if (process.env.KLIVE_MENU_DEBUG) {
    console.log(
      `[menu] rebuilding '${target}' menu (${suppressedMenuUpdates.get(target) ?? 0} redundant ` +
        `update(s) suppressed since the previous rebuild)`
    );
  }
  suppressedMenuUpdates.set(target, 0);
  lastMenuSignatures.set(target, signature);
  return true;
}

/**
 * Forgets the cached menu signatures so that the next `setupMenu` call rebuilds the native menu
 * even if its contents are unchanged (for example after the menu has been cleared).
 */
export function invalidateMenuCache(): void {
  lastMenuSignatures.clear();
  suppressedMenuUpdates.clear();
}

// --- Disable all menu items (except the system menu)
function disableAllMenuItems(
  items: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[]
): void {
  visitMenu(items, (item) => {
    if (item.id === SYSTEM_MENU_ID) return false;
    item.enabled = false;
    return true;
  });
}

// --- Visitor for each menu item in the current application menu
function visitMenu(
  items: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[],
  visitor: (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => boolean
): void {
  items.forEach((i) => visitMenuItem(i));

  function visitMenuItem(item: Electron.MenuItemConstructorOptions | Electron.MenuItem): boolean {
    const visitResult = visitor(item);
    if (visitResult) {
      if (item.submenu) {
        if (Array.isArray(item.submenu)) {
          item.submenu.forEach((i) => visitMenuItem(i));
        } else {
          item.submenu.items.forEach((i) => visitMenuItem(i));
        }
      }
    }
    return visitResult;
  }
}

export async function executeIdeCommand(
  window: BrowserWindow,
  commandText: string,
  title?: string,
  ignoreSuccess = false
): Promise<IdeCommandResult> {
  const response = await getIdeApi().executeCommand(commandText);
  if (response.success) {
    if (!ignoreSuccess) {
      await showMessage(
        window,
        "info",
        title ?? "Command execution",
        response.finalMessage ?? "Command successfully executed."
      );
    }
  } else {
    await showMessage(window, "error", title, response.finalMessage ?? "Error executing command.");
  }
  return response;
}

async function showMessage(
  window: BrowserWindow,
  type: string,
  title: string,
  message: string
): Promise<void> {
  mainStore.dispatch(dimMenuAction(true));
  try {
    await dialog.showMessageBox(window, {
      type: (type ?? "none") as any,
      title,
      message
    });
  } finally {
    mainStore.dispatch(dimMenuAction(false));
  }
}
