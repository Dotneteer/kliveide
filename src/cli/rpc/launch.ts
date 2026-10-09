import { spawn } from "child_process";
import fs from "fs";
import path from "path";

import { AUTOMATION_SWITCH } from "@common/automation/protocol";
import { lookUpConnection } from "@main/automation/connection-file";
import { CliError, EXIT_INTERNAL, EXIT_USAGE } from "../exit-codes";

/*
 * `--launch` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D12, T1, T2): start Klive with
 * `--automation --noide` when no live server answers, then wait for its connection file. The
 * launched instance stays open.
 *
 * Klive holds a single-instance lock, and a second instance quits at once (it only focuses the
 * first). So when the launched process exits within two seconds without a connection file appearing,
 * Klive is already running with automation off - `--launch` cannot turn it on - and the client says
 * which setting to change.
 */

/** The environment variable naming the Klive executable to launch */
export const KLIVE_APP_ENV = "KLIVE_APP";

/** How long a launched Klive may take to publish its connection file */
const LAUNCH_WAIT_MS = 60_000;

/** A process that exits this soon was the second instance (T1) */
const SECOND_INSTANCE_MS = 2_000;

export type LaunchCommand = { command: string; args: string[] };

/**
 * How to start Klive: `KLIVE_APP`, or - when this CLI runs on Klive's own Electron binary in Node
 * mode - that binary, with the app's entry script when it sits next to this one (a development
 * build's `out/main/index.js`).
 */
export function launchCommand(env: NodeJS.ProcessEnv = process.env, cliDir = __dirname): LaunchCommand | undefined {
  const flags = [AUTOMATION_SWITCH, "--noide"];
  const app = env[KLIVE_APP_ENV];
  if (app) return { command: app, args: flags };
  if (!process.versions.electron) return undefined;
  const entry = path.join(cliDir, "index.js");
  return { command: process.execPath, args: fs.existsSync(entry) ? [entry, ...flags] : flags };
}

/**
 * Starts Klive and waits for its connection file.
 * @param connectionFile The file the new instance will publish
 */
export async function launchKlive(connectionFile: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const launch = launchCommand(env);
  if (!launch) {
    throw new CliError(
      `Cannot tell where Klive is installed. Set ${KLIVE_APP_ENV} to the Klive executable, or run the ` +
        "klive launcher that comes with Klive.",
      EXIT_USAGE
    );
  }
  const childEnv = { ...env };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  const started = Date.now();
  const child = spawn(launch.command, launch.args, {
    detached: true,
    stdio: "ignore",
    env: childEnv,
    windowsHide: false
  });
  let exitedAt: number | undefined;
  let spawnError: Error | undefined;
  child.on("exit", () => (exitedAt = Date.now()));
  child.on("error", (err) => (spawnError = err));
  child.unref();

  while (Date.now() - started < LAUNCH_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (spawnError) {
      throw new CliError(`Cannot start Klive (${launch.command}): ${spawnError.message}`, EXIT_USAGE);
    }
    if (lookUpConnection(connectionFile).status === "live") return;
    if (exitedAt !== undefined) {
      if (exitedAt - started < SECOND_INSTANCE_MS) {
        throw new CliError(
          "Klive is running with automation off, so it cannot be launched again. Turn on " +
            "Settings › General › Automation, or type 'set -u automation.enabled 1' in its command prompt.",
          EXIT_USAGE
        );
      }
      throw new CliError("Klive started but exited before its automation server came up.", EXIT_INTERNAL);
    }
  }
  throw new CliError(`Klive did not start its automation server within ${LAUNCH_WAIT_MS / 1000} s.`, EXIT_INTERNAL);
}
