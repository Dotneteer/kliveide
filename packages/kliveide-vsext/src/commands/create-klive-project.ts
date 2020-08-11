import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export const TEMPLATE_PATH = "out/templates";
export const SPECTRUM_FOLDER = ".spectrum";
export const TAPE_FOLDER = "tape";
export const CODE_FOLDER = "code";
export const MEMORY_FILE = "view.memory";
export const DISASSEMBLY_FILE = "view.disassembly";
export const BASIC_FILE = "view.basic";
export const JETSET_TAPE = "jet-set-willy.tzx";
export const JUNGLE_TAPE = "jungle-trouble.tzx";
export const PACMAN_TAPE = "pac-man.tzx";

/**
 * Creates the basic structure of a Klive project
 * @param context VS Code extension context
 */
export function createKliveProject(context: vscode.ExtensionContext): void {
  const folders = vscode.workspace.workspaceFolders;
  const projFolder = folders ? folders[0].uri.fsPath : null;
  if (!projFolder) {
    vscode.window.showWarningMessage(
      "Please open a project folder before creating a Klive project. No Klive project has been created yet."
    );
    return;
  }

  const templateFolder = path.join(context.extensionPath, TEMPLATE_PATH);

  let foldersCreated = 0;
  let filesCreated = 0;

  // --- Create the .spectrum folder and its contents
  const spectrumFolder = path.join(projFolder, SPECTRUM_FOLDER);
  if (!fs.existsSync(spectrumFolder)) {
    fs.mkdirSync(spectrumFolder, { recursive: true });
    foldersCreated++;
  }
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
  const jetSetFile = path.join(tapeFolder, JETSET_TAPE);
  if (!fs.existsSync(jetSetFile)) {
    copyFile(path.join(templateFolder, JETSET_TAPE), jetSetFile);
    filesCreated++;
  }
  const jungleFile = path.join(tapeFolder, JUNGLE_TAPE);
  if (!fs.existsSync(jungleFile)) {
    copyFile(path.join(templateFolder, JUNGLE_TAPE), jungleFile);
    filesCreated++;
  }
  const pacManFile = path.join(tapeFolder, PACMAN_TAPE);
  if (!fs.existsSync(pacManFile)) {
    copyFile(path.join(templateFolder, PACMAN_TAPE), pacManFile);
    filesCreated++;
  }

  // --- Provide the result message
  let message = "The current project folder is already a Klive project. No new files or folders were added.";
  if (filesCreated > 0 || foldersCreated > 0) {
    message = `Klive project created with ${foldersCreated || "no"} new folder${
      foldersCreated > 1 ? "s" : ""
    } and ${filesCreated || "no"} new file${filesCreated > 1 ? "s" : ""}.`;
  }
  vscode.window.showInformationMessage(message);
}

export function copyFile(src: string, dest: string): void {
  var oldFile = fs.createReadStream(src);
  var newFile = fs.createWriteStream(dest);
  oldFile.pipe(newFile);
}
