/*
 * The RZX items of the ZX Spectrum machine menu and of the File menu (`.plans/RZX_PLAN.md` §1.6):
 * Machine -> RZX (Play Recording..., Record, Stop and Save..., Insert Rollback Point, Roll Back,
 * Render Recording to Video...) and File -> Play RZX Recording... Every item runs the IDE's `zx-rzx*`
 * command, so the menus, the viewer, the Explorer and a script do the same thing.
 */
import path from "path";
import { app, dialog, type BrowserWindow } from "electron";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";
import type { AppState } from "@state/AppState";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "@common/machines/constants";
import {
  rzxStopCommandText,
  rzxVideoCommandText
} from "@common/spectrum/rzx/rzxCommandTypes";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { mainStore } from "@main/main-store";
import { appSettings, saveAppSettings } from "@main/settings-utils";
import { t } from "@common/i18n/i18n";

/** The settings key of the folder the last RZX file was opened from or saved to */
const RZX_FOLDER = "rzxFolder";

const RZX_MACHINES = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E];

/** Can a recording start now: a Spectrum with a state, and no recording running or unsaved */
export function canStartRzxRecording(state: AppState = mainStore.getState()): boolean {
  const emu = state?.emulatorState;
  const exec = emu?.machineState;
  return (
    !!emu?.machineId &&
    RZX_MACHINES.includes(emu.machineId) &&
    (exec === MachineControllerState.Running || exec === MachineControllerState.Paused) &&
    emu.rzx?.mode !== "recording" &&
    emu.rzx?.mode !== "rendering" &&
    !emu.rzx?.unsaved
  );
}

/** Is a recording running (or stopped and waiting to be saved) */
export function hasRzxRecording(state: AppState = mainStore.getState()): boolean {
  const rzx = state?.emulatorState?.rzx;
  return rzx?.mode === "recording" || !!rzx?.unsaved;
}

/** Is a recording running (rollback and rollback points need one) */
export function isRzxRecordingActive(state: AppState = mainStore.getState()): boolean {
  const rzx = state?.emulatorState?.rzx;
  return rzx?.mode === "recording" && !rzx.unsaved;
}

/** The RZX items of Machine › Record (`.plans/RZX_PLAN.md`); playing a recording is File › Open File… */
export const rzxMenuRenderer: MachineMenuRenderer = (windowInfo) => {
  const emuWindow = windowInfo.emuWindow;
  const state = mainStore.getState();
  return [
    {
      id: "rzx_record",
      label: t("menu.rzx.record"),
      enabled: canStartRzxRecording(state),
      click: async () => await runRzxCommand(emuWindow, "zx-rzx-record", t("messages.rzx.recordingTitle"))
    },
    {
      id: "rzx_stop",
      label: t("menu.rzx.stopAndSave"),
      enabled: hasRzxRecording(state),
      click: async () => await saveRzxRecordingAs(emuWindow)
    },
    {
      id: "rzx_point",
      label: t("menu.rzx.insertRollbackPoint"),
      enabled: isRzxRecordingActive(state),
      click: async () => await runRzxCommand(emuWindow, "zx-rzx-point", t("messages.rzx.recordingTitle"))
    },
    {
      id: "rzx_rollback",
      label: t("menu.rzx.rollBack"),
      enabled: isRzxRecordingActive(state),
      click: async () => await runRzxCommand(emuWindow, "zx-rzx-rollback", t("messages.rzx.recordingTitle"))
    },
    {
      id: "rzx_video",
      label: t("menu.rzx.renderToVideo"),
      enabled: !!state?.emulatorState?.screenRecordingAvailable,
      click: async () => await renderRzxRecording(emuWindow)
    }
  ] as MachineMenuItem[];
};

/** Asks for an `.rzx` file */
async function pickRzxFile(browserWindow: BrowserWindow, title: string): Promise<string | undefined> {
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title,
    defaultPath: appSettings?.folders?.[RZX_FOLDER] || app.getPath("home"),
    filters: [
      { name: t("common.filter.rzxRecordings"), extensions: ["rzx"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return undefined;
  const filename = dialogResult.filePaths[0];
  rememberFolder(filename);
  return filename;
}

/** Runs an RZX command, showing its error in a message box */
async function runRzxCommand(browserWindow: BrowserWindow, command: string, title: string): Promise<boolean> {
  const result = await getIdeApi().executeCommand(command);
  if (!result?.success) {
    await dialog.showMessageBox(browserWindow, {
      type: "error",
      title,
      message: result?.finalMessage ?? t("messages.commandFailed", { command })
    });
    return false;
  }
  return true;
}

/** Machine › Record › RZX: Render a Recording to Video... */
export async function renderRzxRecording(browserWindow: BrowserWindow): Promise<void> {
  const file = await pickRzxFile(browserWindow, t("messages.rzx.selectToRender"));
  if (file) await runRzxCommand(browserWindow, rzxVideoCommandText(file), t("messages.rzx.videoTitle"));
}

/** A default recording name: the project's (or the machine's) name and the time */
export function defaultRzxFileName(state: AppState, now = new Date()): string {
  const folder = state?.project?.folderPath;
  const base = folder ? path.basename(folder) : (state?.emulatorState?.machineId ?? "spectrum");
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${base}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.rzx`;
}

/** Machine › Record › RZX: Stop and Save... */
export async function saveRzxRecordingAs(browserWindow: BrowserWindow): Promise<void> {
  const folder = appSettings?.folders?.[RZX_FOLDER] || app.getPath("home");
  const dialogResult = await dialog.showSaveDialog(browserWindow, {
    title: t("messages.rzx.saveTitle"),
    defaultPath: path.join(folder, defaultRzxFileName(mainStore.getState())),
    filters: [{ name: t("common.filter.rzxRecording"), extensions: ["rzx"] }],
    properties: ["showOverwriteConfirmation", "createDirectory"]
  });
  if (dialogResult.canceled || !dialogResult.filePath) return;
  let filename = dialogResult.filePath;
  if (!/\.rzx$/i.test(filename)) filename += ".rzx";
  rememberFolder(filename);
  // --- The dialog has already confirmed any overwrite
  await runRzxCommand(browserWindow, rzxStopCommandText(filename, true), t("messages.rzx.recordingTitle"));
}

function rememberFolder(filename: string): void {
  appSettings.folders ??= {};
  appSettings.folders[RZX_FOLDER] = path.dirname(filename);
  saveAppSettings();
}
