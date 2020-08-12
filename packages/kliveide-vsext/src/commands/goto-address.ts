import * as vscode from "vscode";
import { getActiveEditor } from "../custom-editors/editor-base";

let lastLocation = "0";

/**
 *
 * @param context Goes to the specified location
 */
export async function goToAddress(): Promise<void> {
  // --- Is there any active editor?
  const activeEditor = getActiveEditor();
  if (!activeEditor) {
    return;
  }

  // --- Ask for the address
  const result = await vscode.window.showInputBox({
    value: lastLocation,
    prompt: "Specify a hexadecimal address to scroll to",
    placeHolder: "For example, 15f4",
    validateInput: (text) => {
      const val = Number.parseInt(text, 16);
      if (isNaN(val) || val < 0 || val > 0xffff) {
        return "You typed in an invalid address.";
      }
      return null;
    },
  });

  // --- Go to the specified address
  if (result) {
    const address = Number.parseInt(result, 16);
    if (!isNaN(address) && address >= 0 && address <= 0xffff) {
      activeEditor.goToAddress(address);
      lastLocation = result;
    }
  }
}
