import * as path from "path";
import * as fs from "fs";
import {
  MC_DISK_SUPPORT,
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
import {
  protectDiskAction,
  setDiskFileAction,
  setFastLoadAction,
  setTapeFileAction,
  setVolatileDocStateAction
} from "../../common/state/actions";
import { saveKliveProject } from "../../main/projects";
import { appSettings } from "../../main/settings";
import { BrowserWindow, app, dialog } from "electron";
import { mainStore } from "../../main/main-store";
import { logEmuEvent } from "../../main/registeredMachines";
import { BASIC_PANEL_ID } from "../../common/state/common-ids";
import { sendFromMainToIde } from "../../common/messaging/MainToIdeMessenger";

const TAPE_FILE_FOLDER = "tapeFileFolder";
const TOGGLE_FAST_LOAD = "toggle_fast_load";
const REWIND_TAPE = "rewind_tape";
const SELECT_TAPE_FILE = "select_tape_file";
const FLOPPY_MENU = "floppy_menu";
const CREATE_DISK_FILE = "create_disk_file";
const INSERT_DISK = "insert_disk";
const PROTECT_DISK = "protect_disk";
const EJECT_DISK = "eject_disk";
const IDE_SHOW_BASIC = "show_basic";

/**
 * Renders tape commands
 */
const tapeMenuRenderer: MachineMenuRenderer = (windowInfo, machine) => {
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
 * Renders disk commands
 */
const diskMenuRenderer: MachineMenuRenderer = (windowInfo, _, model) => {
  const appState = mainStore.getState();
  const emuWindow = windowInfo.emuWindow;
  const disksSupported = model?.config?.[MC_DISK_SUPPORT] ?? 0;
  if (!disksSupported) {
    return [];
  }

  const floppySubMenu: MachineMenuItem[] = [
    {
      id: CREATE_DISK_FILE,
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
      id: FLOPPY_MENU,
      label: "Floppy Disks",
      submenu: floppySubMenu
    }
  ];

  function createDiskMenu (index: number, suffix: string): void {
    const disksState = appState?.emulatorState?.floppyDisks ?? [];
    const state = disksState[index];
    floppySubMenu.push({ type: "separator" });
    if (state?.diskFile) {
      floppySubMenu.push({
        id: `${EJECT_DISK}_${suffix}`,
        label: `Eject Disk from Drive ${suffix.toUpperCase()}`,
        click: async () => {
          await ejectDiskFile(index, suffix);
        }
      });
      floppySubMenu.push({
        id: `${PROTECT_DISK}_${suffix}`,
        type: "checkbox",
        checked: !!state.writeProtected,
        label: `Write Protected Disk in Drive ${suffix.toUpperCase()}`,
        click: async () => {
          mainStore.dispatch(protectDiskAction(index, !state.writeProtected));
          await logEmuEvent(
            `Write protection turned ${
              state.writeProtected ? "on" : "off"
            } for drive ${suffix.toUpperCase()}`
          );
        }
      });
    }
    floppySubMenu.push({
      id: `${INSERT_DISK}_${suffix}`,
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
const spectrumIdeRenderer: MachineMenuRenderer = () => {
  const volatileDocs = mainStore.getState()?.ideView?.volatileDocs ?? {};
  return [
    {
      id: IDE_SHOW_BASIC,
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

/**
 * Machine-specific menu information
 */
export const machineMenuRegistry: Record<string, MachineMenuInfo> = {
  [MI_SPECTRUM_48]: {
    machineItems: tapeMenuRenderer,
    ideItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_128]: {
    machineItems: tapeMenuRenderer,
    ideItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_3E]: {
    machineItems: (windowInfo, machine, model) => [
      ...tapeMenuRenderer(windowInfo, machine, model),
      ...diskMenuRenderer(windowInfo, machine, model)
    ],
    ideItems: spectrumIdeRenderer
  },
  [MI_Z88]: {
    helpLinks: [
      {
        label: "Cambridge Z88 User Guide",
        url: "https://cambridgez88.jira.com/wiki/spaces/UG/"
      },
      {
        label: "Cambridge Z88 Developers' Notes",
        url: "https://cambridgez88.jira.com/wiki/spaces/DN/"
      },
      {
        label: "BBC BASIC (Z80) Reference Guide for Z88",
        url: "https://docs.google.com/document/d/1ZFxKYsfNvbuTyErnH5Xtv2aKXWk1vg5TjrAxZnrLsuI"
      },
      {},
      {
        label: "Cambridge Z88 ROM && 3rd party application source code",
        url: "https://bitbucket.org/cambridge/"
      },
      {
        label: "Cambridge Z88 on Wikipedia",
        url: "https://en.wikipedia.org/wiki/Cambridge_Z88"
      },
      {
        label: "Cambridge Z88 assembler tools and utilities",
        url: "https://gitlab.com/bits4fun"
      }
    ]
  }
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
  const lastFile = mainStore.getState()?.emulatorState?.tapeFile;
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
  mainStore.dispatch(setDiskFileAction(index, filename));

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
  mainStore.dispatch(setDiskFileAction(index, null));
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
