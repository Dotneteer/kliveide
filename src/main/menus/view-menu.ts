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
import { t } from "@common/i18n/i18n";

/** View › Machine Views: the memory and disassembly views, then the machine's own */
export function createMachineViewsMenu(context: MenuContext): MenuItemConstructorOptions[] {
  const volatileDocs = context.appState?.ideView?.volatileDocs ?? {};
  const machineViews =
    context.machineMenus?.viewItems?.(windowInfoOf(context), context.currentMachine, context.currentModel) ?? [];
  return tidySeparators([
    {
      id: "show_memory",
      label: t("menu.view.memory"),
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
      label: t("menu.view.disassembly"),
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
    { id: "machine_views", label: t("menu.view.machineViews"), submenu: createMachineViewsMenu(context) },
    { type: "separator" },
    // --- The emulator window's parts (shown while it has the focus: `boundTo: "emu"`)
    createBooleanSettingsMenu(SETTING_EMU_SHOW_TOOLBAR, { label: t("menu.view.toolbar") }),
    createBooleanSettingsMenu(SETTING_EMU_SHOW_STATUS_BAR, { label: t("menu.view.statusBar") }),
    createBooleanSettingsMenu(SETTING_EMU_SHOW_KEYBOARD, { label: t("menu.view.virtualKeyboard") }),
    // --- The IDE window's parts (`boundTo: "ide"`)
    createBooleanSettingsMenu(SETTING_IDE_SHOW_TOOLBAR, { label: t("menu.view.toolbar") }),
    createBooleanSettingsMenu(SETTING_IDE_SHOW_STATUS_BAR, { label: t("menu.view.statusBar") }),
    createBooleanSettingsMenu(SETTING_IDE_SHOW_SIDEBAR, { label: t("menu.view.sidebar") }),
    createBooleanSettingsMenu(SETTING_IDE_SHOW_TOOLS, { label: t("menu.view.commandAndOutput") }),
    { type: "separator" },
    {
      // --- Shrinks the window around the machine's picture: a Z88 hugs its LCD (issue #1377).
      // --- Hints arrive outside the store, so the menu cannot track them; the command no-ops until
      // --- the renderer has reported, which happens as soon as a machine is shown.
      id: "emu_fit_window",
      label: t("menu.view.fitWindow"),
      visible: context.emuWindowFocused,
      enabled: emuResizable,
      click: () => fitEmuWindowToScreen(emuWindow)
    },
    {
      // --- The most compact window for the machine, whatever zoom step it shows now
      id: "emu_fit_window_1x",
      label: t("menu.view.fitWindow1x"),
      visible: context.emuWindowFocused,
      enabled: emuResizable,
      click: () => fitEmuWindowToScreen(emuWindow, "1x")
    },
    {
      // --- A toggle: checked while the IDE window is shown; unchecking hides it as closing does
      id: "show_ide_window",
      label: t("menu.view.showIde"),
      type: "checkbox",
      checked: context.ideWindowVisible,
      click: () => (context.ideWindowVisible ? context.hideIdeWindow() : context.ensureIdeWindow())
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
      label: t("menu.view.goBack"),
      accelerator: context.shortcuts.navBack,
      visible: context.ideWindowVisible,
      enabled: !!navHistory?.canGoBack,
      click: async () => {
        await getIdeApi().executeCommand("nav-back");
      }
    },
    {
      id: "ide_go_forward",
      label: t("menu.view.goForward"),
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
      label: t("menu.view.zoom"),
      // --- Explicit labels, or the OS labels these in its own language (LOCALIZATION_PLAN step 3)
      submenu: [
        { role: "resetZoom", label: t("menu.view.actualSize") },
        { role: "zoomIn", label: t("menu.view.zoomIn") },
        { role: "zoomOut", label: t("menu.view.zoomOut") }
      ]
    },
    {
      id: "toggle_full_screen",
      label: t("menu.view.toggleFullScreen"),
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
      label: dark ? t("menu.view.lightTheme") : t("menu.view.darkTheme"),
      click: async () => {
        mainStore.dispatch(setThemeAction(dark ? "light" : "dark"));
        await saveKliveProject();
      }
    },
    {
      id: "toggle_devtools",
      label: t("menu.view.toggleDevTools"),
      visible: context.allowDevTools,
      accelerator: "Ctrl+Shift+I",
      click: () => {
        context.focusedWindow()?.webContents.toggleDevTools();
      }
    }
  ];
  return { label: t("menu.view.title"), submenu: tidySeparators(filterVisibleItems(items)) };
}
