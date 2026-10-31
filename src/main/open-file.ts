/*
 * File › Open File… and files dropped onto the emulator window (`.plans/MENU_REDESIGN_PLAN.md` §3):
 * one way to open every file the emulator understands. `droppedFileAction` decides what a file is;
 * this module carries the decision out with the same code the old per-type menu items used.
 */
import path from "path";
import { app, BrowserWindow, dialog } from "electron";

import { EMULATOR_FILE_EXTENSIONS, droppedFileAction } from "@common/utils/dropped-file-action";
import { machineRegistry } from "@common/machines/machine-registry";
import { MF_TAPE_SUPPORT, MI_HT1080Z, MI_TVC } from "@common/machines/constants";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { mainStore } from "./main-store";
import { saveKliveProject } from "./projects";
import { appSettings, saveAppSettings } from "./settings-utils";
import { setSelectedTapeFile } from "./machine-menus/zx-specrum-menus";
import { loadMachineStateFile } from "./machine-menus/state-menus";
import { openDebugRecordingFile } from "./debug-recording-menus";
import { t } from "@common/i18n/i18n";
import { sniffFileContentKind } from "./sniff-content-kind";

/** The settings key of the folder File › Open File… last opened a file from */
const OPEN_FILE_FOLDER = "openFileFolder";

/**
 * Asks for a file and opens it in the emulator (File › Open File…).
 * @param window The window that owns the dialog
 */
export async function pickAndOpenEmulatorFile(window: BrowserWindow): Promise<void> {
  const result = await dialog.showOpenDialog(window, {
    title: t("messages.file.openFile"),
    defaultPath: appSettings?.folders?.[OPEN_FILE_FOLDER] || app.getPath("home"),
    filters: [
      { name: t("common.filter.emulatorFiles"), extensions: EMULATOR_FILE_EXTENSIONS },
      { name: t("common.filter.spectrumSnapshots"), extensions: ["sna", "z80", "szx"] },
      { name: t("common.filter.z88Snapshots"), extensions: ["z88"] },
      { name: t("common.filter.machineStates"), extensions: ["kls"] },
      { name: t("common.filter.debugRecordings"), extensions: ["klr"] },
      { name: t("common.filter.rzxRecordingsShort"), extensions: ["rzx"] },
      { name: t("common.filter.tapes"), extensions: ["tap", "tzx"] },
      { name: t("common.filter.ht1080zTapes"), extensions: ["cas", "cmd", "bas"] },
      { name: t("common.filter.tvcTapes"), extensions: ["cas"] },
      { name: t("common.filter.epTapes"), extensions: ["tap", "wav"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length < 1) return;
  const filename = result.filePaths[0];
  appSettings.folders ??= {};
  appSettings.folders[OPEN_FILE_FOLDER] = path.dirname(filename);
  saveAppSettings();
  await openEmulatorFile(window, filename, t("messages.file.openFile"));
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
    error = result?.success ? undefined : (result?.finalMessage ?? t("messages.couldNotOpen", { file: filename }));
  } else if (action.kind === "state") {
    // --- The state flow asks before a forced load and reports its own problems
    const owner = window ?? BrowserWindow.getFocusedWindow();
    if (owner) {
      await loadMachineStateFile(owner, filename);
      return undefined;
    }
    const result = await getIdeApi().executeCommand(action.command);
    error = result?.success ? undefined : (result?.finalMessage ?? t("messages.couldNotOpen", { file: filename }));
  } else if (action.kind === "recording") {
    // --- The recording flow offers the end state of another build's recording (D16)
    const owner = window ?? BrowserWindow.getFocusedWindow();
    if (owner) {
      await openDebugRecordingFile(owner, filename);
      return undefined;
    }
    const result = await getIdeApi().executeCommand(action.command);
    error = result?.success ? undefined : (result?.finalMessage ?? t("messages.couldNotOpen", { file: filename }));
  } else if (action.kind === "basic") {
    // --- A .bas by its content (HT1080Z_TAPE_VIEWERS_PLAN D6): a tokenised HT program is a tape, text
    // --- is BASIC source, opened in the IDE when it belongs to the open project
    if (sniffFileContentKind(filename) === "ht1080zBasic") {
      error = await insertHtTape(filename);
    } else {
      const folder = mainStore.getState()?.project?.folderPath;
      if (folder && path.resolve(filename).startsWith(path.resolve(folder) + path.sep)) {
        const result = await getIdeApi().executeCommand(`nav "${filename.replace(/\\/g, "/")}"`);
        error = result?.success ? undefined : (result?.finalMessage ?? t("messages.couldNotOpen", { file: filename }));
      } else {
        error = t("emu.media.tape.ht1080z.basNotTokenised", { file: filename });
      }
    }
  } else if (action.kind === "htTape") {
    error = await insertHtTape(filename);
  } else if (action.kind === "tape") {
    const machineId = mainStore.getState()?.emulatorState?.machineId;
    const machine = machineRegistry.find((m) => m.machineId === machineId);
    if (!machine?.features?.[MF_TAPE_SUPPORT]) {
      error = machine?.displayName
        ? t("messages.file.noTapeDeck", { machine: machine.displayName })
        : t("messages.file.noTapeDeckCurrent");
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

/**
 * Puts an HT-1080Z tape into the HT-1080Z's deck (`.plans/HT1080Z_PLAN.md` §9), or a `.cas` into the
 * Videoton TVC's (`.plans/VIDEOTON_TVC_PLAN.md` §9): refused on any other machine, with the reason
 * @returns An error message, or undefined when the tape went in
 */
async function insertHtTape(filename: string): Promise<string | undefined> {
  const machineId = mainStore.getState()?.emulatorState?.machineId;
  const tvcTape = machineId === MI_TVC && filename.toLowerCase().endsWith(".cas");
  if (machineId !== MI_HT1080Z && !tvcTape) {
    const name = machineRegistry.find((m) => m.machineId === machineId)?.displayName;
    return name ? t("commands.tapeLoad.refusedHtTape", { machine: name }) : t("commands.tapeLoad.refusedHtTapeNoMachine");
  }
  const error = await setSelectedTapeFile(filename, false);
  if (!error) await saveKliveProject();
  return error;
}
