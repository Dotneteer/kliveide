import * as vscode from "vscode";
import { startEmulator } from "./emulator/start-emu";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand("kliveide.startEmu", async (ctx) =>
    await startEmulator(ctx)
  );
  context.subscriptions.push(disposable);
}

export function deactivate() {}
