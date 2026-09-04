import path from "path";

import { SJASMP_EXECUTABLE_PATH, SJASMP_INSTALL_FOLDER } from "./sjasmp-config";

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
