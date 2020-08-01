import * as vscode from "vscode";
import fetch from "node-fetch";
import { spawn } from "child_process";
import { KLIVEIDE, EMU_PORT, EMU_EXEC_PATH } from "../config/sections";

/**
 * This code starts the Klive Emulator if it is not already started yet
 */
export async function startEmulator(
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration(KLIVEIDE);
  try {
    const port = config.get(EMU_PORT);
    const response = await fetch(`http://localhost:${port}/hello`, {
      timeout: 1000,
    });
    if (response.ok && (await response.text()) === "KliveEmu") {
      // --- The emulator is already running
      return;
    }
  } catch (err) {
    // --- This error is intentionally ignored
  }

  // --- We need to apply this hack to run an Electron app from VS Code
  // --- Source: https://stackoverflow.com/questions/51428982/execute-an-electron-app-within-vscode-extension
  var spawn_env = JSON.parse(JSON.stringify(process.env));
  delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
  delete spawn_env.ELECTRON_RUN_AS_NODE;
  const exePath = config.get(EMU_EXEC_PATH) as string;
  try {
    const proc = spawn(exePath, [], {
      env: spawn_env,
      detached: true
    });

    vscode.window.showInformationMessage("Klive Emulator successfuly started.");
  } catch (err) {
    vscode.window.showErrorMessage(`Klive Emulator: ${err}`);
  }
}
