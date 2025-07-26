import path from "path";
import fs from "fs";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";
import { AppState } from "@common/state/AppState";
import { MEDIA_SD_CARD } from "@common/structs/project-const";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { app, BrowserWindow, dialog } from "electron";
import { KLIVE_HOME_FOLDER } from "@main/settings";
import { setMediaAction } from "@common/state/actions";
import { logEmuEvent } from "@main/registeredMachines";
import { CimHandler } from "@main/fat32/CimHandlers";
import { appSettings, saveAppSettings } from "@main/settings-utils";

const SD_CARD_FILE_FOLDER = "sdCardFileFolder";
const DEFAULT_SC_CARD_FILE = "ks2.cim";
const SOURCE_SD_CARD_FILE = "mmc/ks2-base.cim";

/**
 * Renders tape commands
 */
export const sdCardMenuRenderer: MachineMenuRenderer = (windowInfo) => {
  const items: MachineMenuItem[] = [];
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  items.push({
    id: "select_sd_card",
    label: "Select SD Card Image...",
    enabled:
      appState.emulatorState?.machineState === MachineControllerState.Stopped ||
      appState.emulatorState?.machineState === MachineControllerState.None,
    click: async () => {
      await setSdCardFile(emuWindow, appState);
      await saveKliveProject();
      saveAppSettings();
    }
  });
  items.push({
    id: "default_sd_card",
    label: "Use the default SD Card Image",
    enabled:
      appState.emulatorState?.machineState === MachineControllerState.Stopped ||
      appState.emulatorState?.machineState === MachineControllerState.None,
    click: async () => {
      // --- Store the last selected tape file
      mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, undefined));
      logSdCardEvent(getDefaultSdCardFile());
      await saveKliveProject();
      saveAppSettings();
    }
  });
  items.push({ type: "separator" });
  items.push({
    id: "reset_sd_card",
    label: "Reset the default SD Card Image",
    enabled:
      appState.emulatorState?.machineState === MachineControllerState.Stopped ||
      appState.emulatorState?.machineState === MachineControllerState.None,
    click: async () => {
      // --- Display an electron dialog to confirm the reset. Default is No.
      const result = await dialog.showMessageBox(emuWindow, {
        type: "question",
        buttons: ["Yes", "No"],
        defaultId: 1,
        title: "Reset SD Card Image",
        message:
          "Do you really want to reset the default SD Card image?" +
          "\nThis operation will delete all changes made to the current SD Card image."
      });

      if (result.response === 0) {
        await resetToDefaultSdCardFile();
      }
    }
  });
  return items;
};

export async function initializeZxSpectrumNext(): Promise<void> {
  // --- This is where the SD Card file is stored
  const sdCardPath = path.join(app.getPath("home"), KLIVE_HOME_FOLDER, DEFAULT_SC_CARD_FILE);
  if (!fs.existsSync(sdCardPath)) {
    // --- Create the folder if it does not exist
    fs.mkdirSync(path.dirname(sdCardPath), { recursive: true });
  }

  if (fs.existsSync(sdCardPath) && fs.statSync(sdCardPath).isFile()) {
    // --- The file exits, we are done
    return;
  }

  // --- Copy the SD Card file from the source
  const sourceSdCardPath = path.join(process.env.PUBLIC, SOURCE_SD_CARD_FILE);
  if (fs.existsSync(sourceSdCardPath) && fs.statSync(sourceSdCardPath).isFile()) {
    fs.copyFileSync(sourceSdCardPath, sdCardPath);
  }
}

export async function setupZxSpectrumNext(): Promise<void> {
  // --- Check, if the SD Card is set at all
  const appState = mainStore.getState();
  const sdCardFile = appState.media?.[MEDIA_SD_CARD];
  if (sdCardFile) {
    // --- Use the file stored in settings
    await logSdCardEvent(sdCardFile);
  } else {
    // --- Set the default SD Card file
    const defaultSdCard = getDefaultSdCardFile();
    mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, defaultSdCard));
    await logSdCardEvent(defaultSdCard);
  }
}

function getDefaultSdCardFile(): string {
  return path.join(app.getPath("home"), KLIVE_HOME_FOLDER, DEFAULT_SC_CARD_FILE);
}

async function logSdCardEvent(filename: string): Promise<void> {
  await logEmuEvent(`ZX Spectrum Next SD card image: ${filename}`);
}

async function resetToDefaultSdCardFile(): Promise<void> {
  // --- Get the default SD Card file, and delete the current one
  const sdCardPath = path.join(app.getPath("home"), KLIVE_HOME_FOLDER, DEFAULT_SC_CARD_FILE);
  if (fs.existsSync(sdCardPath) && fs.statSync(sdCardPath).isFile()) {
    // --- Delete the file
    fs.unlinkSync(sdCardPath);
  }

  // --- Copy the SD Card file from the source
  const sourceSdCardPath = path.join(process.env.PUBLIC, SOURCE_SD_CARD_FILE);
  if (fs.existsSync(sourceSdCardPath) && fs.statSync(sourceSdCardPath).isFile()) {
    fs.copyFileSync(sourceSdCardPath, sdCardPath);
  }

  // --- Make the file writeable
  const cimHandler = getSdCardHandler();
  cimHandler.setReadOnly(false);

  mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, undefined));
  await saveKliveProject();
  saveAppSettings();
  await logEmuEvent(`Default SD card image is reset to its original state`);
  await logSdCardEvent(getDefaultSdCardFile());
}

let cimHandler: CimHandler;

// --- Use this function to get the CIM handler
export function getSdCardHandler(): CimHandler {
  if (!cimHandler) {
    const appState = mainStore.getState();
    const sdCardFile = appState.media?.[MEDIA_SD_CARD];
    cimHandler = new CimHandler(sdCardFile ?? getDefaultSdCardFile());
  }
  return cimHandler;
}

// ============================================================================
// Helper functions

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setSdCardFile(browserWindow: BrowserWindow, state: AppState): Promise<void> {
  const lastFile = state.media?.[MEDIA_SD_CARD];
  const defaultPath =
    appSettings?.folders?.[SD_CARD_FILE_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: "Select Tape File",
    defaultPath,
    filters: [
      { name: "Compressed Image Files", extensions: ["cim"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  await setSelectedSdCardFile(dialogResult.filePaths[0]);
}

export async function setSelectedSdCardFile(filename: string): Promise<void> {
  // --- Read the file
  const sdCardFolder = path.dirname(filename);

  // --- Store the last selected tape file
  mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, filename));
  await logSdCardEvent(filename);

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[SD_CARD_FILE_FOLDER] = sdCardFolder;
}
