import * as path from "path";
import * as fs from "fs";
import {
  MF_TAPE_SUPPORT,
  MC_DISK_SUPPORT
} from "../../common/machines/constants";
import {
  MachineMenuRenderer,
  MachineMenuItem
} from "@common/machines/info-types";
import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../../common/messaging/MainToIdeMessenger";
import { createMachineCommand } from "../../common/messaging/main-to-emu";
import { AppState } from "../../common/state/AppState";
import {
  setFastLoadAction,
  setVolatileDocStateAction,
  setMediaAction
} from "../../common/state/actions";
import { BASIC_PANEL_ID } from "../../common/state/common-ids";
import { mainStore } from "../../main/main-store";
import { saveKliveProject } from "../../main/projects";
import { logEmuEvent } from "../../main/registeredMachines";
import { appSettings } from "../../main/settings";
import { dialog, BrowserWindow, app } from "electron";
import {
  MEDIA_DISK_A,
  MEDIA_DISK_B,
  MEDIA_TAPE
} from "../../common/structs/project-const";

const TAPE_FILE_FOLDER = "tapeFileFolder";

/**
 * Renders tape commands
 */
export const tapeMenuRenderer: MachineMenuRenderer = (windowInfo, machine) => {
  const items: MachineMenuItem[] = [];
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  if (machine.features?.[MF_TAPE_SUPPORT]) {
    items.push({
      id: "toggle_fast_load",
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
      id: "rewind_tape",
      label: "Rewind Tape",
      click: async () => {
        await sendFromMainToEmu(createMachineCommand("rewind"));
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
        console.log("Create Disk File");
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

  function createDiskMenu (index: number, suffix: string): void {
    const state = appState?.media?.[index ? MEDIA_DISK_A : MEDIA_DISK_B] ?? {};
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
            setMediaAction(index ? MEDIA_DISK_A : MEDIA_DISK_B, {
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
        await sendFromMainToIde({
          type: "IdeShowBasic",
          show: !volatileDocs[BASIC_PANEL_ID]
        });
        mainStore.dispatch(
          setVolatileDocStateAction(
            BASIC_PANEL_ID,
            !volatileDocs[BASIC_PANEL_ID]
          )
        );
      }
    }
  ];
};

export async function setSelectedTapeFile (filename: string): Promise<void> {
  // --- Read the file
  const tapeFileFolder = path.dirname(filename);

  // --- Store the last selected tape file
  mainStore.dispatch(setMediaAction(MEDIA_TAPE, filename));

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
 * Sets the disk file to use with the machine
 * @param browserWindow Host browser window
 * @param index Disk drive index (0: A, 1: B)
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setDiskFile (
  browserWindow: BrowserWindow,
  index: number,
  suffix: string
): Promise<void> {
  const DISK_FILE_FOLDER = "diskFileFolder";
  const lastFile =
    mainStore.getState()?.media?.[index ? MEDIA_DISK_A : MEDIA_DISK_B];
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
    setMediaAction(index ? MEDIA_DISK_A : MEDIA_DISK_B, {
      diskFile: filename,
      writeProtected: false
    })
  );

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[DISK_FILE_FOLDER] = diskFileFolder;

  try {
    const contents = fs.readFileSync(filename);
    await sendFromMainToEmu({
      type: "EmuSetDiskFile",
      file: filename,
      contents,
      diskIndex: index
    });
    await logEmuEvent(
      `Disk file in drive ${suffix.toUpperCase()} set to ${filename}`
    );
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
async function ejectDiskFile (index: number, suffix: string): Promise<void> {
  mainStore.dispatch(setMediaAction(index ? MEDIA_DISK_A : MEDIA_DISK_B, {}));
  try {
    await sendFromMainToEmu({
      type: "EmuSetDiskFile",
      diskIndex: index
    });
    await logEmuEvent(`Disk ejected from drive ${suffix.toUpperCase()}`);
  } catch (err) {
    dialog.showErrorBox(
      "Error while ejecting disk file",
      `Ejecting resulted in error: ${err.message}`
    );
  }
}

async function setDiskWriteProtection (
  index: number,
  suffix: string,
  protect: boolean
): Promise<void> {
  try {
    await sendFromMainToEmu({
      type: "EmuSetDiskWriteProtection",
      diskIndex: index,
      protect
    });
    await logEmuEvent(
      `Write protection turned ${
        protect ? "on" : "off"
      } for drive ${suffix.toUpperCase()}`
    );
  } catch (err) {
    // --- Intentionally ignored
  }
}
