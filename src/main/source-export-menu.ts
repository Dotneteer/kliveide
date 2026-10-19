/*
 * Debug › Export Disassembly as Source…: a save dialog in main, the IDE's `export-asm` command, and
 * a message box with its verdict — what the Disassembly view's export button does in the renderer
 * (`src/common/reverse/sourceExportUi.ts` holds the shared texts and command line).
 */
import { dialog, type BrowserWindow } from "electron";

import type { AppState } from "@state/AppState";
import { bankSpaceFor } from "@common/annotations/bankSpace";
import {
  LIVE_VIEW_EXPORT_SCOPE,
  sourceExportCommandText,
  sourceExportDialogOptions,
  sourceExportResultMessage
} from "@common/reverse/sourceExportUi";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { mainStore } from "@main/main-store";
import { showSourceExportSaveDialog } from "./source-export-folder";

/** Whether the machine running now can be exported: it has a bank space to annotate */
export function canExportDisassembly(state: AppState = mainStore.getState()): boolean {
  return !!bankSpaceFor(state?.emulatorState?.machineId);
}

/** Asks for a file, exports the live view's range into it, verifies it and reports the verdict */
export async function exportDisassemblyAsSource(browserWindow: BrowserWindow): Promise<void> {
  const filename = await showSourceExportSaveDialog(browserWindow, sourceExportDialogOptions(LIVE_VIEW_EXPORT_SCOPE));
  if (!filename) return;
  const result = await getIdeApi().executeCommand(sourceExportCommandText(filename, LIVE_VIEW_EXPORT_SCOPE));
  const box = sourceExportResultMessage(filename, result);
  await dialog.showMessageBox(browserWindow, { type: box.type, title: box.title, message: box.message });
}
