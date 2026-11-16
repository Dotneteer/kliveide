import path from "path";
import { appSettings, saveAppSettings } from "./settings-utils";

/**
 * The folders the user chose to keep as plain folders when Klive offered to make them a Klive
 * project (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.2, decision Q3). Kept in Klive's own
 * settings, never in the folder.
 */

/** One spelling per folder: resolved, forward slashes, no trailing slash */
function keyOf(folder: string): string {
  return path.resolve(folder).replace(/\\/g, "/").replace(/\/+$/, "");
}

function sameFolder(a: string, b: string): boolean {
  // --- Windows and macOS file systems are case-insensitive by default
  return process.platform === "linux" ? a === b : a.toLowerCase() === b.toLowerCase();
}

/** Has the user chosen to keep this folder as a plain folder? */
export function isRememberedPlainFolder(folder: string): boolean {
  const key = keyOf(folder);
  return (appSettings.plainFolders ?? []).some((f) => sameFolder(f, key));
}

/** Remembers that the user keeps this folder as a plain folder */
export function rememberPlainFolder(folder: string): void {
  if (!folder || isRememberedPlainFolder(folder)) return;
  appSettings.plainFolders = [...(appSettings.plainFolders ?? []), keyOf(folder)];
  saveAppSettings();
}

/** Forgets the choice, once the folder became a Klive project */
export function forgetPlainFolder(folder: string): void {
  if (!folder || !isRememberedPlainFolder(folder)) return;
  const key = keyOf(folder);
  appSettings.plainFolders = (appSettings.plainFolders ?? []).filter((f) => !sameFolder(f, key));
  saveAppSettings();
}
