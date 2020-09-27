import * as vscode from "vscode";
import * as path from "path";
import { spawn } from "child_process";
import { KLIVEIDE, EMU_EXEC_PATH } from "../config/sections";
import { communicatorInstance } from "../emulator/communicator";

/**
 * This code starts the Klive Emulator if it is not already started yet
 */
export async function startEmulator(): Promise<void> {
  try {
    if (await communicatorInstance.hello()) {
      // --- The Klive instance is started and initialized
      return;
    }
  } catch (err) {
    // --- This error is intentionally ignored
  }

  const config = vscode.workspace.getConfiguration(KLIVEIDE);
  let exePath = config.get(EMU_EXEC_PATH) as string;

  // --- We do not execpt empty or whitespace-only paths
  if (!exePath || exePath.trim() === "") {
    vscode.window.showErrorMessage(
      `The Klive Emulator path is empty. Please set it in Klive settings.`
    );
    return;
  }

  // --- Now, let's try to start the Emulator
  // --- Try the path as an absolute path
  if (!trySpawn(exePath)) {
    // --- It does not work, so let's try it again as path relative to the user's home folder
    const home =
      process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"] ?? "";
    exePath = path.join(home, exePath);
    if (!trySpawn(exePath)) {
      vscode.window.showErrorMessage(
        `The path '${exePath}' is not a valid path to Klive executable.`
      );
      return;
    }
  }

  // --- The process has been successfully spawned.
  try {
    // --- We need to check, if it is the Klive Emulator and we
    // --- can communicate with it.
    let retries = 0;
    let connected = false;

    // --- Let's try to connect 15 times
    while (retries < 15) {
      try {
        // --- Getting a response for "hello" is a proof of communication
        await communicatorInstance.hello();
        connected = true;
        break;
      } catch {
        await await new Promise((r) => setTimeout(r, 1000));
        retries++;
      }
    }

    // -- Done, if communication works
    if (connected) {
      vscode.window.showInformationMessage(
        "Klive Emulator successfuly started."
      );
      return;
    }

    // --- Otherwise, we failed
    throw new Error();
  } catch (err) {
    vscode.window.showErrorMessage(
      `Cannot communicate with the executable on '${exePath}'.`
    );
  }
}

/**
 * Tries spawning a process
 * @param path Path to spawn the process
 * @return True, if spawning ins successful; otherwise, false
 */
function trySpawn(path: string): boolean {
  // --- We need to apply this hack to run an Electron app from VS Code
  // --- Source: https://stackoverflow.com/questions/51428982/execute-an-electron-app-within-vscode-extension
  var spawn_env = JSON.parse(JSON.stringify(process.env));
  delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
  delete spawn_env.ELECTRON_RUN_AS_NODE;

  // --- At this point, we try to execute the file in fullPath
  try {
    const proc = spawn(path, [], {
      env: spawn_env,
      detached: true,
    });
    return !!proc.pid;
  } catch (err) {
    return false;
  }
}
