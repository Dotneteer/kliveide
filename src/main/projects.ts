import path from "path";

import { app } from "electron";
import { mainStore } from "./mainStore";
import { KLIVE_HOME_FOLDER, KLIVE_PROJECT_ROOT } from "@common/structs/project-const";
/**
 * Resolves the specified path using the public folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
export function resolveHomeFilePath(toResolve: string): string {
  return path.isAbsolute(toResolve) ? toResolve : path.join(app.getPath("home"), toResolve);
}

/**
 * Resolves the specified path using the save folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
export function resolveSavedFilePath(toResolve: string): string {
  const project = mainStore.getState().project;
  const isKliveProject = project?.isKliveProject ?? false;
  const projectFolder = project?.folderPath ?? "";
  const finalPath = path.isAbsolute(toResolve)
    ? toResolve
    : isKliveProject
      ? path.join(projectFolder, "SavedFiles", toResolve)
      : path.join(path.join(app.getPath("home"), KLIVE_HOME_FOLDER, "SavedFiles"), toResolve);
  return finalPath;
}

/**
 * Resolves the specified path using the public folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
export function resolvePublicFilePath(toResolve: string): string {
  return path.isAbsolute(toResolve) ? toResolve : path.join(process.env.PUBLIC, toResolve);
}

// --- Gets the klive folder for the specified project folder
export function getKliveProjectFolder(projectFolder: string): string {
  return projectFolder
    ? path.isAbsolute(projectFolder)
      ? projectFolder
      : path.join(app.getPath("home"), KLIVE_PROJECT_ROOT, projectFolder)
    : path.join(app.getPath("home"), KLIVE_PROJECT_ROOT);
}
