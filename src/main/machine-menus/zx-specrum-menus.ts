import path from "path";
import fs from "fs";

import type { MachineMenuRenderer, MachineMenuItem } from "@common/machines/info-types";
import type { AppState } from "@state/AppState";

import { MF_TAPE_SUPPORT, MC_DISK_SUPPORT, MC_SP48_ROM_FILE } from "@common/machines/constants";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { setVolatileDocStateAction, setMediaAction, displayDialogAction, incMenuVersionAction } from "@state/actions";
import { BASIC_PANEL_ID } from "@state/common-ids";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { dialog, BrowserWindow, app } from "electron";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import { CREATE_DISK_DIALOG } from "@messaging/dialog-ids";
import { createBooleanSettingsMenu } from "@main/app-menu";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";
import { appSettings } from "@main/settings-utils";
import { getModelConfig } from "@common/machines/machine-registry";

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

const ROM_FILE_FOLDER = "sp48RomFileFolder";
const ROM_SIZE = 16384;

/**
 * Renders the "Select ROM" menu for the ZX Spectrum 48 model
 */
export const sp48RomMenuRenderer: MachineMenuRenderer = (windowInfo) => {
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  const customRom = appState?.emulatorState?.config?.[MC_SP48_ROM_FILE] as string | undefined;
  return [
    { type: "separator" },
    {
      id: "select_rom_file",
      label: "Select ROM File...",
      click: async () => {
        await selectRomFile(emuWindow);
      }
    },
    {
      id: "reset_rom_file",
      label: "Reset to Default ROM",
      enabled: !!customRom,
      click: async () => {
        await resetRomFile();
      }
    }
  ];
};

/**
 * Opens a file dialog to select a ZX Spectrum 48 ROM file (exactly 16K).
 * Stores the path in the emulator config and restarts the machine.
 */
async function selectRomFile(emuWindow: BrowserWindow): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  const defaultPath =
    appSettings?.folders?.[ROM_FILE_FOLDER] ?? app.getPath("home");

  const dialogResult = await dialog.showOpenDialog(emuWindow, {
    title: "Select ROM File",
    defaultPath,
    filters: [
      { name: "ROM Files", extensions: ["rom", "bin"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  const filename = dialogResult.filePaths[0];

  // --- Validate file size (must be exactly 16K)
  let contents: Buffer;
  try {
    contents = fs.readFileSync(filename);
  } catch (err) {
    dialog.showErrorBox(
      "Error reading ROM file",
      `Could not read file ${filename}: ${err.message}`
    );
    return;
  }
  if (contents.length !== ROM_SIZE) {
    dialog.showErrorBox(
      "Invalid ROM file",
      `The selected file is ${contents.length} bytes. A ZX Spectrum 48 ROM must be exactly ${ROM_SIZE} bytes (16K).`
    );
    return;
  }

  // --- Save the folder for next time
  appSettings.folders ??= {};
  appSettings.folders[ROM_FILE_FOLDER] = path.dirname(filename);

  // --- Update config and restart the machine
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  const config = { ...(getModelConfig(machineId, modelId) ?? emulatorState?.config ?? {}) };
  config[MC_SP48_ROM_FILE] = filename;
  await setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await logEmuEvent(`Custom ROM file set to ${filename}`);
  await saveKliveProject();
}

/**
 * Clears the custom ROM file from config and restarts the machine with the default ROM.
 */
async function resetRomFile(): Promise<void> {
  const result = await dialog.showMessageBox({
    type: "question",
    buttons: ["Yes", "No"],
    title: "Reset to Default ROM",
    message: "Are you sure you want to reset to the default ZX Spectrum 48 ROM?"
  });
  if (result.response !== 0) return;

  const emulatorState = mainStore.getState()?.emulatorState;
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  const config = { ...(getModelConfig(machineId, modelId) ?? emulatorState?.config ?? {}) };
  delete config[MC_SP48_ROM_FILE];
  await setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await logEmuEvent("ROM reset to default");
  await saveKliveProject();
}
