import * as vscode from "vscode";
import { startEmulator } from "./commands/start-emu";
import { Z80RegistersProvider } from "./views/z80-registers";
import { setZ80RegisterProvider } from "./providers";
import { startNotifier, stopNotifier } from "./emulator/notifier";
import { communicatorInstance } from "./emulator/communicator";
import { createVmStateStatusBarItem } from "./views/statusbar";
import { updateKliveProject } from "./commands/update-klive-project";
import { DisassemblyEditorProvider } from "./custom-editors/disassembly/disass-editor";
import { goToAddress } from "./commands/goto-address";
import { sendTapeFile } from "./commands/send-tape-file";
import { refreshView } from "./commands/refresh-view";
import { spectrumConfigurationInstance } from "./emulator/machine-config";
import { MemoryEditorProvider } from "./custom-editors/memory/memory-editor";
import { KLIVEIDE, SAVE_FOLDER } from "./config/sections";
import {
  startBackgroundDisassembly,
  stopBackgroundDisassembly,
} from "./custom-editors/disassembly/background-disassembly";

export async function activate(context: vscode.ExtensionContext) {
  const register = vscode.commands.registerCommand;
  const subs = context.subscriptions;

  // --- Initialize the machine from configuration
  spectrumConfigurationInstance.initialize();

  // --- Register extension commands
  subs.push(
    register("kliveide.startEmu", async () => await startEmulator()),
    register("kliveide.updateKliveProject", () => updateKliveProject(context)),
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
  context.subscriptions.push(MemoryEditorProvider.register(context));

  // --- Start the notification mechanism
  startNotifier();

  // --- Send the current configuration to the emulator
  try {
    await communicatorInstance.signConfigurationChange();
  } catch (err) {
    // --- This error is intentionally ignored
  }

  // --- Observe configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (ev) => {
      if (ev.affectsConfiguration(`${KLIVEIDE}.${SAVE_FOLDER}`)) {
        try {
          await communicatorInstance.signConfigurationChange();
        } catch (err) {
          // --- This error is intentionally ignored
        }
      }
    })
  );

  // --- Start disassembly and caching
  startBackgroundDisassembly();
}

/**
 * Stop watching for notifications
 */
export async function deactivate() {
  stopNotifier();
  await stopBackgroundDisassembly();
}
