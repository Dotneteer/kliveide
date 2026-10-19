/*
 * Where "Export as source" saves (every UI entry point: the listings' button and tools menu, a
 * graphic, the ROM annotation editor, Debug › Export Disassembly as Source…).
 *
 * The folder is the `export.sourceFolder` setting: the project's in a Klive project, the user's
 * otherwise. A user's folder does not reach into projects — it was picked for exports outside one,
 * and a project keeps its exports in itself unless it says otherwise. Unset, it is a suggested
 * default, the way other Klive output has one:
 *   - in a Klive project, `<project>/SourceExports` — beside the project's `SavedFiles`, and inside
 *     the project, so `export-asm -open` can open the file in the IDE;
 *   - otherwise `<home>/KliveExports/source`, beside the screen recordings' `KliveExports/video`.
 *
 * The folder of the file the user picks is written back: to the project's settings when a Klive
 * project is open (relative to the project when it is inside it, so the project can move), to the
 * user's settings otherwise.
 */
import fs from "fs";
import path from "path";
import { dialog, type BrowserWindow } from "electron";

import type { AppState } from "@state/AppState";
import { applyProjectSettingAction } from "@state/actions";
import { SOURCE_EXPORT_FOLDER_SETTING } from "@common/reverse/sourceExportUi";
import { KLIVE_EXPORTS_FOLDER } from "@main/recording/outputPath";
import { mainStore } from "@main/main-store";
import { applyUserSetting } from "@main/settings-utils";
import { getKliveHomeBase } from "@main/portable";
import { saveKliveProject } from "@main/projects";

/** The folder inside a Klive project that exports go to by default */
export const PROJECT_SOURCE_EXPORT_FOLDER = "SourceExports";
/** The subfolder of `KliveExports` that exports go to without a project */
export const SOURCE_EXPORT_SUBFOLDER = "source";

type FolderEnv = { state: AppState | undefined; homeBase: string };

/** The Klive project's folder, when one is open */
function kliveProjectFolder(state: AppState | undefined): string | undefined {
  const project = state?.project;
  return project?.isKliveProject && project.folderPath ? project.folderPath : undefined;
}

/** The folder the save dialog opens in: the setting, else the suggested default */
export function sourceExportFolder({ state, homeBase }: FolderEnv): string {
  const projectFolder = kliveProjectFolder(state);
  const settings = projectFolder ? state?.projectSettings : state?.userSettings;
  const setting = SOURCE_EXPORT_FOLDER_SETTING.split(".").reduce<any>((node, key) => node?.[key], settings);
  if (typeof setting === "string" && setting.trim()) {
    const folder = setting.trim();
    if (path.isAbsolute(folder)) return folder;
    // --- A relative folder is the project's (as written back); without a project, Klive's exports
    return path.join(projectFolder ?? path.join(homeBase, KLIVE_EXPORTS_FOLDER), folder);
  }
  return projectFolder
    ? path.join(projectFolder, PROJECT_SOURCE_EXPORT_FOLDER)
    : path.join(homeBase, KLIVE_EXPORTS_FOLDER, SOURCE_EXPORT_SUBFOLDER);
}

/**
 * What to write back for a chosen file: the scope and the value, or nothing when the setting already
 * says it (so an export with the suggested folder leaves the settings as they were).
 */
export function sourceExportFolderToRemember(
  file: string,
  env: FolderEnv
): { scope: "project" | "user"; value: string } | undefined {
  const folder = path.dirname(file);
  if (path.resolve(folder) === path.resolve(sourceExportFolder(env))) return undefined;
  const projectFolder = kliveProjectFolder(env.state);
  if (!projectFolder) return { scope: "user", value: folder };
  const relative = path.relative(projectFolder, folder);
  const inside = relative && !relative.startsWith("..") && !path.isAbsolute(relative);
  return { scope: "project", value: inside ? relative.split(path.sep).join("/") : relative === "" ? "." : folder };
}

/**
 * The save dialog of an export: opened in the export folder (created when missing), its choice
 * remembered in the project's or the user's settings. Undefined when cancelled.
 */
export async function showSourceExportSaveDialog(
  browserWindow: BrowserWindow,
  options: { title: string; defaultName: string; filters: { name: string; extensions: string[] }[] }
): Promise<string | undefined> {
  const env = { state: mainStore.getState(), homeBase: getKliveHomeBase() };
  const folder = sourceExportFolder(env);
  try {
    fs.mkdirSync(folder, { recursive: true });
  } catch {
    // --- A folder that cannot be made: the dialog still opens, wherever the OS puts it
  }
  const result = await dialog.showSaveDialog(browserWindow, {
    title: options.title,
    defaultPath: path.join(folder, options.defaultName),
    filters: options.filters,
    properties: ["showOverwriteConfirmation", "createDirectory"]
  });
  if (result.canceled || !result.filePath) return undefined;
  const remember = sourceExportFolderToRemember(result.filePath, env);
  if (remember?.scope === "project") {
    mainStore.dispatch(applyProjectSettingAction(SOURCE_EXPORT_FOLDER_SETTING, remember.value));
    await saveKliveProject();
  } else if (remember) {
    applyUserSetting(SOURCE_EXPORT_FOLDER_SETTING, remember.value);
  }
  return result.filePath;
}
