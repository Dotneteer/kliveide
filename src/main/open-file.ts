/*
 * File › Open File… and files dropped onto the emulator window (`.plans/MENU_REDESIGN_PLAN.md` §3):
 * one way to open every file the emulator understands. `droppedFileAction` decides what a file is;
 * this module carries the decision out with the same code the old per-type menu items used.
 */
import path from "path";
import { app, BrowserWindow, dialog } from "electron";

import { EMULATOR_FILE_EXTENSIONS, droppedFileAction } from "@common/utils/dropped-file-action";
import { machineRegistry } from "@common/machines/machine-registry";
import { MF_TAPE_SUPPORT } from "@common/machines/constants";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { mainStore } from "./main-store";
import { saveKliveProject } from "./projects";
import { appSettings, saveAppSettings } from "./settings-utils";
import { setSelectedTapeFile } from "./machine-menus/zx-specrum-menus";
import { loadMachineStateFile } from "./machine-menus/state-menus";

/** The settings key of the folder File › Open File… last opened a file from */
const OPEN_FILE_FOLDER = "openFileFolder";

/**
 * Asks for a file and opens it in the emulator (File › Open File…).
 * @param window The window that owns the dialog
 */
export async function pickAndOpenEmulatorFile(window: BrowserWindow): Promise<void> {
  const result = await dialog.showOpenDialog(window, {
    title: "Open File",
    defaultPath: appSettings?.folders?.[OPEN_FILE_FOLDER] || app.getPath("home"),
    filters: [
      { name: "Klive emulator files", extensions: EMULATOR_FILE_EXTENSIONS },
      { name: "ZX Spectrum snapshots", extensions: ["sna", "z80", "szx"] },
      { name: "Z88 snapshots", extensions: ["z88"] },
      { name: "Klive machine states", extensions: ["kls"] },
      { name: "RZX recordings", extensions: ["rzx"] },
      { name: "Tapes", extensions: ["tap", "tzx"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length < 1) return;
  const filename = result.filePaths[0];
  appSettings.folders ??= {};
  appSettings.folders[OPEN_FILE_FOLDER] = path.dirname(filename);
  saveAppSettings();
  await openEmulatorFile(window, filename, "Open File");
}

/**
 * Opens a file in the emulator, routed by its extension. Problems are shown in a message box.
 * @param window The window that owns the message boxes
 * @param filename The file's full path
 * @param title The message boxes' title
 * @returns An error message, or undefined when the file was opened
 */
export async function openEmulatorFile(
  window: BrowserWindow | undefined,
  filename: string,
  title: string
): Promise<string | undefined> {
  const action = droppedFileAction(filename);
  let error: string | undefined;
  if (action.kind === "command") {
    const result = await getIdeApi().executeCommand(action.command);
    error = result?.success ? undefined : (result?.finalMessage ?? `Could not open ${filename}`);
  } else if (action.kind === "state") {
    // --- The state flow asks before a forced load and reports its own problems
    const owner = window ?? BrowserWindow.getFocusedWindow();
    if (owner) {
      await loadMachineStateFile(owner, filename);
      return undefined;
    }
    const result = await getIdeApi().executeCommand(action.command);
    error = result?.success ? undefined : (result?.finalMessage ?? `Could not open ${filename}`);
  } else if (action.kind === "tape") {
    const machineId = mainStore.getState()?.emulatorState?.machineId;
    const machine = machineRegistry.find((m) => m.machineId === machineId);
    if (!machine?.features?.[MF_TAPE_SUPPORT]) {
      error = `The ${machine?.displayName ?? "current machine"} has no tape deck.`;
    } else {
      error = await setSelectedTapeFile(filename, false);
      if (!error) await saveKliveProject();
    }
  } else {
    error = action.message;
  }
  if (error) {
    const owner = window ?? BrowserWindow.getFocusedWindow();
    const options = { type: "error" as const, title, message: error };
    await (owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options));
  }
  return error;
}
