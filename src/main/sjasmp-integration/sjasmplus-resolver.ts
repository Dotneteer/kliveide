import path from "path";

import {
  SJASMP_CONFIGURED_FAILED_MESSAGE,
  SJASMP_EXECUTABLE_PATH,
  SJASMP_INSTALL_FOLDER
} from "./sjasmp-config";

// --- Where the user fixes either problem.
const SETUP_HINT = "Use Integrations | SjasmPlus Assembler to set one up.";

export const SJASMPLUS_NOT_CONFIGURED_MESSAGE =
  `No SJASMPLUS assembler is set up yet, so this project cannot be compiled. ${SETUP_HINT}`;

// --- Says the same thing the integration dialog says about a broken setup, and
// --- names the executable it could not find.
export function sjasmplusNotWorkingMessage(executablePath: string): string {
  return (
    `${SJASMP_CONFIGURED_FAILED_MESSAGE} Path: ${executablePath}. ` +
    "Restore it, or use Integrations | SjasmPlus Assembler to select a working one."
  );
}

export type SjasmplusSettingsReader = {
  readSetting(key: string): any;
};

export function resolveSjasmplusExecutable(
  settingsReader: SjasmplusSettingsReader,
  isWindows = process.platform === "win32"
): string {
  const executablePath = readTrimmedSetting(settingsReader, SJASMP_EXECUTABLE_PATH);
  if (executablePath) {
    return normalizeExecutablePath(executablePath);
  }

  const installFolder = readTrimmedSetting(settingsReader, SJASMP_INSTALL_FOLDER);
  if (!installFolder) {
    return "";
  }

  return normalizeExecutablePath(
    path.join(installFolder, isWindows ? "sjasmplus.exe" : "sjasmplus")
  );
}

export function getSjasmplusExecutableName(isWindows = process.platform === "win32"): string {
  return isWindows ? "sjasmplus.exe" : "sjasmplus";
}

export function normalizeExecutablePath(executablePath: string): string {
  return executablePath.replaceAll("\\", "/");
}

function readTrimmedSetting(settingsReader: SjasmplusSettingsReader, key: string): string {
  const value = settingsReader.readSetting(key);
  return typeof value === "string" ? value.trim() : "";
}
