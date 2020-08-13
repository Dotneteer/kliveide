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
import { sendTapeFile } from "./commands/send-tape-file";
import { refreshView } from "./commands/refresh-view";
import { spectrumConfigurationInstance } from "./emulator/machine-config";

export function activate(context: vscode.ExtensionContext) {
  const register = vscode.commands.registerCommand;
  const subs = context.subscriptions;

  // --- Initialize the machine from configuration
  spectrumConfigurationInstance.initialize();
  
  // --- Register extension commands
  subs.push(
    register("kliveide.startEmu", async () => await startEmulator()),
    register("kliveide.createProject", () => createKliveProject(context)),
    register("kliveide.goToAddress", () => goToAddress()),
    register("kliveide.sendTape", (uri: vscode.Uri) => sendTapeFile(uri)),
    register("kliveide.refreshView", () => refreshView())
  );

  // --- Tree provider to display Z80 registers
  const z80RegistersProvider = new Z80RegistersProvider();
  setZ80RegisterProvider(z80RegistersProvider);
  vscode.window.registerTreeDataProvider("z80Registers", z80RegistersProvider);

  // --- Indicate the state of Klive Emulator in the status bar
  const vmStateItem = createVmStateStatusBarItem();
  vmStateItem.command = "kliveide.startEmu";
  context.subscriptions.push(vmStateItem);

  // --- Register custom editors
  context.subscriptions.push(DisassemblyEditorProvider.register(context));

  // --- Start the notification mechanism
  startNotifier();
}

/**
 * Stop watching for notifications
 */
export function deactivate() {
  stopNotifier();
}
