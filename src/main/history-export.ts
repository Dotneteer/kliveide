/*
 * Debug › Export Execution History… (`.plans/TRACE_EXPORT_PLAN.md` §4.3, D13): a save dialog in
 * main, then the IDE's `history-export` command - the state menus' pattern.
 */
import path from "path";
import { dialog, type BrowserWindow } from "electron";

import type { AppState } from "@state/AppState";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MF_EXEC_HISTORY } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { hasMachineFeature } from "@common/features/advancedDebugging";
import {
  HISTORY_EXPORT_FOLDER,
  historyExportCommandText,
  traceFileFilters
} from "@common/history/historyExport";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { mainStore } from "@main/main-store";
import { displaySaveFileDialog } from "./save-file-dialog";
import { t } from "@common/i18n/i18n";

/** Whether the history can be exported now: a machine that records it, not running (D10) */
export function canExportHistory(state: AppState = mainStore.getState()): boolean {
  const machineId = state?.emulatorState?.machineId;
  const supported = hasMachineFeature(machineRegistry.find((m) => m.machineId === machineId), MF_EXEC_HISTORY, state);
  return supported && state?.emulatorState?.machineState !== MachineControllerState.Running;
}

/** The dialog's suggested name: the project's (or the machine's) name */
export function defaultTraceFileName(state: AppState): string {
  const folder = state?.project?.folderPath;
  const base = folder ? path.basename(folder) : (state?.emulatorState?.machineId ?? "machine");
  return `${base}-trace.txt`;
}

/** Asks for a file and exports the whole ring into it */
export async function exportExecutionHistoryAs(browserWindow: BrowserWindow): Promise<void> {
  const filename = await displaySaveFileDialog(browserWindow, {
    title: t("messages.history.exportTitle"),
    defaultPath: defaultTraceFileName(mainStore.getState()),
    filters: traceFileFilters(),
    settingsId: HISTORY_EXPORT_FOLDER
  });
  if (!filename) return;
  // --- The dialog has already confirmed any overwrite. A name without a known extension is text.
  const command = historyExportCommandText(filename, { overwrite: true });
  const done = await getIdeApi().executeCommand(
    /\.(csv|txt|log|trace)$/i.test(filename) ? command : `${command} -format text`
  );
  if (!done?.success) {
    await dialog.showMessageBox(browserWindow, {
      type: "error",
      title: t("messages.history.exportTitle"),
      message: done?.finalMessage ?? t("messages.history.couldNotExport", { file: filename })
    });
  }
}
