/*
 * Debug › ROM Annotations (`.plans/ROM_ANNOTATIONS_MENU_PLAN.md`): a submenu per machine type, each
 * with the ROMs Klive ships for it (`ROM_ANNOTATION_CATALOG`). An item opens that ROM page's
 * annotations in the IDE through `rom-ann-open ... -create`.
 */
import { dialog, type BrowserWindow, type MenuItemConstructorOptions } from "electron";

import type { MachineInfo } from "@common/machines/info-types";
import {
  ROM_ANNOTATION_CATALOG,
  romAnnotationOpenCommand,
  type RomCatalogEntry,
  type RomCatalogMachine
} from "@common/roms/romAnnotationCatalog";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { dimMenuAction } from "@state/actions";
import { mainStore } from "@main/main-store";
import { t } from "@common/i18n/i18n";

export const ROM_ANNOTATIONS_MENU_ID = "rom_annotations";

/** The label of a ROM page's item: the file name, and the page for a multi-page file. */
export function romEntryLabel(entry: RomCatalogEntry): string {
  return entry.page === undefined
    ? entry.file
    : t("menu.debug.romAnnotationsPage", { file: entry.file, page: String(entry.page) });
}

/**
 * Builds the ROM Annotations submenu.
 * @param registry The registered machines: they name the machine types and give their order
 * @param open Called with the ROM page the user picks
 * @param catalog The ROMs by machine type
 */
export function createRomAnnotationsMenu(
  registry: readonly MachineInfo[],
  open: (entry: RomCatalogEntry) => Promise<void>,
  catalog: readonly RomCatalogMachine[] = ROM_ANNOTATION_CATALOG
): MenuItemConstructorOptions {
  const machines: MenuItemConstructorOptions[] = [];
  for (const machine of registry) {
    const roms = catalog.find((item) => item.machineId === machine.machineId);
    if (!roms) continue;
    const items: MenuItemConstructorOptions[] = [];
    roms.groups.forEach((group, index) => {
      if (index > 0) items.push({ type: "separator" });
      for (const entry of group) {
        items.push({
          id: `rom_ann_${machine.machineId}_${entry.file}${entry.page === undefined ? "" : `_${entry.page}`}`,
          label: romEntryLabel(entry),
          click: async () => {
            await open(entry);
          }
        });
      }
    });
    machines.push({ id: `rom_ann_${machine.machineId}`, label: machine.displayName, submenu: items });
  }
  return { id: ROM_ANNOTATIONS_MENU_ID, label: t("menu.debug.romAnnotations"), submenu: machines };
}

/**
 * Opens a ROM page's annotations in the IDE window, and says why in a message box when it cannot.
 * @param ensureIdeWindow Shows the IDE window, where the editor opens
 * @param window The window the message box belongs to
 */
export async function openRomAnnotations(
  entry: RomCatalogEntry,
  ensureIdeWindow: () => void,
  window: BrowserWindow
): Promise<void> {
  ensureIdeWindow();
  const response = await getIdeApi().executeCommand(romAnnotationOpenCommand(entry));
  if (response.success) return;
  // --- As every menu-started message box: the menu stays dimmed while it is up
  mainStore.dispatch(dimMenuAction(true));
  try {
    await dialog.showMessageBox(window, {
      type: "error",
      title: t("menu.debug.romAnnotationsFailed"),
      message: response.finalMessage ?? t("messages.command.failed")
    });
  } finally {
    mainStore.dispatch(dimMenuAction(false));
  }
}
