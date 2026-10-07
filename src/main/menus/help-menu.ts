/*
 * The Help menu, and the macOS application menu that takes About and Settings…
 * (`.plans/MENU_REDESIGN_PLAN.md` §3).
 */
import os from "os";
import { app, type MenuItemConstructorOptions, shell } from "electron";

import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { ABOUT_DIALOG, FIRST_STARTUP_DIALOG_EMU, FIRST_STARTUP_DIALOG_IDE } from "@messaging/dialog-ids";
import { createAboutDialogData } from "@messaging/about-dialog";
import type { MenuContext } from "./menu-context";
import { settingsMenuItem } from "./file-menu";
import { tidySeparators } from "./menu-utils";

export const SYSTEM_MENU_ID = "system_menu";
export const KLIVE_GITHUB_PAGES = "https://dotneteer.github.io/kliveide";

function aboutItem(context: MenuContext, label: string): MenuItemConstructorOptions {
  return {
    id: "help_about",
    label,
    click: async () => {
      const about = createAboutDialogData(app.getVersion(), process.versions.electron, os.version());
      if (context.ideFocus) {
        await getIdeApi().displayDialog(ABOUT_DIALOG, about);
      } else {
        await getEmuApi().displayDialog(ABOUT_DIALOG, about);
      }
    }
  };
}

/** The macOS application menu */
export function createAppMenu(context: MenuContext): MenuItemConstructorOptions {
  return {
    label: app.name,
    id: SYSTEM_MENU_ID,
    submenu: [
      aboutItem(context, `About ${app.name}`),
      { type: "separator" },
      settingsMenuItem(context),
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" }
    ]
  };
}

export function createHelpMenu(context: MenuContext): MenuItemConstructorOptions {
  const links = context.machineMenus?.helpLinks ?? [];
  const linkItems: MenuItemConstructorOptions[] = links.map((hl) =>
    hl.label ? { label: hl.label, click: () => shell.openExternal(hl.url) } : { type: "separator" }
  );
  const machineName = context.currentMachine?.displayName ?? "Machine";
  const items: MenuItemConstructorOptions[] = [
    ...(context.isMac ? [] : [aboutItem(context, "About Klive")]),
    {
      id: "help_home_page",
      label: "Klive IDE Home Page",
      click: () => shell.openExternal(KLIVE_GITHUB_PAGES)
    },
    {
      id: "help_welcome",
      label: "Welcome Screen",
      click: async () => {
        if (context.ideFocus) {
          await getIdeApi().displayDialog(FIRST_STARTUP_DIALOG_IDE);
        } else {
          await getEmuApi().displayDialog(FIRST_STARTUP_DIALOG_EMU);
        }
      }
    },
    ...(linkItems.length
      ? ([
          { type: "separator" },
          { id: "help_machine_links", label: `${machineName} Resources`, submenu: tidySeparators(linkItems) }
        ] as MenuItemConstructorOptions[])
      : [])
  ];
  return { id: "help_menu", label: "Help", submenu: tidySeparators(items) };
}
