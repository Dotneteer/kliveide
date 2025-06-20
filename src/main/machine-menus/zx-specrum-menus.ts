import path from "path";
import fs from "fs";

import type { MachineMenuRenderer, MachineMenuItem } from "@common/machines/info-types";
import type { AppState } from "@state/AppState";

import { MF_TAPE_SUPPORT, MC_DISK_SUPPORT } from "@common/machines/constants";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { setVolatileDocStateAction, setMediaAction, displayDialogAction } from "@state/actions";
import { BASIC_PANEL_ID } from "@state/common-ids";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { logEmuEvent } from "@main/registeredMachines";
import { dialog, BrowserWindow, app } from "electron";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import { CREATE_DISK_DIALOG } from "@messaging/dialog-ids";
import { createBooleanSettingsMenu } from "@main/app-menu";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";
import { appSettings } from "@main/settings-utils";

const TAPE_FILE_FOLDER = "tapeFileFolder";

/**
 * Renders tape commands
 */
export const tapeMenuRenderer: MachineMenuRenderer = (windowInfo, machine) => {
  const items: MachineMenuItem[] = [];
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  if (machine.features?.[MF_TAPE_SUPPORT]) {
    items.push(createBooleanSettingsMenu(SETTING_EMU_FAST_LOAD) as any);
    items.push({
      id: "rewind_tape",
      label: "Rewind Tape",
      click: async () => {
        console.log("tape", appState.media?.[MEDIA_TAPE]);
        await getEmuApi().issueMachineCommand("rewind");
      }
    });
    items.push({
      id: "select_tape_file",
      label: "Select Tape File...",
      click: async () => {
        await setTapeFile(emuWindow, appState);
        await saveKliveProject();
      }
    });
    items.push({
      id: "eject_tape",
      label: "Eject Tape",
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await ejectTape(true);
        await saveKliveProject();
      }
    });
  }
  return items;
};

/**
 * Renders disk commands
 */
export const diskMenuRenderer: MachineMenuRenderer = (windowInfo, _, model) => {
  const appState = mainStore.getState();
  const emuWindow = windowInfo.emuWindow;
  const disksSupported = model?.config?.[MC_DISK_SUPPORT] ?? 0;
  if (!disksSupported) {
    return [];
  }

  const floppySubMenu: MachineMenuItem[] = [
    {
      id: "create_disk_file",
      label: "Create Disk File...",
      click: async () => {
        mainStore.dispatch(displayDialogAction(CREATE_DISK_DIALOG));
      }
    },
    { type: "separator" }
  ];
  createDiskMenu(0, "a");
  if (disksSupported > 1) {
    createDiskMenu(1, "b");
  }

  return [
    { type: "separator" },
    {
      id: "floppy_menu",
      label: "Floppy Disks",
      submenu: floppySubMenu
    }
  ];

  function createDiskMenu(index: number, suffix: string): void {
    const state = appState?.media?.[index ? MEDIA_DISK_B : MEDIA_DISK_A] ?? {};
    floppySubMenu.push({ type: "separator" });
    if (state?.diskFile) {
      floppySubMenu.push({
        id: `eject_disk_${suffix}`,
        label: `Eject Disk from Drive ${suffix.toUpperCase()}`,
        click: async () => {
          await ejectDiskFile(index, suffix);
        }
      });
      floppySubMenu.push({
        id: `protect_disk_${suffix}`,
        type: "checkbox",
        checked: !!state.writeProtected,
        label: `Write Protected Disk in Drive ${suffix.toUpperCase()}`,
        click: async () => {
          mainStore.dispatch(
            setMediaAction(index ? MEDIA_DISK_B : MEDIA_DISK_A, {
              ...state,
              writeProtected: !state.writeProtected
            })
          );
          await setDiskWriteProtection(index, suffix, !state.writeProtected);
        }
      });
    }
    floppySubMenu.push({
      id: `insert_disk_${suffix}`,
      label: state?.diskFile
        ? `Change Disk in Drive ${suffix.toUpperCase()}...`
        : `Insert Disk into Drive ${suffix.toUpperCase()}...`,
      click: async () => {
        await setDiskFile(emuWindow, index, suffix);
        await saveKliveProject();
      }
    });
  }
};

/**
 * Renders ZX Spectrum IDE commands
 */
export const spectrumIdeRenderer: MachineMenuRenderer = () => {
  const volatileDocs = mainStore.getState()?.ideView?.volatileDocs ?? {};
  return [
    {
      id: "show_basic",
      label: "Show BASIC Listing",
      type: "checkbox",
      checked: volatileDocs[BASIC_PANEL_ID],
      click: async () => {
        await getIdeApi().showBasic(!volatileDocs[BASIC_PANEL_ID]);
        mainStore.dispatch(
          setVolatileDocStateAction(BASIC_PANEL_ID, !volatileDocs[BASIC_PANEL_ID])
        );
      }
    }
  ];
};

