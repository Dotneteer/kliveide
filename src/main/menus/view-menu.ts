/*
 * The View menu (`.plans/MENU_REDESIGN_PLAN.md` §3): the machine views, the parts of the focused
 * window, navigation, zoom and full screen, and one light/dark switch. Fonts, the accent, the editor
 * options and the layout preferences are in Settings.
 */
import type { MenuItemConstructorOptions } from "electron";

import { setThemeAction, setVolatileDocStateAction } from "@state/actions";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { DISASSEMBLY_PANEL_ID, MEMORY_PANEL_ID } from "@state/common-ids";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { fitEmuWindowToScreen } from "@main/emu-window-sizing";
import {
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_SHOW_STATUS_BAR,
  SETTING_EMU_SHOW_TOOLBAR,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SHOW_STATUS_BAR,
  SETTING_IDE_SHOW_TOOLBAR,
  SETTING_IDE_SHOW_TOOLS
} from "@common/settings/setting-const";
import { type MenuContext, windowInfoOf } from "./menu-context";
import { createBooleanSettingsMenu, filterVisibleItems, tidySeparators } from "./menu-utils";

/** View › Machine Views: the memory and disassembly views, then the machine's own */
export function createMachineViewsMenu(context: MenuContext): MenuItemConstructorOptions[] {
  const volatileDocs = context.appState?.ideView?.volatileDocs ?? {};
  const machineViews =
    context.machineMenus?.viewItems?.(windowInfoOf(context), context.currentMachine, context.currentModel) ?? [];
  return tidySeparators([
    {
      id: "show_memory",
      label: "Memory",
      type: "checkbox",
      checked: !!volatileDocs[MEMORY_PANEL_ID],
      click: async () => {
        context.ensureIdeWindow();
        await getIdeApi().showMemory(!volatileDocs[MEMORY_PANEL_ID]);
        mainStore.dispatch(setVolatileDocStateAction(MEMORY_PANEL_ID, !volatileDocs[MEMORY_PANEL_ID]));
      }
    },
    {
      id: "show_banked_disassembly",
      label: "Disassembly",
      type: "checkbox",
      checked: !!volatileDocs[DISASSEMBLY_PANEL_ID],
      click: async () => {
        context.ensureIdeWindow();
        await getIdeApi().showDisassembly(!volatileDocs[DISASSEMBLY_PANEL_ID]);
        mainStore.dispatch(
          setVolatileDocStateAction(DISASSEMBLY_PANEL_ID, !volatileDocs[DISASSEMBLY_PANEL_ID])
        );
      }
    },
    ...(machineViews.length ? [{ type: "separator" as const }] : []),
    ...(machineViews as MenuItemConstructorOptions[])
  ]);
}

export function createViewMenu(context: MenuContext): MenuItemConstructorOptions {
  const { appState, emuWindow, ideWindow } = context;
  const navHistory = appState?.ideView?.navHistory;
  const emuResizable = !emuWindow?.isDestroyed() && !emuWindow?.isFullScreen();
  const dark = appState?.theme !== "light";

  const items: MenuItemConstructorOptions[] = [
    { id: "machine_views", label: "Machine Views", submenu: createMachineViewsMenu(context) },
    { type: "separator" },
    // --- The emulator window's parts (shown while it has the focus: `boundTo: "emu"`)
    createBooleanSettingsMenu(SETTING_EMU_SHOW_TOOLBAR, { label: "Toolbar" }),
    createBooleanSettingsMenu(SETTING_EMU_SHOW_STATUS_BAR, { label: "Status Bar" }),
    createBooleanSettingsMenu(SETTING_EMU_SHOW_KEYBOARD, { label: "Virtual Keyboard" }),
    // --- The IDE window's parts (`boundTo: "ide"`)
    createBooleanSettingsMenu(SETTING_IDE_SHOW_TOOLBAR, { label: "Toolbar" }),
    createBooleanSettingsMenu(SETTING_IDE_SHOW_STATUS_BAR, { label: "Status Bar" }),
    createBooleanSettingsMenu(SETTING_IDE_SHOW_SIDEBAR, { label: "Sidebar" }),
    createBooleanSettingsMenu(SETTING_IDE_SHOW_TOOLS, { label: "Command and Output" }),
    { type: "separator" },
    {
      // --- Shrinks the window around the machine's picture: a Z88 hugs its LCD (issue #1377).
      // --- Hints arrive outside the store, so the menu cannot track them; the command no-ops until
      // --- the renderer has reported, which happens as soon as a machine is shown.
      id: "emu_fit_window",
      label: "Fit Window to Screen",
      visible: context.emuWindowFocused,
      enabled: emuResizable,
      click: () => fitEmuWindowToScreen(emuWindow)
    },
    {
      // --- The most compact window for the machine, whatever zoom step it shows now
      id: "emu_fit_window_1x",
      label: "Fit Window to Screen at 1x",
      visible: context.emuWindowFocused,
      enabled: emuResizable,
      click: () => fitEmuWindowToScreen(emuWindow, "1x")
    },
    {
      id: "show_ide_window",
      label: "Show IDE",
      visible: !context.ideWindowVisible,
      click: () => context.ensureIdeWindow()
    },
    { type: "separator" },
    /*
     * Go Back / Go Forward, in both windows. While the IDE window has focus its renderer handles the
     * shortcuts itself, before Monaco can, and marks the key handled — which keeps the accelerator
     * here from firing a second time. The accelerator is what makes the shortcut work from the
     * emulator window. See `.plans/NAVIGATION_HISTORY_PLAN.md` §5.
     */
    {
      id: "ide_go_back",
      label: "Go Back",
      accelerator: context.shortcuts.navBack,
      visible: context.ideWindowVisible,
      enabled: !!navHistory?.canGoBack,
      click: async () => {
        await getIdeApi().executeCommand("nav-back");
      }
    },
    {
      id: "ide_go_forward",
      label: "Go Forward",
      accelerator: context.shortcuts.navForward,
      visible: context.ideWindowVisible,
      enabled: !!navHistory?.canGoForward,
      click: async () => {
        await getIdeApi().executeCommand("nav-forward");
      }
    },
    { type: "separator" },
    {
      // --- The window's own zoom (the emulator screen fits its panel by itself)
      id: "zoom",
      label: "Zoom",
      submenu: [{ role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }]
    },
    {
      id: "toggle_full_screen",
      label: "Toggle Full Screen",
      accelerator: context.shortcuts.fullScreen,
      click: () => {
        if (context.ideFocus) {
          ideWindow.setFullScreen(!ideWindow.isFullScreen());
        } else {
          emuWindow.setFullScreen(!emuWindow.isFullScreen());
        }
      }
    },
    { type: "separator" },
    {
      // --- The accent and the fonts are in Settings › Appearance
      id: "toggle_theme",
      label: dark ? "Switch to Light Theme" : "Switch to Dark Theme",
      click: async () => {
        mainStore.dispatch(setThemeAction(dark ? "light" : "dark"));
        await saveKliveProject();
      }
    },
    {
      id: "toggle_devtools",
      label: "Toggle Developer Tools",
      visible: context.allowDevTools,
      accelerator: "Ctrl+Shift+I",
      click: () => {
        context.focusedWindow()?.webContents.toggleDevTools();
      }
    }
  ];
  return { label: "View", submenu: tidySeparators(filterVisibleItems(items)) };
}
