import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  machineConfigurationInstance,
  KLIVE_PROJ_FOLDER,
  KLIVE_CONFIG_FILE,
  TEMPLATE_PATH,
  MEMORY_FILE,
  DISASSEMBLY_FILE,
  BASIC_FILE,
  TAPE_FOLDER,
  CODE_FOLDER,
  CODE_FILE,
  JETSET_TAPE,
  PACMAN_TAPE,
  MachineConfigData,
  CODE_BAS_FILE,
} from "../emulator/machine-config";
import { communicatorInstance } from "../emulator/communicator";
import { initKliveIcons } from "./init-icons";
import { getLastConnectedState } from "../emulator/notifier";

/**
 * Creates the basic structure of a Klive project
 * @param context VS Code extension context
 */
export async function updateKliveProjectCommand(
  context: vscode.ExtensionContext
): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  const projFolder = folders ? folders[0].uri.fsPath : null;
  if (!projFolder) {
    vscode.window.showWarningMessage(
      "Please open a project folder before creating a Klive project. No Klive project has been created yet."
    );
    return;
  }

  // --- Allow the user to select machine type
  const machineType = await pickMachineType();
  if (!machineType) {
    return;
  }

  // --- Prepare the machine configuration
  const spectrumConfig: MachineConfigData = {
    type: machineType.id,
  };
  switch (machineType.id) {
    case "48":
      spectrumConfig.annotations = ["#spectrum48.disann"];
      break;
    case "128":
      spectrumConfig.annotations = [
        "#spectrum128-0.disann",
        "#spectrum128-1.disann",
      ];
      break;
    // TODO: Add other annotation files
  }

  const templateFolder = path.join(context.extensionPath, TEMPLATE_PATH);

  let foldersCreated = 0;
  let filesCreated = 0;
  let machineFileJustCreated = false;

  // --- Create the .spectrum folder and its contents
  const spectrumFolder = path.join(projFolder, KLIVE_PROJ_FOLDER);
  if (!fs.existsSync(spectrumFolder)) {
    fs.mkdirSync(spectrumFolder, { recursive: true });
    foldersCreated++;
  }
  const machineFile = path.join(spectrumFolder, KLIVE_CONFIG_FILE);
  if (fs.existsSync(machineFile)) {
    fs.unlinkSync(machineFile);
  }
  fs.writeFileSync(
    path.join(spectrumFolder, KLIVE_CONFIG_FILE),
    JSON.stringify(spectrumConfig)
  );
  machineFileJustCreated = true;
  filesCreated++;

  const memFile = path.join(spectrumFolder, MEMORY_FILE);
  if (!fs.existsSync(memFile)) {
    copyFile(path.join(templateFolder, MEMORY_FILE), memFile);
    filesCreated++;
  }
  const disassFile = path.join(spectrumFolder, DISASSEMBLY_FILE);
  if (!fs.existsSync(disassFile)) {
    copyFile(path.join(templateFolder, DISASSEMBLY_FILE), disassFile);
    filesCreated++;
  }
  const basicFile = path.join(spectrumFolder, BASIC_FILE);
  if (!fs.existsSync(basicFile)) {
    copyFile(path.join(templateFolder, BASIC_FILE), basicFile);
    filesCreated++;
  }

  // --- Create the tape folder and its contents
  const tapeFolder = path.join(projFolder, TAPE_FOLDER);
  if (!fs.existsSync(tapeFolder)) {
    fs.mkdirSync(tapeFolder, { recursive: true });
    foldersCreated++;
  }

  // --- Create the code folder and its contents
  const codeFolder = path.join(projFolder, CODE_FOLDER);
  if (!fs.existsSync(codeFolder)) {
    fs.mkdirSync(codeFolder, { recursive: true });
    foldersCreated++;
  }
  const codeFile = path.join(codeFolder, CODE_FILE);
  if (!fs.existsSync(codeFile)) {
    copyFile(path.join(templateFolder, CODE_FILE), codeFile);
    filesCreated++;
  }
  const codeBasFile = path.join(codeFolder, CODE_BAS_FILE);
  if (!fs.existsSync(codeBasFile)) {
    copyFile(path.join(templateFolder, CODE_BAS_FILE), codeBasFile);
    filesCreated++;
  }

  const jetSetFile = path.join(tapeFolder, JETSET_TAPE);
  if (!fs.existsSync(jetSetFile)) {
    copyFile(path.join(templateFolder, JETSET_TAPE), jetSetFile);
    filesCreated++;
  }
  const pacManFile = path.join(tapeFolder, PACMAN_TAPE);
  if (!fs.existsSync(pacManFile)) {
    copyFile(path.join(templateFolder, PACMAN_TAPE), pacManFile);
    filesCreated++;
  }

  // --- Provide the result message
  let message =
    "The current project folder is already a Klive project. No new files or folders were added.";
  if (filesCreated > 0 || foldersCreated > 0) {
    message = `Klive project created with ${foldersCreated || "no"} new folder${
      foldersCreated > 1 ? "s" : ""
    } and ${filesCreated || "no"} new file${filesCreated > 1 ? "s" : ""}.`;
  }
  vscode.window.showInformationMessage(message);

  // --- Configure the newly created machine from file
  if (machineFileJustCreated && getLastConnectedState()) {
    machineConfigurationInstance.initialize();
    await communicatorInstance.setMachineType(
      machineConfigurationInstance.configuration.type
    );
  }

  await initKliveIcons(context);
}

export function copyFile(src: string, dest: string): void {
  fs.copyFileSync(src, dest);
}

/**
 * Allows the user picking up a machine type
 */
async function pickMachineType(): Promise<MachineTypeItem | null> {
  return await new Promise<MachineTypeItem | null>((resolve, reject) => {
    const input = vscode.window.createQuickPick<MachineTypeItem>();
    input.placeholder = "Select the machine type";
    input.items = [
      new MachineTypeItem("48", "ZX Spectrum 48K", true),
      new MachineTypeItem("128", "ZX Spectrum 128K"),
      new MachineTypeItem("p3", "ZX Spectrum +3E (*)"),
      new MachineTypeItem("next", "ZX Spectrum Next (*)"),
      new MachineTypeItem("cz88", "Cambridge Z88"),
    ];
    input.onDidChangeSelection((selection) => {
      if (selection[0]) {
        resolve(selection[0]);
      } else {
        resolve(null);
      }
      input.hide();
    });
    input.onDidHide(() => {
      input.dispose();
      resolve(null);
    });
    input.show();
  });
}

/**
 * Represent a machine type item
 */
class MachineTypeItem implements vscode.QuickPickItem {
  constructor(
    public id: string,
    public label: string,
    public picked?: boolean
  ) {}
}
