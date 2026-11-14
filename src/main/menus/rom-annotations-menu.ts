/*
 * Debug › ROM Annotations: a submenu per machine type, each
 * with the ROM files Klive ships for it (`ROM_ANNOTATION_CATALOG`), one item per file. An item opens the
 * file's annotations in the IDE through `rom-ann-open ... -create`; the ROM annotation editor lists the
 * file's pages.
 */
import { dialog, type BrowserWindow, type MenuItemConstructorOptions } from "electron";
import { NEXT_ROM_SETS, type NextRomSetId } from "@common/zxnext/romSets";

import type { MachineInfo } from "@common/machines/info-types";
import {
  ROM_ANNOTATION_CATALOG,
  romAnnotationOpenCommand,
  romCatalogFileName,
  romCatalogFiles,
  type RomCatalogEntry,
  type RomCatalogMachine
} from "@common/roms/romAnnotationCatalog";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { dimMenuAction } from "@state/actions";
import { mainStore } from "@main/main-store";
import { t } from "@common/i18n/i18n";

export const ROM_ANNOTATIONS_MENU_ID = "rom_annotations";

/** The label of a ROM file's item: its name, not its folder (the Next's sets have submenus). */
export function romEntryLabel(entry: RomCatalogEntry): string {
  return romCatalogFileName(entry);
}

/** The ROM set folder of a catalog file (`zxnext/nextzxos-2.08/enNextZX.rom`), or undefined for a flat one */
function romSetFolderOf(file: string | undefined): string | undefined {
  const match = /^zxnext\/([^/]+)\//.exec(file ?? "");
  return match?.[1];
}

/** A set's submenu label: the NextZXOS release, a product name and version (not translated) */
function romSetLabel(setId: string): string {
  const set = NEXT_ROM_SETS[setId as NextRomSetId];
  return set ? `NextZXOS ${set.nextZxOs}` : setId;
}

/**
 * Builds the ROM Annotations submenu.
 * @param registry The registered machines: they name the machine types and give their order
 * @param open Called with the ROM file the user picks
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
    // --- A machine with several ROM set folders (the Next's NextZXOS releases) gets a submenu per
    // --- set, named after the release: the sets' files have the same names
    const bySet = new Map<string, MenuItemConstructorOptions[]>();
    romCatalogFiles(roms).forEach((group) => {
      const set = romSetFolderOf(group[0]?.file) ?? "";
      const items = bySet.get(set) ?? [];
      if (items.length > 0) items.push({ type: "separator" });
      for (const entry of group) {
        items.push({
          id: `rom_ann_${machine.machineId}_${entry.file}`,
          label: romEntryLabel(entry),
          click: async () => {
            await open(entry);
          }
        });
      }
      bySet.set(set, items);
    });
    const items: MenuItemConstructorOptions[] =
      bySet.size > 1
        ? [...bySet.entries()].map(([set, submenu]) => ({
            id: `rom_ann_${machine.machineId}_${set}`,
            label: romSetLabel(set),
            submenu
          }))
        : ([...bySet.values()][0] ?? []);
    machines.push({ id: `rom_ann_${machine.machineId}`, label: machine.displayName, submenu: items });
  }
  return { id: ROM_ANNOTATIONS_MENU_ID, label: t("menu.debug.romAnnotations"), submenu: machines };
}

/**
 * Opens a ROM file's annotations in the IDE window, and says why in a message box when it cannot.
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
