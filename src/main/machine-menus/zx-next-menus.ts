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
import { appSettings, saveAppSettings, setSettingValue } from "@main/settings-utils";
import { getEmuApi } from "@common/messaging/MainToEmuMessenger";
import { SETTING_EMU_SCANLINE_EFFECT } from "@common/settings/setting-const";
import { ensureSdCardBackupIfEnabled } from "./sd-card-backup";

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
    enabled: isMachineStopped(),
    click: async () => {
      await setSdCardFile(emuWindow, appState);
      await saveKliveProject();
      saveAppSettings();
    }
  });
  items.push({
    id: "default_sd_card",
    label: "Use the default SD Card Image",
    enabled: isMachineStopped(),
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

export const hotkeyMenuRenderer: MachineMenuRenderer = () => {
  const items: MachineMenuItem[] = [
    {
      id: "zx_next_hotkeys",
      label: "Hotkeys",
      submenu: [
        {
          id: "zx_next_hotkey_f1",
          label: "F1 - Hard Reset",
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("restart");
          }
        },
        {
          id: "zx_next_hotkey_f2",
          label: "F2 - Toggle Scandoubler",
          enabled: isMachineRunning(),
          click: async () => {
            const enabled = await getEmuApi().issueMachineCommand("custom", "toggleScandoubler");
            await logEmuEvent(`Scandoubler ${enabled ? "enabled" : "disabled"}`);
          }
        },
        {
          id: "zx_next_hotkey_f3",
          label: "F3 - Toggle 50Hz/60Hz Display",
          enabled: isMachineRunning(),
          click: async () => {
            const hz60Mode = await getEmuApi().issueMachineCommand("custom", "toggle5060Hz");
            await logEmuEvent(`Display mode ${hz60Mode ? "60Hz" : "50Hz"}`);
          }
        },
        {
          id: "zx_next_hotkey_f4",
          label: "F4 - Soft Reset",
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("reset");
          }
        },
        {
          id: "zx_next_hotkey_f5",
          label: "F5 - Enable Expansion Bus",
          enabled: isMachineRunning(),
          click: async () => {
            const result = await getEmuApi().issueMachineCommand("custom", "enableExpansionBus");
            if (result === true) await logEmuEvent("Expansion Bus enabled");
          }
        },
        {
          id: "zx_next_hotkey_f6",
          label: "F6 - Disable Expansion Bus",
          enabled: isMachineRunning(),
          click: async () => {
            const result = await getEmuApi().issueMachineCommand("custom", "disableExpansionBus");
            if (result === false) await logEmuEvent("Expansion Bus disabled");
          }
        },
        {
          id: "zx_next_hotkey_f7",
          label: "F7 - Adjust Scanline Weight",
          enabled: isMachineRunning(),
          click: async () => {
            const values = ["off", "50%", "25%", "12.5%"];
            const scanLineValue = await getEmuApi().issueMachineCommand(
              "custom",
              "adjustScanlineWeight"
            );
            setSettingValue(SETTING_EMU_SCANLINE_EFFECT, values[scanLineValue]);
            await logEmuEvent(`Scanline weight set to ${values[scanLineValue]}`);
          }
        },
        {
          id: "zx_next_hotkey_f8",
          label: "F8 - Cycle CPU Speed",
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("custom", "cycleCpuSpeed");
          }
        },
        {
          id: "zx_next_hotkey_f9",
          label: "F9 - Multiface NMI",
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("custom", "multifaceNmi");
          }
        },
        {
          id: "zx_next_hotkey_f10",
          label: "F10 - DivMMC NMI",
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("custom", "divmmcNmi");
          }
        }
      ]
    },
    { type: "separator" }
  ];
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
    // --- Create initial backup after copying
    await ensureSdCardBackupIfEnabled(sdCardPath);
  }
}

export async function setupZxSpectrumNext(): Promise<void> {
  // --- Check, if the SD Card is set at all
  const appState = mainStore.getState();
  const sdCardFile = appState.media?.[MEDIA_SD_CARD];
  if (sdCardFile) {
    // --- Use the file stored in settings
    await logSdCardEvent(sdCardFile);
    // --- Ensure backup on startup
    await ensureSdCardBackupIfEnabled(sdCardFile);
  } else {
    // --- Set the default SD Card file
    const defaultSdCard = getDefaultSdCardFile();
    mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, defaultSdCard));
    await logSdCardEvent(defaultSdCard);
    // --- Ensure backup on startup
    await ensureSdCardBackupIfEnabled(defaultSdCard);
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

  // --- Create backup of reset file
  await ensureSdCardBackupIfEnabled(sdCardPath);

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
let currentSdCardFile: string;

// --- Use this function to get the CIM handler
export function getSdCardHandler(): CimHandler {
  const appState = mainStore.getState();
  const sdCardFile = appState.media?.[MEDIA_SD_CARD] ?? getDefaultSdCardFile();
  
  // --- Invalidate cache if SD card file has changed
  if (cimHandler && currentSdCardFile !== sdCardFile) {
    cimHandler = undefined;
  }
  
  if (!cimHandler) {
    cimHandler = new CimHandler(sdCardFile);
    currentSdCardFile = sdCardFile;
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

  // --- Create backup if needed
  await ensureSdCardBackupIfEnabled(filename);
}

function isMachineRunning(): boolean {
  const state = mainStore.getState();
  return (
    state.emulatorState?.machineState === MachineControllerState.Running ||
    state.emulatorState?.machineState === MachineControllerState.Paused
  );
}

function isMachineStopped(): boolean {
  const state = mainStore.getState();
  return (
    state.emulatorState?.machineState === MachineControllerState.Stopped ||
    state.emulatorState?.machineState === MachineControllerState.None
  );
}
