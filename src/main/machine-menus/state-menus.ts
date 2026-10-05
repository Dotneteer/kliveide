/*
 * The Klive state items of every machine's menu and of the File menu
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.9, D19): save and load a state file, and the
 * in-memory quick save/restore slot.
 */
import path from "path";
import { app, dialog, type BrowserWindow } from "electron";

import type { MachineMenuRenderer, MachineMenuItem } from "@common/machines/info-types";
import type { AppState } from "@state/AppState";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT
} from "@common/machines/constants";
import {
  machineStateLoadCommandText,
  machineStateSaveCommandText
} from "@common/machineState/machineStateTypes";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { mainStore } from "@main/main-store";
import { appSettings, saveAppSettings } from "@main/settings-utils";
import { logEmuEvent } from "@main/registeredMachines";

/** The settings key of the folder the last state file was saved to or loaded from */
const MACHINE_STATE_FOLDER = "machineStateFolder";

/** The quick save and restore shortcuts (D19); no other menu, Monaco or machine uses them */
export const QUICK_SAVE_ACCELERATOR = "CmdOrCtrl+Alt+S";
export const QUICK_RESTORE_ACCELERATOR = "CmdOrCtrl+Alt+L";

/** The machines that can save their state */
const STATE_MACHINES = [
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_TIMEX,
  MI_ZXNEXT,
  MI_Z88,
  MI_ZX80,
  MI_ZX81
];

/** Can the emulator's machine save its state now (a state machine, running or paused)? */
export function canSaveMachineState(state: AppState = mainStore.getState()): boolean {
  const machineId = state?.emulatorState?.machineId;
  const execState = state?.emulatorState?.machineState;
  return (
    !!machineId &&
    STATE_MACHINES.includes(machineId) &&
    (execState === MachineControllerState.Running || execState === MachineControllerState.Paused)
  );
}

/** Can the quick-saved state be restored? */
export function canQuickRestoreMachineState(state: AppState = mainStore.getState()): boolean {
  return !!state?.emulatorState?.quickStateAvailable;
}

/** The state items of a machine's menu */
export const machineStateMenuRenderer: MachineMenuRenderer = (windowInfo) => {
  const emuWindow = windowInfo.emuWindow;
  const items: MachineMenuItem[] = [
    { type: "separator" },
    {
      id: "machine_save_state",
      label: "Save State...",
      enabled: canSaveMachineState(),
      click: async () => {
        await saveMachineStateAs(emuWindow);
      }
    },
    {
      id: "machine_load_state",
      label: "Load State...",
      click: async () => {
        await openMachineState(emuWindow);
      }
    },
    {
      id: "machine_quick_save_state",
      label: "Quick Save State",
      accelerator: QUICK_SAVE_ACCELERATOR,
      enabled: canSaveMachineState(),
      click: async () => {
        await quickSaveState(emuWindow);
      }
    },
    {
      id: "machine_quick_restore_state",
      label: "Quick Restore State",
      accelerator: QUICK_RESTORE_ACCELERATOR,
      enabled: canQuickRestoreMachineState(),
      click: async () => {
        await quickRestoreState(emuWindow);
      }
    }
  ];
  return items;
};

/** A default state file name: the project's (or the machine's) name and the time */
export function defaultStateFileName(state: AppState, now = new Date()): string {
  const folder = state?.project?.folderPath;
  const base = folder ? path.basename(folder) : (state?.emulatorState?.machineId ?? "machine");
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${base}-${stamp}.kls`;
}

/** Shows a failed command's message */
async function showError(window: BrowserWindow, message: string): Promise<void> {
  await dialog.showMessageBox(window, { type: "error", title: "Machine State", message });
}

/**
 * Asks for a file and saves the machine's state into it through the IDE's `state-save` command.
 * The machine menus and File -> Save Machine State... share it.
 */
export async function saveMachineStateAs(browserWindow: BrowserWindow): Promise<void> {
  const folder = appSettings?.folders?.[MACHINE_STATE_FOLDER] || app.getPath("home");
  const result = await dialog.showSaveDialog(browserWindow, {
    title: "Save Machine State",
    defaultPath: path.join(folder, defaultStateFileName(mainStore.getState())),
    filters: [{ name: "Klive machine state", extensions: ["kls"] }],
    properties: ["showOverwriteConfirmation", "createDirectory"]
  });
  if (result.canceled || !result.filePath) return;
  let filename = result.filePath;
  if (!/\.kls$/i.test(filename)) filename += ".kls";
  appSettings.folders ??= {};
  appSettings.folders[MACHINE_STATE_FOLDER] = path.dirname(filename);
  saveAppSettings();

  // --- The dialog has already confirmed any overwrite
  const done = await getIdeApi().executeCommand(machineStateSaveCommandText(filename, true));
  if (!done?.success) {
    await showError(browserWindow, done?.finalMessage ?? `Could not save ${filename}`);
  }
}

/**
 * Asks for a state file and loads it through the IDE's `state-load` command, stopping at its PC
 * (a state is a debugging bookmark). A changed Next SD card is asked about first.
 */
export async function openMachineState(browserWindow: BrowserWindow): Promise<void> {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: "Load Machine State",
    defaultPath: appSettings?.folders?.[MACHINE_STATE_FOLDER] || app.getPath("home"),
    filters: [
      { name: "Klive machine state", extensions: ["kls"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length < 1) return;
  const filename = result.filePaths[0];
  appSettings.folders ??= {};
  appSettings.folders[MACHINE_STATE_FOLDER] = path.dirname(filename);
  saveAppSettings();

  let done = await getIdeApi().executeCommand(machineStateLoadCommandText(filename, "debug"));
  if (!done?.success && /Use -y to load it anyway/.test(done?.finalMessage ?? "")) {
    const answer = await dialog.showMessageBox(browserWindow, {
      type: "warning",
      title: "Machine State",
      message: (done.finalMessage ?? "").replace(/ Use -y to load it anyway\.$/, ""),
      detail: "Load the state anyway?",
      buttons: ["Load", "Cancel"],
      defaultId: 1,
      cancelId: 1
    });
    if (answer.response !== 0) return;
    done = await getIdeApi().executeCommand(`${machineStateLoadCommandText(filename, "debug")} -y`);
  }
  if (!done?.success) {
    await showError(browserWindow, done?.finalMessage ?? `Could not load ${filename}`);
  }
}

/** Saves the machine into its quick slot */
export async function quickSaveState(browserWindow: BrowserWindow): Promise<void> {
  try {
    const result = await getEmuApi().quickSaveMachineState();
    await logEmuEvent(
      `Quick state saved (${result.machineName}, PC $${result.pc.toString(16).toUpperCase().padStart(4, "0")})`,
      "cyan"
    );
  } catch (err) {
    await showError(browserWindow, (err as Error).message.replace(/^(Error: )+/, ""));
  }
}

/** Restores the machine from its quick slot */
export async function quickRestoreState(browserWindow: BrowserWindow): Promise<void> {
  try {
    await getEmuApi().quickRestoreMachineState();
  } catch (err) {
    await showError(browserWindow, (err as Error).message.replace(/^(Error: )+/, ""));
  }
}