export async function setSelectedTapeFile(filename: string): Promise<void> {
  // --- Read the file
  const tapeFileFolder = path.dirname(filename);

  // --- Store the last selected tape file
  mainStore.dispatch(setMediaAction(MEDIA_TAPE, filename));

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[TAPE_FILE_FOLDER] = tapeFileFolder;

  try {
    const contents = fs.readFileSync(filename);
    await getEmuApi().setTapeFile(filename, new Uint8Array(contents));
    await logEmuEvent(`Tape file set to ${filename}`);
  } catch (err) {
    dialog.showErrorBox(
      "Error while reading tape file",
      `Reading file ${filename} resulted in error: ${err.message}\n\n` +
        "The faulty tape file will be ejected after closing this dialog."
    );
    await ejectTape();
  }
}

// ============================================================================
// Helper functions

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setTapeFile(browserWindow: BrowserWindow, state: AppState): Promise<void> {
  const lastFile = state.media?.[MEDIA_TAPE];
  const defaultPath =
    appSettings?.folders?.[TAPE_FILE_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: "Select Tape File",
    defaultPath,
    filters: [
      { name: "Tape Files", extensions: ["tap", "tzx"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  await setSelectedTapeFile(dialogResult.filePaths[0]);
}

/**
 * Ejects the current tape file
 * @param browserWindow Host browser window
 */
async function ejectTape(confirm = false): Promise<void> {
  if (confirm) {
    const result = await dialog.showMessageBox({
      type: "question",
      buttons: ["Yes", "No"],
      title: "Eject Tape",
      message: "Are you sure you want to eject the tape?"
    });
    if (result.response !== 0) return;
  }
  // --- Store the last selected tape file
  mainStore.dispatch(setMediaAction(MEDIA_TAPE, ""));
  await getEmuApi().setTapeFile("", new Uint8Array(0));
  await logEmuEvent(`Tape file ejected.`);
}

/**
 * Sets the disk file to use with the machine
 * @param browserWindow Host browser window
 * @param index Disk drive index (0: A, 1: B)
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setDiskFile(
  browserWindow: BrowserWindow,
  index: number,
  suffix: string
): Promise<void> {
  const DISK_FILE_FOLDER = "diskFileFolder";
  const lastFile = mainStore.getState()?.media?.[index ? MEDIA_DISK_B : MEDIA_DISK_A];
  const defaultPath =
    appSettings?.folders?.[DISK_FILE_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: "Select Disk File",
    defaultPath,
    filters: [
      { name: "Disk Files", extensions: ["dsk"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  const filename = dialogResult.filePaths[0];
  const diskFileFolder = path.dirname(filename);

  // --- Store the last selected tape file
  mainStore.dispatch(
    setMediaAction(index ? MEDIA_DISK_B : MEDIA_DISK_A, {
      diskFile: filename,
      writeProtected: true
    })
  );

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[DISK_FILE_FOLDER] = diskFileFolder;

  try {
    const contents = fs.readFileSync(filename);
    await getEmuApi().setDiskFile(index, filename, new Uint8Array(contents));
    await logEmuEvent(`Disk file in drive ${suffix.toUpperCase()} set to ${filename}`);
  } catch (err) {
    dialog.showErrorBox(
      "Error while reading disk file",
      `Reading file ${filename} resulted in error: ${err.message}`
    );
  }
}

/**
 * Sets the disk file to use with the machine
 * @param browserWindow Host browser window
 * @param index Disk drive index (0: A, 1: B)
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function ejectDiskFile(index: number, suffix: string): Promise<void> {
  mainStore.dispatch(setMediaAction(index ? MEDIA_DISK_B : MEDIA_DISK_A, {}));
  try {
    await getEmuApi().setDiskFile(index);
    await logEmuEvent(`Disk ejected from drive ${suffix.toUpperCase()}`);
  } catch (err) {
    dialog.showErrorBox(
      "Error while ejecting disk file",
      `Ejecting resulted in error: ${err.message}`
    );
  }
}

async function setDiskWriteProtection(
  index: number,
  suffix: string,
  protect: boolean
): Promise<void> {
  try {
    await getEmuApi().setDiskWriteProtection(index, protect);
    await logEmuEvent(
      `Write protection turned ${protect ? "on" : "off"} for drive ${suffix.toUpperCase()}`
    );
  } catch (err) {
    // --- Intentionally ignored
  }
}
