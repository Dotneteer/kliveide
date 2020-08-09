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
  const projFolder = folders ? folders[0].uri.fsPath : "";
  const templateFolder = path.join(context.extensionPath, TEMPLATE_PATH);

  // --- Create the .spectrum folder and its contents
  const spectrumFolder = path.join(projFolder, SPECTRUM_FOLDER);
  if (!fs.existsSync(spectrumFolder)) {
    fs.mkdirSync(spectrumFolder, { recursive: true });
  }
  const memFile = path.join(spectrumFolder, MEMORY_FILE);
  if (!fs.existsSync(memFile)) {
    copyFile(path.join(templateFolder, MEMORY_FILE), memFile);
  }
  const disassFile = path.join(spectrumFolder, DISASSEMBLY_FILE);
  if (!fs.existsSync(disassFile)) {
    copyFile(path.join(templateFolder, DISASSEMBLY_FILE), disassFile);
  }
  const basicFile = path.join(spectrumFolder, BASIC_FILE);
  if (!fs.existsSync(basicFile)) {
    copyFile(path.join(templateFolder, BASIC_FILE), basicFile);
  }

  // --- Create the tape folder and its contents
  const tapeFolder = path.join(projFolder, TAPE_FOLDER);
  if (!fs.existsSync(tapeFolder)) {
    fs.mkdirSync(tapeFolder, { recursive: true });
  }

  // --- Create the code folder and its contents
  const codeFolder = path.join(projFolder, CODE_FOLDER);
  if (!fs.existsSync(codeFolder)) {
    fs.mkdirSync(codeFolder, { recursive: true });
  }
  const jetSetFile = path.join(tapeFolder, JETSET_TAPE);
  if (!fs.existsSync(jetSetFile)) {
    copyFile(path.join(templateFolder, JETSET_TAPE), jetSetFile);
  }
  const jungleFile = path.join(tapeFolder, JUNGLE_TAPE);
  if (!fs.existsSync(jungleFile)) {
    copyFile(path.join(templateFolder, JUNGLE_TAPE), jungleFile);
  }
  const pacManFile = path.join(tapeFolder, PACMAN_TAPE);
  if (!fs.existsSync(pacManFile)) {
    copyFile(path.join(templateFolder, PACMAN_TAPE), pacManFile);
  }

  vscode.window.showInformationMessage("Klive project created.");
}

export function copyFile(src: string, dest: string): void {
  var oldFile = fs.createReadStream(src);
  var newFile = fs.createWriteStream(dest);
  oldFile.pipe(newFile);
}
