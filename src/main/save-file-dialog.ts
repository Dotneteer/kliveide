/*
 * A save dialog that remembers its folder (`MainApi.showSaveFileDialog`,
 * `.plans/TRACE_EXPORT_PLAN.md` §4.3): the renderer's features and the menus share it.
 */
import path from "path";
import { app, dialog, type BrowserWindow } from "electron";

import { appSettings, saveAppSettings } from "@main/settings-utils";

export type SaveFileDialogOptions = {
  title?: string;
  /** A file name (opened in the remembered folder) or a full path */
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  /** The `appSettings.folders` key of the folder to open in and to remember */
  settingsId?: string;
};

/** Asks for a file to save; undefined when canceled. The dialog confirms an overwrite itself. */
export async function displaySaveFileDialog(
  browserWindow: BrowserWindow,
  options: SaveFileDialogOptions
): Promise<string | undefined> {
  const folder = (options.settingsId && appSettings?.folders?.[options.settingsId]) || app.getPath("home");
  const name = options.defaultPath ?? "";
  const result = await dialog.showSaveDialog(browserWindow, {
    title: options.title ?? "Save File",
    defaultPath: path.isAbsolute(name) ? name : path.join(folder, name),
    filters: options.filters,
    properties: ["showOverwriteConfirmation", "createDirectory"]
  });
  if (result.canceled || !result.filePath) return undefined;
  if (options.settingsId) {
    appSettings.folders ??= {};
    appSettings.folders[options.settingsId] = path.dirname(result.filePath);
    saveAppSettings();
  }
  return result.filePath;
}
