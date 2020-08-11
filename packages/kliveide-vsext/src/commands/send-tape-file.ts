import * as vscode from "vscode";
import { communicatorInstance } from "../emulator/communicator";

/**
 * Sends a tape file to the emulator
 * @param uri Uri of the file to send to the emulator
 */
export async function sendTapeFile(uri: vscode.Uri): Promise<void> {
  if (await communicatorInstance.setTapeFile(uri.fsPath)) {
    vscode.window.showInformationMessage(`Tape file successfully sent to the emulator.`);
  } else {
    vscode.window.showErrorMessage(`The emulator could not process the tape file.`);
  }
}