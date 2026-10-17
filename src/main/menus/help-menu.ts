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
import { automationMenuItems, settingsMenuItem } from "./file-menu";
import { tidySeparators } from "./menu-utils";
import { installCommandLineTool } from "../cli-install";
import { t } from "@common/i18n/i18n";

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
      aboutItem(context, t("menu.app.about", { appName: app.name })),
      { type: "separator" },
      settingsMenuItem(context),
      ...automationMenuItems(context),
      {
        // --- `/usr/local/bin/klive` (`.plans/UNIT_TESTS_CLI_PLAN.md` D12)
        id: "install_cli",
        label: t("menu.app.installCli"),
        click: async () => await installCommandLineTool(context.focusedWindow())
      },
      { type: "separator" },
      // --- Explicit labels, or the OS labels these in its own language (LOCALIZATION_PLAN step 3)
      { role: "hide", label: t("menu.app.hide", { appName: app.name }) },
      { role: "hideOthers", label: t("menu.app.hideOthers") },
      { role: "unhide", label: t("menu.app.showAll") },
      { type: "separator" },
      { role: "quit", label: t("menu.app.quit", { appName: app.name }) }
    ]
  };
}

export function createHelpMenu(context: MenuContext): MenuItemConstructorOptions {
  const links = context.machineMenus?.helpLinks ?? [];
  const linkItems: MenuItemConstructorOptions[] = links.map((hl) =>
    hl.labelKey || hl.label
      ? { label: hl.labelKey ? t(hl.labelKey) : hl.label, click: () => shell.openExternal(hl.url) }
      : { type: "separator" }
  );
  // --- Machine names are never translated (D9)
  const machineName = context.currentMachine?.displayName ?? "Machine";
  const items: MenuItemConstructorOptions[] = [
    ...(context.isMac ? [] : [aboutItem(context, t("menu.help.aboutKlive"))]),
    {
      id: "help_home_page",
      label: t("menu.help.homePage"),
      click: () => shell.openExternal(KLIVE_GITHUB_PAGES)
    },
    {
      id: "help_welcome",
      label: t("menu.help.welcome"),
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
          {
            id: "help_machine_links",
            label: t("menu.help.machineResources", { machine: machineName }),
            submenu: tidySeparators(linkItems)
          }
        ] as MenuItemConstructorOptions[])
      : [])
  ];
  return { id: "help_menu", label: t("menu.help.title"), submenu: tidySeparators(items) };
}
