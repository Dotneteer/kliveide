/*
 * The File menu (`.plans/MENU_REDESIGN_PLAN.md` §3): projects, then one Open File… for every file
 * the emulator understands, the saves, the quick state slot, and (off macOS) Settings… and Quit.
 */
import type { MenuItemConstructorOptions } from "electron";

import { closeFolderAction } from "@state/actions";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { NEW_PROJECT_DIALOG } from "@messaging/dialog-ids";
import { mainStore } from "@main/main-store";
import { appSettings } from "@main/settings-utils";
import { fileChangeWatcher } from "@main/file-watcher";
import { openFolder, openFolderByPath, saveKliveProject } from "@main/projects";
import { pickAndOpenEmulatorFile } from "@main/open-file";
import { canSaveSpectrumSnapshot, saveSpectrumSnapshotAs } from "@main/machine-menus/zx-specrum-menus";
import {
  canQuickRestoreMachineState,
  canSaveMachineState,
  QUICK_RESTORE_ACCELERATOR,
  QUICK_SAVE_ACCELERATOR,
  quickRestoreState,
  quickSaveState,
  saveMachineStateAs
} from "@main/machine-menus/state-menus";
import type { MenuContext } from "./menu-context";
import { tidySeparators } from "./menu-utils";

/*
 * macOS only: elsewhere these are Ctrl+letter, and the emulator reads Ctrl as a machine key (the
 * Z88's Diamond), so a menu accelerator would swallow key combinations the guest needs.
 */
export const OPEN_FILE_ACCELERATOR = "Cmd+O";
export const SETTINGS_ACCELERATOR = "Cmd+,";

/** The Settings… item: in the app menu on macOS, in File elsewhere */
export function settingsMenuItem(context: MenuContext): MenuItemConstructorOptions {
  return {
    id: "open_settings",
    label: "Settings...",
    accelerator: context.isMac ? SETTINGS_ACCELERATOR : undefined,
    click: async () => await context.openSettings()
  };
}

/** Closes the open folder after saving what needs saving */
async function closeCurrentFolder(context: MenuContext): Promise<boolean> {
  context.ensureIdeWindow();
  const canClose = await getIdeApi().saveAllBeforeQuit();
  if (!canClose) return false;
  mainStore.dispatch(closeFolderAction());
  await getEmuApi().eraseAllBreakpoints();
  fileChangeWatcher.stopWatching();
  await saveKliveProject();
  return true;
}

export function createFileMenu(context: MenuContext): MenuItemConstructorOptions {
  const { appState } = context;
  const recentProjectNames = appSettings.recentProjects ?? [];
  const recentProjects: MenuItemConstructorOptions[] = recentProjectNames.map((rp) => ({
    label: rp,
    click: async () => {
      if (await closeCurrentFolder(context)) {
        await openFolderByPath(rp);
      }
    }
  }));

  const items: MenuItemConstructorOptions[] = [
    {
      id: "new_project",
      label: "New Project...",
      click: async () => {
        context.ensureIdeWindow();
        await getIdeApi().displayDialog(NEW_PROJECT_DIALOG);
      }
    },
    {
      id: "open_folder",
      label: "Open Folder...",
      click: async () => {
        context.ensureIdeWindow();
        await openFolder(context.ideWindow);
      }
    },
    ...(recentProjects.length > 0
      ? [{ id: "recent_projects", label: "Open Recent", submenu: recentProjects }]
      : []),
    { type: "separator" },
    {
      // --- Snapshots, states, RZX recordings and tapes, routed by extension like a dropped file
      id: "open_file",
      label: "Open File...",
      accelerator: context.isMac ? OPEN_FILE_ACCELERATOR : undefined,
      click: async () => await pickAndOpenEmulatorFile(context.focusedWindow())
    },
    {
      // --- Enabled only while a ZX Spectrum has a state to save
      id: "save_spectrum_snapshot",
      label: "Save Snapshot...",
      enabled: canSaveSpectrumSnapshot(appState),
      click: async () => await saveSpectrumSnapshotAs(context.focusedWindow())
    },
    {
      // --- Any machine with a state (.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md §4.9)
      id: "save_machine_state",
      label: "Save Machine State...",
      enabled: canSaveMachineState(appState),
      click: async () => await saveMachineStateAs(context.focusedWindow())
    },
    { type: "separator" },
    {
      id: "machine_quick_save_state",
      label: "Quick Save State",
      accelerator: QUICK_SAVE_ACCELERATOR,
      enabled: canSaveMachineState(appState),
      click: async () => await quickSaveState(context.emuWindow)
    },
    {
      id: "machine_quick_restore_state",
      label: "Quick Restore State",
      accelerator: QUICK_RESTORE_ACCELERATOR,
      enabled: canQuickRestoreMachineState(appState),
      click: async () => await quickRestoreState(context.emuWindow)
    },
    { type: "separator" },
    {
      id: "close_folder",
      label: "Close Folder",
      enabled: !!appState?.project?.folderPath,
      click: async () => {
        await closeCurrentFolder(context);
      }
    },
    ...(context.isMac
      ? []
      : ([
          { type: "separator" },
          settingsMenuItem(context),
          { type: "separator" },
          { role: "quit" }
        ] as MenuItemConstructorOptions[]))
  ];
  return { label: "File", submenu: tidySeparators(items) };
}
