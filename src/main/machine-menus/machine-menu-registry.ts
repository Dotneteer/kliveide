import * as path from "path";
import * as fs from "fs";
import {
  MF_TAPE_SUPPORT,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_Z88
} from "../../common/machines/constants";
import {
  MachineMenuInfo,
  MachineMenuItem,
  MachineMenuRenderer
} from "../../common/machines/info-types";
import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";
import { createMachineCommand } from "../../common/messaging/main-to-emu";
import { AppState } from "../../common/state/AppState";
import { setFastLoadAction, setTapeFileAction } from "../../common/state/actions";
import { saveKliveProject } from "../../main/projects";
import { appSettings } from "../../main/settings";
import { BrowserWindow, app, dialog } from "electron";
import { mainStore } from "../../main/main-store";
import { logEmuEvent } from "../../main/registeredMachines";

const TAPE_FILE_FOLDER = "tapeFileFolder";
const TOGGLE_FAST_LOAD = "toggle_fast_load";
const REWIND_TAPE = "rewind_tape";
const SELECT_TAPE_FILE = "select_tape_file";

const tapeMenuRenderer: MachineMenuRenderer = (windowInfo, machine, model) => {
  const items: MachineMenuItem[] = [];
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  if (machine.features?.[MF_TAPE_SUPPORT]) {
    items.push({
      id: TOGGLE_FAST_LOAD,
      label: "Fast Load",
      type: "checkbox",
      checked: !!appState.emulatorState?.fastLoad,
      click: async () => {
        mainStore.dispatch(
          setFastLoadAction(!appState.emulatorState?.fastLoad)
        );
        await saveKliveProject();
      }
    });
    items.push({
      id: REWIND_TAPE,
      label: "Rewind Tape",
      click: async () => {
        await sendFromMainToEmu(createMachineCommand("rewind"));
      }
    });
    items.push({
      id: SELECT_TAPE_FILE,
      label: "Select Tape File...",
      click: async () => {
        await setTapeFile(emuWindow, appState);
        await saveKliveProject();
      }
    });
  }
  return items;
};

/**
 * Machine-specific menu information
 */
export const machineMenuRegistry: Record<string, MachineMenuInfo> = {
  [MI_SPECTRUM_48]: {
    machineItems: tapeMenuRenderer
  },
  [MI_SPECTRUM_128]: {
    machineItems: tapeMenuRenderer
  },
  [MI_SPECTRUM_3E]: {
    machineItems: tapeMenuRenderer
  },
  [MI_Z88]: {}
};

export async function setSelectedTapeFile (filename: string): Promise<void> {
  // --- Read the file
  const tapeFileFolder = path.dirname(filename);

  // --- Store the last selected tape file
  mainStore.dispatch(setTapeFileAction(filename));

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[TAPE_FILE_FOLDER] = tapeFileFolder;

  try {
    const contents = fs.readFileSync(filename);
    await sendFromMainToEmu({
      type: "EmuSetTapeFile",
      file: filename,
      contents
    });
    await logEmuEvent(`Tape file set to ${filename}`);
  } catch (err) {
    dialog.showErrorBox(
      "Error while reading tape file",
      `Reading file ${filename} resulted in error: ${err.message}`
    );
  }
}

// ============================================================================
// Helper functions

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setTapeFile (
  browserWindow: BrowserWindow,
  state: AppState
): Promise<void> {
  const lastFile = state.emulatorState?.tapeFile;
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
