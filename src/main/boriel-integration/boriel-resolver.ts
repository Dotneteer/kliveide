import fs from "fs";
import os from "os";
import path from "path";
import { execa } from "execa";

import type { BorielProbeResult } from "@common/messaging/BorielIntegration";
import { ZXBC_EXECUTABLE_PATH } from "../zxb-integration/zxb-config";
import { BORIEL_INSTALL_FOLDER, BORIEL_MIN_MAJOR_VERSION } from "./boriel-config";
import { parseBorielVersion, versionFromOutput } from "./boriel-version";

/*
 * Finding and checking the Boriel BASIC compiler (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3.5).
 * Resolution: an explicit `zxbasic.executablePath`, else `zxbasic.root` + `zxbc[.exe]`.
 */

export const BORIEL_SETUP_HINT = "Use Integrations | Boriel BASIC to install or select it.";

export const BORIEL_NOT_CONFIGURED_MESSAGE = `Boriel BASIC is not set up yet. ${BORIEL_SETUP_HINT}`;

export type SettingsReaderLike = { readSetting(key: string): any };

export function borielExecutableName(isWindows = process.platform === "win32"): string {
  return isWindows ? "zxbc.exe" : "zxbc";
}

/** The zxbc the settings point at, or "" when nothing is configured. */
export function resolveBorielExecutable(
  settingsReader: SettingsReaderLike,
  isWindows = process.platform === "win32"
): string {
  const explicit = readTrimmed(settingsReader, ZXBC_EXECUTABLE_PATH);
  if (explicit) return explicit;
  const folder = readTrimmed(settingsReader, BORIEL_INSTALL_FOLDER);
  return folder ? path.join(folder, borielExecutableName(isWindows)) : "";
}

/** What running `zxbc --version` produced. */
export type VersionRun = { exitCode?: number; stdout: string; stderr: string; timedOut: boolean; error?: string };
export type VersionRunner = (executablePath: string, timeoutMs: number) => Promise<VersionRun>;

/**
 * Runs `zxbc --version` in an empty temporary folder (zxbc reads `./project.ini` from its working
 * folder), with stdin closed and a timeout that kills it: a quarantined first launch on macOS
 * blocks forever (`.ai/boriel/kit.md`).
 */
export const runZxbcVersion: VersionRunner = async (executablePath, timeoutMs) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "klive-zxbc-"));
  try {
    const result = await execa(executablePath, ["--version"], {
      cwd,
      reject: false,
      stdin: "ignore",
      timeout: timeoutMs,
      killSignal: "SIGKILL"
    });
    return {
      exitCode: result.exitCode,
      stdout: String(result.stdout ?? ""),
      stderr: String(result.stderr ?? ""),
      timedOut: !!result.timedOut,
      error: result.failed && !result.timedOut && result.exitCode === undefined ? result.message : undefined
    };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
};

export const PROBE_TIMEOUT_MS = 10_000;

/** Checks that `executablePath` is a Boriel BASIC 2.x compiler that starts. */
export async function probeBoriel(
  executablePath: string,
  runner: VersionRunner = runZxbcVersion,
  platform: string = process.platform
): Promise<BorielProbeResult> {
  if (!executablePath) return { ok: false, executablePath, error: BORIEL_NOT_CONFIGURED_MESSAGE };
  if (!fs.existsSync(executablePath) || !fs.statSync(executablePath).isFile()) {
    return { ok: false, executablePath, error: `zxbc was not found at ${executablePath}.` };
  }
  let run: VersionRun;
  try {
    run = await runner(executablePath, PROBE_TIMEOUT_MS);
  } catch (error: any) {
    return { ok: false, executablePath, error: `zxbc could not be started: ${error?.message ?? error}` };
  }
  if (run.timedOut) {
    const seconds = Math.round(PROBE_TIMEOUT_MS / 1000);
    return {
      ok: false,
      executablePath,
      error:
        platform === "darwin"
          ? `zxbc did not answer within ${seconds} s. macOS blocks a program it has quarantined; ` +
            "install Boriel BASIC again from Klive, or remove the com.apple.quarantine attribute."
          : `zxbc did not answer within ${seconds} s.`
    };
  }
  if (run.error) return { ok: false, executablePath, error: `zxbc could not be started: ${run.error}` };
  const output = `${run.stdout}\n${run.stderr}`;
  const version = versionFromOutput(output);
  if (run.exitCode !== 0 || !version || !/zxbc/i.test(output)) {
    return {
      ok: false,
      executablePath,
      error: `This does not look like Boriel BASIC's zxbc (exit code ${run.exitCode ?? "?"}).`
    };
  }
  const major = parseBorielVersion(version)?.major ?? 0;
  if (major < BORIEL_MIN_MAJOR_VERSION) {
    return {
      ok: false,
      executablePath,
      version,
      error: `zxbc ${version} is too old: Klive supports Boriel BASIC ${BORIEL_MIN_MAJOR_VERSION}.x and later.`
    };
  }
  return { ok: true, executablePath, version };
}

function readTrimmed(settingsReader: SettingsReaderLike, key: string): string {
  const value = settingsReader.readSetting(key);
  return typeof value === "string" ? value.trim() : "";
}
