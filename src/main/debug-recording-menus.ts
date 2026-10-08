/*
 * Debug › Save Debug Recording… and Debug › Open Debug Recording… (`.plans/DEBUG_SESSION_RECORDING_PLAN.md`
 * §4.5, D2): dialogs in main, then the IDE's `debug-recording-save` / `debug-recording-load` commands -
 * the state menus' pattern. File › Open File… and a dropped `.klr` come here too.
 */
import path from "path";
import { dialog, type BrowserWindow } from "electron";

import type { AppState } from "@state/AppState";
import {
  DEBUG_RECORDING_FALLBACK_HINT,
  debugRecordingLoadCommandText,
  debugRecordingSaveCommandText
} from "@common/debugRecording/debugRecordingTypes";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { mainStore } from "@main/main-store";
import { displaySaveFileDialog } from "./save-file-dialog";
import { appSettings, saveAppSettings } from "./settings-utils";

/** The settings key of the folder the last recording was saved to or opened from */
export const DEBUG_RECORDING_FOLDER = "debugRecordingFolder";

const FILTERS = [{ name: "Klive debug recordings", extensions: ["klr"] }];

/** Whether the machine keeps a reverse-debugging timeline now: Save Debug Recording… needs one (D17) */
export function canSaveDebugRecording(state: AppState = mainStore.getState()): boolean {
  return !!state?.emulatorState?.reverseDebug?.active;
}

/** The dialog's suggested name: the project's (or the machine's) name */
export function defaultRecordingFileName(state: AppState): string {
  const folder = state?.project?.folderPath;
  const base = folder ? path.basename(folder) : (state?.emulatorState?.machineId ?? "machine");
  return `${base}-recording.klr`;
}

async function showError(window: BrowserWindow, message: string): Promise<void> {
  await dialog.showMessageBox(window, { type: "error", title: "Debug Recording", message });
}

/** Asks for a file and saves the timeline into it */
export async function saveDebugRecordingAs(window: BrowserWindow): Promise<void> {
  let filename = await displaySaveFileDialog(window, {
    title: "Save Debug Recording",
    defaultPath: defaultRecordingFileName(mainStore.getState()),
    filters: FILTERS,
    settingsId: DEBUG_RECORDING_FOLDER
  });
  if (!filename) return;
  if (!/\.klr$/i.test(filename)) filename += ".klr";
  // --- The dialog has already confirmed any overwrite
  const done = await getIdeApi().executeCommand(debugRecordingSaveCommandText(filename, true));
  if (!done?.success) await showError(window, done?.finalMessage ?? `Could not save ${filename}`);
}

/** Asks for a recording and opens it */
export async function pickAndOpenDebugRecording(window: BrowserWindow): Promise<void> {
  const result = await dialog.showOpenDialog(window, {
    title: "Open Debug Recording",
    defaultPath: appSettings?.folders?.[DEBUG_RECORDING_FOLDER] || undefined,
    filters: FILTERS,
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length < 1) return;
  const filename = result.filePaths[0];
  appSettings.folders ??= {};
  appSettings.folders[DEBUG_RECORDING_FOLDER] = path.dirname(filename);
  saveAppSettings();
  await openDebugRecordingFile(window, filename);
}

/**
 * Opens a recording through `debug-recording-load`; one this build cannot replay is offered as its end
 * state only (D16)
 */
export async function openDebugRecordingFile(window: BrowserWindow, filename: string, start = false): Promise<void> {
  let done = await getIdeApi().executeCommand(debugRecordingLoadCommandText(filename, { start }));
  const message = done?.finalMessage ?? "";
  if (!done?.success && message.endsWith(DEBUG_RECORDING_FALLBACK_HINT)) {
    const answer = await dialog.showMessageBox(window, {
      type: "warning",
      title: "Debug Recording",
      message: message.slice(0, -DEBUG_RECORDING_FALLBACK_HINT.length).trim(),
      detail: "A recording replays only in the Klive build that made it. Open its end state instead, without its past?",
      buttons: ["Open End State", "Cancel"],
      defaultId: 1,
      cancelId: 1
    });
    if (answer.response !== 0) return;
    done = await getIdeApi().executeCommand(debugRecordingLoadCommandText(filename, { acceptFallback: true }));
  }
  if (!done?.success) await showError(window, done?.finalMessage ?? `Could not open ${filename}`);
}
