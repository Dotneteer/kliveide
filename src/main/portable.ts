import fs from "fs";
import path from "path";
import { app } from "electron";

// ====================================================================================================================
// Portable mode (issue #1382)
//
// The Windows zip build runs without an installer. To be portable it must keep everything it writes next to the
// executable instead of in the user profile:
//
//   <exe folder>\KliveData\Klive            settings, SD card image, custom tokens, SavedFiles (normally ~\Klive)
//   <exe folder>\KliveData\KliveProjects    default root of new projects (normally ~\KliveProjects)
//   <exe folder>\KliveData\KliveExports     screen recordings (normally ~\KliveExports)
//   <exe folder>\KliveData\AppData          Electron/Chromium user data (normally %APPDATA%\Klive IDE)
//
// The zip and the NSIS installer are built from the same unpacked app, so the build cannot mark one of them. The
// installer, however, always puts an uninstaller next to the executable; a packaged Windows build without one is the
// zip build.
// ====================================================================================================================

/** The folder created next to the executable that holds all data of a portable Klive */
export const PORTABLE_DATA_FOLDER = "KliveData";

/** The subfolder of the portable data folder that replaces Electron's userData (%APPDATA%\Klive IDE) */
export const PORTABLE_USER_DATA_FOLDER = "AppData";

export type PortableDetectionInput = {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  exePath: string;
  /** Lists the files in a folder (injectable for tests) */
  readDir?: (folder: string) => string[];
  /** Ensures the folder exists and is writable; returns false otherwise (injectable for tests) */
  ensureWritable?: (folder: string) => boolean;
};

/**
 * Decides whether this Klive process runs as a portable app.
 * @returns The portable data folder, or undefined when Klive uses the user profile
 */
export function detectPortableDataRoot(input: PortableDetectionInput): string | undefined {
  if (input.platform !== "win32" || !input.isPackaged) return undefined;

  const exeFolder = path.dirname(input.exePath);
  const readDir = input.readDir ?? defaultReadDir;
  let files: string[];
  try {
    files = readDir(exeFolder);
  } catch {
    return undefined;
  }
  if (files.some(isUninstaller)) return undefined;

  // --- A zip extracted into a read-only location (e.g. Program Files) cannot keep its data beside the executable;
  // --- it then behaves like an installed Klive rather than failing to start.
  const dataRoot = path.join(exeFolder, PORTABLE_DATA_FOLDER);
  const ensureWritable = input.ensureWritable ?? defaultEnsureWritable;
  return ensureWritable(dataRoot) ? dataRoot : undefined;
}

function isUninstaller(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.startsWith("uninstall") && lower.endsWith(".exe");
}

function defaultReadDir(folder: string): string[] {
  return fs.readdirSync(folder);
}

function defaultEnsureWritable(folder: string): boolean {
  try {
    fs.mkdirSync(folder, { recursive: true });
    fs.accessSync(folder, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

let portableDataRoot: string | undefined;

/**
 * Switches this process to portable mode when it runs from the Windows zip build. Call it before anything reads a
 * Klive folder and before the app is ready (Electron's userData can only be moved before that).
 */
export function initPortableMode(): void {
  portableDataRoot = detectPortableDataRoot({
    platform: process.platform,
    isPackaged: app.isPackaged,
    exePath: app.getPath("exe")
  });
  if (portableDataRoot) {
    app.setPath("userData", path.join(portableDataRoot, PORTABLE_USER_DATA_FOLDER));
  }
}

/** Tells whether Klive runs in portable mode */
export function isPortableMode(): boolean {
  return portableDataRoot !== undefined;
}

/**
 * The base folder of Klive's own folders (Klive, KliveProjects, KliveExports): the portable data folder in portable
 * mode, otherwise the user's home folder. File dialogs keep starting from the real home folder.
 */
export function getKliveHomeBase(): string {
  return portableDataRoot ?? app.getPath("home");
}

/** Test hook: sets (or clears) the portable data root without detection */
export function setPortableDataRootForTests(root: string | undefined): void {
  portableDataRoot = root;
}
