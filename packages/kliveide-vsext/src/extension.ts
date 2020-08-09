import * as vscode from "vscode";
import { startEmulator } from "./commands/start-emu";
import { Z80RegistersProvider } from "./views/z80-registers";
import { setZ80RegisterProvider } from "./providers";
import {
  startNotifier,
  onFrameInfoChanged,
  onExecutionStateChanged,
  stopNotifier,
} from "./emulator/notifier";
import { communicatorInstance } from "./emulator/communicator";
import { createVmStateStatusBarItem } from "./views/statusbar";
import { createKliveProject } from "./commands/create-klive-project";
import { DisassemblyEditorProvider } from "./custom-editors/disassembly/disass-editor";
import { goToAddress } from "./commands/goto-address";

export function activate(context: vscode.ExtensionContext) {
  let startEmuCmd = vscode.commands.registerCommand(
    "kliveide.startEmu",
    async () => await startEmulator()
  );
  context.subscriptions.push(startEmuCmd);

  let createProjectCmd = vscode.commands.registerCommand(
    "kliveide.createProject",
    () => createKliveProject(context)
  );
  context.subscriptions.push(createProjectCmd);
  let goToAddressCmd = vscode.commands.registerCommand(
    "kliveide.goToAddress",
    () => goToAddress(context)
  );
  context.subscriptions.push(goToAddressCmd);

  const z80RegistersProvider = new Z80RegistersProvider();
  setZ80RegisterProvider(z80RegistersProvider);
  vscode.window.registerTreeDataProvider("z80Registers", z80RegistersProvider);

  // --- Notify entities about virtual machine frame information change
  onFrameInfoChanged(async (fi) => {
    try {
      const regData = await communicatorInstance.getRegisters();
      z80RegistersProvider.refresh(regData);
    } catch (err) {
      // --- This exception in intentionally ignored
    }
  });

  // --- Notify entities about virtual machine execution state changes
  onExecutionStateChanged(async () => {
    const regData = await communicatorInstance.getRegisters();
    z80RegistersProvider.refresh(regData);
  });

  // --- Indicate the state of Klive Emulator in the status bar
  const vmStateItem = createVmStateStatusBarItem();
  vmStateItem.command = "kliveide.startEmu";
  context.subscriptions.push(vmStateItem);

  // --- Register custom editors
	context.subscriptions.push(DisassemblyEditorProvider.register(context));

  // --- Start the notification mechanism
  startNotifier();
}

export function deactivate() {
  stopNotifier();
}
