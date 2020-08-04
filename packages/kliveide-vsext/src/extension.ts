import * as vscode from "vscode";
import { startEmulator } from "./emulator/start-emu";
import { Z80RegistersProvider } from "./views/z80-registers";
import { setZ80RegisterProvider } from "./providers";
import {
  startNotifier,
  onFrameInfoChanged,
  onExecutionStateChanged,
} from "./emulator/notifier";
import { communicatorInstance } from "./emulator/communicator";
import { createVmStateStatusBarItem } from "./views/statusbar";

export function activate(context: vscode.ExtensionContext) {
  let startEmuCmd = vscode.commands.registerCommand(
    "kliveide.startEmu",
    async (ctx) => await startEmulator()
  );
  context.subscriptions.push(startEmuCmd);

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
    const regData = await communicatorInstance.getRegisters();
    z80RegistersProvider.refresh(regData);
  });

  const vmStateItem = createVmStateStatusBarItem();
  vmStateItem.command = "kliveide.startEmu";
  context.subscriptions.push(vmStateItem);

  startNotifier();
}

export function deactivate() {}
