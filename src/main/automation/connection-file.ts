import fs from "fs";
import os from "os";
import path from "path";

import {
  AUTOMATION_CONNECTION_FILE,
  type AutomationConnectionInfo
} from "@common/automation/protocol";

/*
 * The connection file (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D5, T6): where a running Klive's
 * automation server listens and the token it expects, in `<klive-home>/run/automation.json`.
 *
 * `<klive-home>` is the folder of the settings file, so an instance started with
 * `KLIVE_SETTINGS_FILE` (every isolated test) publishes its own file and never shares one with the
 * developer's IDE. The file is `0600` in a `0700` folder, written atomically (a temporary file
 * renamed over it), deleted on quit, and recognised as stale by its dead `pid`.
 *
 * Electron-free: the `klive ide` client reads the same file with the same code.
 */

/** The folder that holds the connection file (and, normally, the socket) */
export function automationRunDir(settingsFilePath: string): string {
  return path.join(path.dirname(settingsFilePath), "run");
}

/** The connection file's path */
export function connectionFilePath(runDir: string): string {
  return path.join(runDir, AUTOMATION_CONNECTION_FILE);
}

/**
 * Creates a folder only its owner can enter (`0700`), or tightens an existing one.
 * On Windows the mode is not meaningful: the folder is in the user's profile, which is per-user.
 */
export function ensurePrivateDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    fs.chmodSync(dir, 0o700);
  }
}

/** Writes the connection file atomically, readable by its owner only (`0600`) */
export function writeConnectionFile(file: string, info: AutomationConnectionInfo): void {
  ensurePrivateDir(path.dirname(file));
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(info, null, 2) + os.EOL, { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") {
    fs.chmodSync(temp, 0o600);
  }
  fs.renameSync(temp, file);
}

/** Reads and checks a connection file; undefined when it is missing or not one */
export function readConnectionFile(file: string): AutomationConnectionInfo | undefined {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  try {
    const info = JSON.parse(text) as Partial<AutomationConnectionInfo>;
    if (
      typeof info?.protocol !== "number" ||
      typeof info.socket !== "string" ||
      !info.socket ||
      typeof info.token !== "string" ||
      !/^[0-9a-f]{64}$/.test(info.token) ||
      typeof info.pid !== "number"
    ) {
      return undefined;
    }
    return {
      protocol: info.protocol,
      socket: info.socket,
      token: info.token,
      pid: info.pid,
      version: String(info.version ?? ""),
      startedAt: String(info.startedAt ?? "")
    };
  } catch {
    return undefined;
  }
}

/** Is a process with this id alive? (A permission error means it exists but is someone else's.) */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

export type ConnectionLookup =
  | { status: "live"; info: AutomationConnectionInfo }
  | { status: "stale"; info: AutomationConnectionInfo }
  | { status: "missing" };

/**
 * Looks up the connection file: live (its process runs), stale (its process is gone: a crash left
 * it behind), or missing.
 */
export function lookUpConnection(
  file: string,
  isAlive: (pid: number) => boolean = isProcessAlive
): ConnectionLookup {
  const info = readConnectionFile(file);
  if (!info) return { status: "missing" };
  return isAlive(info.pid) ? { status: "live", info } : { status: "stale", info };
}

/**
 * Deletes the connection file, but only when it is the one with this token: a file another
 * instance wrote since is left alone.
 */
export function removeConnectionFile(file: string, token?: string): boolean {
  const info = readConnectionFile(file);
  if (token !== undefined && info && info.token !== token) return false;
  try {
    fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}
