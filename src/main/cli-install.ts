import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { app, dialog, type BrowserWindow } from "electron";

/*
 * Klive › Install Command Line Tool… (`.plans/UNIT_TESTS_CLI_PLAN.md` D12, macOS): a symlink from
 * `/usr/local/bin/klive` to the launcher in the app's `Resources/cli`, made with the system's own
 * administrator prompt - as VS Code's "Install 'code' command in PATH" does. The launcher follows
 * the link back to the app, so moving Klive only needs the command run again.
 */

/** Where the command goes */
export const CLI_LINK_PATH = "/usr/local/bin/klive";

/** The launcher in a packaged app, or undefined in a development run */
export function cliLauncherPath(): string | undefined {
  if (!app.isPackaged) return undefined;
  const launcher = path.join(process.resourcesPath, "cli", "klive");
  return fs.existsSync(launcher) ? launcher : undefined;
}

/** Quotes a path for `/bin/sh` */
export function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

/** The AppleScript that makes the link with administrator rights */
export function installAppleScript(launcher: string, link = CLI_LINK_PATH): string {
  const command = `mkdir -p ${shellQuote(path.dirname(link))} && ln -sf ${shellQuote(launcher)} ${shellQuote(link)}`;
  return `do shell script "${command.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" with administrator privileges`;
}

/** Whether the link is there and points at this launcher */
export function linkPointsTo(link: string, launcher: string): boolean {
  try {
    return fs.readlinkSync(link) === launcher;
  } catch {
    return false;
  }
}

/** The menu command */
export async function installCommandLineTool(window?: BrowserWindow): Promise<void> {
  const show = (type: "info" | "error", message: string, detail?: string) =>
    window
      ? dialog.showMessageBox(window, { type, message, detail, buttons: ["OK"] })
      : dialog.showMessageBox({ type, message, detail, buttons: ["OK"] });
  const launcher = cliLauncherPath();
  if (!launcher) {
    await show(
      "error",
      "The command line tool is part of the installed app.",
      "In a development build, run: ELECTRON_RUN_AS_NODE=1 npx electron out/main/cli.js <verb>"
    );
    return;
  }
  if (linkPointsTo(CLI_LINK_PATH, launcher)) {
    await show("info", `'klive' is installed already: ${CLI_LINK_PATH}.`, "Try 'klive help' in a new terminal.");
    return;
  }
  const result = await new Promise<{ ok: boolean; cancelled: boolean; message: string }>((resolve) => {
    execFile("osascript", ["-e", installAppleScript(launcher)], (err, _stdout, stderr) => {
      if (!err) resolve({ ok: true, cancelled: false, message: "" });
      // --- -128: the user cancelled the password prompt
      else resolve({ ok: false, cancelled: /-128/.test(stderr), message: stderr.trim() || err.message });
    });
  });
  if (result.cancelled) return;
  if (result.ok) {
    await show("info", `Installed 'klive' as ${CLI_LINK_PATH}.`, "Try 'klive help' or 'klive test' in a new terminal.");
  } else {
    await show("error", "The command line tool could not be installed.", result.message);
  }
}
