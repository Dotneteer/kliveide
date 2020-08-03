import * as vscode from "vscode";
import { startEmulator } from "./emulator/start-emu";
import { Z80RegistersProvider } from "./views/z80-registers";
import { setZ80RegisterProvider } from "./providers";
import {
  startNotifier,
  onFrameInfoChanged,
  onexecutionChanged as onExecutionStateChanged,
} from "./emulator/notifier";
import { communicatorInstance } from "./emulator/communicator";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "kliveide.startEmu",
    async (ctx) => await startEmulator()
  );
  context.subscriptions.push(disposable);

  const z80RegistersProvider = new Z80RegistersProvider();
  setZ80RegisterProvider(z80RegistersProvider);
  vscode.window.registerTreeDataProvider("z80Registers", z80RegistersProvider);

  /**
   * Notify entities about virtual machine frame information change
   */
  onFrameInfoChanged(async (fi) => {
    try {
      const regData = await communicatorInstance.getRegisters();
      z80RegistersProvider.refresh(regData);
    } catch (err) {
      // --- This exception in intentionally ignored
    }
  });

  onExecutionStateChanged(async (state) => {
    // TODO: Respond to execution state changes
    const regData = await communicatorInstance.getRegisters();
    z80RegistersProvider.refresh(regData);
  });

  startNotifier();
}

export function deactivate() {}
